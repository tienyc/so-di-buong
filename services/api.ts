import { db } from './firebase'; 
import { collection, doc, setDoc, getDoc, deleteDoc, query, where, getDocsFromServer } from 'firebase/firestore';
import { Patient, MedicalOrder, PatientStatus } from '../types';
import { SettingsPayload } from './sheetMapping'; // Giả định SettingsPayload đã bao gồm các URL

/* -------------------------------------------------------------------------- */
/* Public API cho app (CRUD Bệnh nhân)                        */
/* -------------------------------------------------------------------------- */

export async function fetchAllData(): Promise<Patient[]> {
    const patientsCol = collection(db, 'patients');
    const q = query(patientsCol, where("status", "!=", PatientStatus.ARCHIVED));
    const patientSnapshot = await getDocsFromServer(q);

    const patientList = patientSnapshot.docs.map(doc => {
        const data = doc.data();
        const patient = {
            ...data,
            id: doc.id,
            // Đảm bảo các trường string có fallback để tránh lỗi .trim()/.split()
            surgeryDate: data.surgeryDate || "",
            fullName: data.fullName || data.fullname || "", // Thêm fallback cho trường name
            insuranceNumber: data.insuranceNumber || ""
        } as unknown as Patient;

        return patient;
    });

    return patientList;
}

export async function savePatient(patient: Patient): Promise<string> {
    const patientRef = doc(db, 'patients', patient.id);
    await setDoc(patientRef, patient, { merge: true });
    return patient.id;
}

export async function saveOrder(order: MedicalOrder | any): Promise<string> {
    console.log("saveOrder is called, but patient object should be saved instead.", order);
    return order.id;
}

export async function confirmDischarge(patientId: string, dischargeDate: string): Promise<void> {
    const patientRef = doc(db, 'patients', patientId);
    await setDoc(patientRef, { status: PatientStatus.ARCHIVED, dischargeConfirmed: true, dischargeDate }, { merge: true });
}

export async function deletePatient(patientId: string): Promise<void> {
    const patientRef = doc(db, 'patients', patientId);
    await deleteDoc(patientRef);
}

/* ---------------------------- Settings / cấu hình -------------------------- */

const SETTINGS_DOC_ID = 'app_config';

// ✅ SỬA: Bổ sung các trường URL vào default settings
export const getDefaultSettings = (): SettingsPayload => ({
    doctors: [],
    operatingRooms: [],
    anesthesiaMethods: [],
    surgeryClassifications: [],
    surgeryRequirements: [],
    wards: [],
    // PHẦN BỔ SUNG QUAN TRỌNG:
    sheetUrl: '',
    surgerySheetUrl: '', 
});

export async function fetchSettings(): Promise<SettingsPayload> {
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        return {
            doctors: data.doctors || [],
            operatingRooms: data.operatingRooms || [],
            anesthesiaMethods: data.anesthesiaMethods || [],
            surgeryClassifications: data.surgeryClassifications || [],
            surgeryRequirements: data.surgeryRequirements || [],
            wards: data.wards || [],
            // ✅ BỔ SUNG: Đảm bảo fetch các trường URL từ Firestore
            sheetUrl: data.sheetUrl || '',
            surgerySheetUrl: data.surgerySheetUrl || '',
        } as SettingsPayload;
    } else {
        console.warn("Settings document not found, returning default empty settings.");
        return getDefaultSettings();
    }
}

export async function saveSettings(settings: SettingsPayload): Promise<void> {
    // ✅ Lưu toàn bộ object settings (bao gồm cả các trường URL)
    const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
    await setDoc(docRef, settings, { merge: true });
    // Lý do: setDoc(settings) sẽ ghi đè/gộp toàn bộ các trường doctors, wards, sheetUrl, surgerySheetUrl
}

export async function getDischargedTodayCount(): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const patientsCol = collection(db, 'patients');
    
    // ✅ LƯU Ý: Date filtering trong Firestore yêu cầu định dạng ISO string. 
    // Nếu trường 'dischargeDate' trong DB chỉ lưu 'YYYY-MM-DD', 
    // bạn cần đảm bảo các giá trị so sánh cũng là 'YYYY-MM-DD' hoặc chuyển sang Timestamp.
    
    const q = query(
        patientsCol, 
        where("status", "==", PatientStatus.ARCHIVED),
        // Giả sử dischargeDate trong DB là YYYY-MM-DD string:
        where("dischargeDate", ">=", today.toISOString().split('T')[0]),
        where("dischargeDate", "<", tomorrow.toISOString().split('T')[0])
    );
    
    const snapshot = await getDocsFromServer(q);
    return snapshot.size;
}