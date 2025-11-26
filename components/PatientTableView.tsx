import React from 'react';
import { Patient } from '../types';
import { AlertCircle, LogOut, Syringe } from 'lucide-react';

interface PatientTableViewProps {
    patients: Patient[];
    filterTitle: string;
    onPatientClick: (id: string) => void;
}

const PatientTableView: React.FC<PatientTableViewProps> = ({ patients, filterTitle, onPatientClick }) => {
    
    // Hàm kiểm tra ngày hôm nay
    const isToday = (dateStr?: string) => {
        if (!dateStr) return false;
        try {
            const today = new Date();
            const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
            const targetDateStr = dateStr.split('T')[0];
            return todayStr === targetDateStr;
        } catch { return false; }
    };

    // LOGIC TAG ƯU TIÊN (ĐỘC QUYỀN - Nhỏ gọn)
    const renderPriorityTag = (p: Patient) => {
        // Tag style chung: margin-top nhỏ, font bé
        const baseClass = "inline-flex items-center gap-1 px-1.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wide border mt-1 w-fit";

        if (p.isSevere) {
            return (
                <span className={`${baseClass} bg-red-100 text-red-600 border-red-200`}>
                    <AlertCircle size={9} strokeWidth={3} /> Nặng
                </span>
            );
        }
        if (isToday(p.dischargeDate)) {
            return (
                <span className={`${baseClass} bg-green-100 text-green-700 border-green-200`}>
                    <LogOut size={9} strokeWidth={3} /> Ra viện
                </span>
            );
        }
        if (isToday(p.surgeryDate)) {
            return (
                <span className={`${baseClass} bg-blue-100 text-blue-700 border-blue-200`}>
                    <Syringe size={9} strokeWidth={3} /> Chuyển mổ
                </span>
            );
        }
        return null;
    };

    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden flex flex-col h-full">
            
            {/* HEADER: Gradient Xanh da trời (Đậm -> Sáng) */}
            <div className="bg-gradient-to-r from-blue-700 via-blue-500 to-sky-400 px-4 py-3.5 sticky top-0 z-20 shadow-sm">
                <h2 className="font-bold text-white text-lg uppercase tracking-tight leading-none">
                    {filterTitle}
                </h2>
                <p className="text-blue-100 text-[11px] mt-1 font-medium">
                    Tổng số: {patients.length} hồ sơ
                </p>
            </div>

            {/* TABLE */}
            <div className="overflow-y-auto flex-1 custom-scrollbar bg-white">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50 sticky top-0 z-10 text-gray-500 border-b border-gray-100">
                        <tr>
                            <th className="px-2 py-2 text-[10px] font-bold uppercase w-8 text-center bg-gray-50">STT</th>
                            <th className="px-2 py-2 text-[10px] font-bold uppercase w-[45%] bg-gray-50">Tên / Trạng thái</th>
                            <th className="px-2 py-2 text-[10px] font-bold uppercase bg-gray-50">Chẩn đoán</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {patients.length > 0 ? (
                            patients.map((patient, index) => (
                                <tr 
                                    key={patient.id}
                                    onClick={() => onPatientClick(patient.id)}
                                    // Hiệu ứng hover nhẹ màu xanh
                                    className="hover:bg-blue-50/60 active:bg-blue-100 transition-colors cursor-pointer"
                                >
                                    {/* STT */}
                                    <td className="px-2 py-2.5 text-xs font-medium text-gray-400 text-center align-top pt-3">
                                        {index + 1}
                                    </td>

                                    {/* TÊN + TUỔI + TAG */}
                                    <td className="px-2 py-2.5 align-top">
                                        <div className="flex flex-col justify-start">
                                            {/* Dòng 1: Tên + (TuổiT) */}
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-sm font-bold text-slate-800 leading-tight">
                                                    {patient.fullName}
                                                </span>
                                                <span className="text-xs text-gray-500 font-normal">
                                                    ({patient.age}T)
                                                </span>
                                            </div>
                                            
                                            {/* Dòng 2: Tag ưu tiên (Nằm ngay dưới tên) */}
                                            {renderPriorityTag(patient)}
                                        </div>
                                    </td>

                                    {/* CHẨN ĐOÁN */}
                                    <td className="px-2 py-2.5 align-top">
                                        <p className="text-[11px] text-gray-600 leading-snug line-clamp-3 mt-0.5">
                                            {patient.diagnosis || "-"}
                                        </p>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3} className="text-center py-10 text-gray-300 text-sm italic">
                                    Danh sách trống
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PatientTableView;