
export enum OrderType {
    MEDICATION = 'Thuốc',
    LAB = 'Xét nghiệm',
    IMAGING = 'CĐHA', // Shortened for mobile
    PROCEDURE = 'Thủ thuật',
    CARE = 'Chăm sóc',
    SURGERY_PREP = 'CB Mổ',
    DISCHARGE = 'Ra viện' // New type
}

export enum OrderStatus {
    PENDING = 'Chờ TH',
    COMPLETED = 'Đã xong',
    CANCELLED = 'Đã hủy'
}

export enum PatientStatus {
    ACTIVE = 'Đang điều trị',
    DISCHARGED = 'Đã ra viện', // Logically discharged but maybe waiting for paperwork
    ARCHIVED = 'Đã lưu hồ sơ', // Completely finished, hidden from main view
    TRANSFERRED = 'Đã chuyển khoa',
    SURGERY_READY = 'Chờ mổ',
    POST_OP = 'Hậu phẫu'
}

export interface MedicalOrder {
    id: string;
    type: OrderType;
    content: string;
    createdDate: string;
    executionDate: string; 
    status: OrderStatus;
    doctorName: string;
}

export interface Patient {
    id: string;
    roomNumber: string;
    bedNumber: string; // Deprecated in UI but kept for data structure compatibility if needed
    fullName: string;
    age: number;
    gender: 'Nam' | 'Nữ';
    ward?: string;
    admissionDate: string; // Used to calc duration
    roomEntryDate?: string; // New: Date entered this specific room (for "New Patient" highlight)
    diagnosis: string;
    historySummary: string;
    orders: MedicalOrder[];
    
    // Surgery Info
    isScheduledForSurgery: boolean;
    isRegisteredForSurgery?: boolean;
    surgeryNotes?: string;
    surgeryDate?: string;
    surgeryTime?: string; // e.g., "09:30"
    surgeryMethod?: string; // PPPT
    
    // Detailed Surgery Fields
    surgeonName?: string; // Phẫu thuật viên
    operatingRoom?: string; // Phòng mổ (1-9)
    anesthesiaMethod?: string; // PPVC (Tê TS, Mê NKQ...)
    surgeryClassification?: string; // Phân loại (Chấn thương, Dịch vụ...)
    surgeryRequirements?: string; // Yêu cầu (Săng trung, Săng đại...)

    // Status Flags
    isSevere: boolean; // Bệnh nặng cần theo dõi
    status: PatientStatus;
    dischargeDate?: string; // Scheduled or actual discharge date
}

export interface RoomBlock {
    id: string;
    name: string;
    definedRooms?: string[]; // List of room numbers (e.g., "101", "102") defined in settings
    patients: Patient[];
}

export enum AppView {
    WARD_ROUND = 'WARD_ROUND',
    SEVERE_CASES = 'SEVERE_CASES', // New Tab
    SURGERY_SCHEDULE = 'SURGERY_SCHEDULE',
    DISCHARGE_LIST = 'DISCHARGE_LIST', // New Tab
    STATISTICS = 'STATISTICS', // New View
    SETTINGS = 'SETTINGS'
}
