import { Patient, MedicalOrder, RoomBlock, PatientStatus, OrderStatus, OrderType } from '../types';

type SheetValue = string | number | boolean | null;

export interface RawPatient {
    id: string;
    fullName: string;
    age: SheetValue;
    gender: string;
    ward: string;
    roomNumber: string;
    bedNumber?: string;
    admissionDate: string;
    roomEntryDate?: string;
    diagnosis: string;
    clinicalNote?: string;
    isSevere?: SheetValue;
    status: string;
    plannedDischargeDate?: string;
    dischargeConfirmed?: SheetValue;
    actualDischargeDate?: string;
    isScheduledForSurgery?: SheetValue;  // ✅ Sửa: Khớp với tên cột trong sheet
    surgeryDate?: string;
    surgeryTime?: string;
    operatingRoom?: string;
    surgeryMethod?: string;
    anesthesiaMethod?: string;
    surgeonName?: string;
    surgeryClassification?: string;
    surgeryRequirements?: string;
}

export interface RawOrder {
    id: string;
    patientId: string;
    content: string;
    createdDate: string;
    executionDate: string;
    status: string;
    doctorName: string;
}

const parseBoolean = (value?: SheetValue): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return ['1', 'true', 'có', 'yes', 'y'].includes(normalized);
    }
    return false;
};

const parseNumber = (value?: SheetValue): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value !== '') {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
};

const normalizePatientStatus = (value?: string): PatientStatus => {
    if (!value) return PatientStatus.ACTIVE;
    const match = Object.values(PatientStatus).find(status => status === value);
    return match || PatientStatus.ACTIVE;
};

const normalizeOrderStatus = (value?: string): OrderStatus => {
    if (!value) return OrderStatus.PENDING;
    const match = Object.values(OrderStatus).find(status => status === value);
    return match || OrderStatus.PENDING;
};

export const mapRawPatient = (raw: RawPatient): Patient => {
    const hasSurgeryDate = !!raw.surgeryDate && String(raw.surgeryDate).trim() !== '';
    // ✅ Nếu có ngày mổ, bệnh nhân sẽ luôn được coi là đã đăng ký mổ.
    // Ngược lại, sẽ dùng giá trị từ cột trong sheet.
    const isScheduled = hasSurgeryDate || parseBoolean(raw.isScheduledForSurgery);

    return {
        id: raw.id,
        fullName: raw.fullName,
        age: parseNumber(raw.age),
        gender: raw.gender === 'Nữ' ? 'Nữ' : 'Nam',
        ward: raw.ward,
        roomNumber: raw.roomNumber,
        bedNumber: raw.bedNumber || '',
        admissionDate: raw.admissionDate,
        roomEntryDate: raw.roomEntryDate,
        diagnosis: raw.diagnosis,
        historySummary: raw.clinicalNote || '',
        orders: [],
        isScheduledForSurgery: isScheduled,
        isRegisteredForSurgery: isScheduled,
        surgeryNotes: '',
        surgeryDate: isScheduled ? (raw.surgeryDate || '') : '',  // ✅ Chỉ giữ ngày mổ nếu bệnh nhân đã đăng ký
        surgeryTime: isScheduled ? (raw.surgeryTime || '') : '',  // ✅ Chỉ giữ giờ mổ nếu bệnh nhân đã đăng ký
        surgeryMethod: raw.surgeryMethod,
        surgeonName: raw.surgeonName,
        operatingRoom: raw.operatingRoom,
        anesthesiaMethod: raw.anesthesiaMethod,
        surgeryClassification: raw.surgeryClassification,
        surgeryRequirements: raw.surgeryRequirements,
        isSevere: parseBoolean(raw.isSevere),
        status: normalizePatientStatus(raw.status),
        dischargeDate: raw.plannedDischargeDate || raw.actualDischargeDate,
    };
};

export const mapRawOrder = (raw: RawOrder): MedicalOrder => ({
    id: raw.id,
    type: OrderType.CARE,
    content: raw.content,
    createdDate: raw.createdDate,
    executionDate: raw.executionDate,
    status: normalizeOrderStatus(raw.status),
    doctorName: raw.doctorName || 'Y lệnh',
});

export const groupPatientsByWard = (patients: Patient[]): RoomBlock[] => {
    const wards = new Map<string, RoomBlock>();

    patients.forEach(patient => {
        const wardName = patient.ward || 'Chưa xác định';
        const existing = wards.get(wardName);
        if (existing) {
            existing.patients.push(patient);
            if (patient.roomNumber && !existing.definedRooms?.includes(patient.roomNumber)) {
                existing.definedRooms = existing.definedRooms ? [...existing.definedRooms, patient.roomNumber] : [patient.roomNumber];
            }
        } else {
            wards.set(wardName, {
                id: wardName,
                name: wardName,
                definedRooms: patient.roomNumber ? [patient.roomNumber] : [],
                patients: [patient]
            });
        }
    });

    return Array.from(wards.values());
};

export type { Patient, MedicalOrder };
export { PatientStatus, OrderStatus, OrderType };

export const buildRoomBlocksFromConfig = (patients: Patient[], wards: WardConfig[] = []): RoomBlock[] => {
    const map = new Map<string, RoomBlock>();

    wards.forEach(ward => {
        map.set(ward.name, {
            id: ward.id,
            name: ward.name,
            definedRooms: [...new Set(ward.rooms)],
            patients: []
        });
    });

    patients.forEach(patient => {
        const wardName = patient.ward || 'Chưa xác định';
        if (!map.has(wardName)) {
            map.set(wardName, {
                id: patient.id,
                name: wardName,
                definedRooms: patient.roomNumber ? [patient.roomNumber] : [],
                patients: []
            });
        }
        const block = map.get(wardName)!;
        block.patients.push(patient);
        if (patient.roomNumber && !(block.definedRooms || []).includes(patient.roomNumber)) {
            block.definedRooms = [...(block.definedRooms || []), patient.roomNumber];
        }
    });

    const ordered: RoomBlock[] = [];
    wards.forEach(ward => {
        const block = map.get(ward.name);
        if (block) {
            ordered.push(block);
            map.delete(ward.name);
        }
    });

    map.forEach(block => ordered.push(block));
    return ordered;
};

export const serializePatientToRaw = (patient: Patient) => ({
    id: patient.id,
    fullName: patient.fullName,
    age: patient.age,
    gender: patient.gender,
    ward: patient.ward,
    roomNumber: patient.roomNumber,
    bedNumber: patient.bedNumber || '',
    admissionDate: patient.admissionDate,
    roomEntryDate: patient.roomEntryDate || '',
    diagnosis: patient.diagnosis,
    clinicalNote: patient.historySummary || '',
    isSevere: patient.isSevere ? 'TRUE' : '',
    status: patient.status,
    plannedDischargeDate: patient.dischargeDate || '',
    isScheduledForSurgery: patient.isScheduledForSurgery ? 'TRUE' : '',  // ✅ Sửa: Khớp với tên cột trong sheet
    surgeryDate: patient.surgeryDate || '',
    surgeryTime: patient.surgeryTime || '',
    operatingRoom: patient.operatingRoom || '',
    surgeryMethod: patient.surgeryMethod || '',
    anesthesiaMethod: patient.anesthesiaMethod || '',
    surgeonName: patient.surgeonName || '',
    surgeryClassification: patient.surgeryClassification || '',
    surgeryRequirements: patient.surgeryRequirements || ''
});

// ================= CONFIG HELPERS =================

export type DropdownType = 'DOCTOR' | 'OR' | 'ANESTHESIA' | 'CLASS' | 'REQ';

export interface WardConfig {
    id: string;
    name: string;
    rooms: string[];
    order?: number;
}

export interface DropdownConfig {
    type: DropdownType;
    value: string;
    order?: number;
}

export interface SettingsPayload {
    doctors: string[];
    wards: WardConfig[];
    operatingRooms: string[];
    anesthesiaMethods: string[];
    surgeryClassifications: string[];
    surgeryRequirements: string[];
}

export interface RawWardConfig {
    id: string;
    name: string;
    rooms: string;
    order?: SheetValue;
}

export interface RawDropdownConfig {
    type: string;
    value: string;
    order?: SheetValue;
}

const normalizeDropdownType = (value?: string): DropdownType | null => {
    if (!value) return null;
    const normalized = value.trim().toUpperCase();
    const valid: DropdownType[] = ['DOCTOR', 'OR', 'ANESTHESIA', 'CLASS', 'REQ'];
    return valid.includes(normalized as DropdownType) ? (normalized as DropdownType) : null;
};

export const mapWardConfig = (raw: RawWardConfig): WardConfig => ({
    id: raw.id || raw.name,
    name: raw.name,
    rooms: raw.rooms
        ? raw.rooms.split(',').map(r => r.trim()).filter(Boolean)
        : [],
    order: raw.order !== undefined ? parseNumber(raw.order) : undefined
});

export const mapDropdownConfig = (raw: RawDropdownConfig): DropdownConfig | null => {
    const type = normalizeDropdownType(raw.type);
    if (!type) return null;
    return {
        type,
        value: raw.value,
        order: raw.order !== undefined ? parseNumber(raw.order) : undefined
    };
};

export const serializeWardToRaw = (ward: WardConfig): RawWardConfig => ({
    id: ward.id,
    name: ward.name,
    rooms: ward.rooms.join(', '),
    order: ward.order
});

export const serializeDropdownToRaw = (dropdown: DropdownConfig): RawDropdownConfig => ({
    type: dropdown.type,
    value: dropdown.value,
    order: dropdown.order
});
