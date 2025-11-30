import React from 'react';
import { Patient, OrderStatus, OrderType } from '../types';
import { AlertCircle, LogOut, Syringe } from 'lucide-react';

interface PatientTableViewProps {
    patients: Patient[];
    filterTitle: string;
    onPatientClick: (id: string) => void;
}

const PatientTableView: React.FC<PatientTableViewProps> = ({ patients, filterTitle, onPatientClick }) => {
    const today = new Date();
    const todayStr = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0')
    ].join('-');

    const normalizeDateString = (dateStr?: string): string => {
        if (!dateStr) return '';
        const target = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
        return target;
    };
    
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

    const getTodayOrders = (patient: Patient) => {
        const orders = Array.isArray(patient.orders) ? patient.orders : [];
        return orders.filter(order => {
            if (order.status !== OrderStatus.PENDING) return false;
            if (order.type === OrderType.DISCHARGE) return false;
            const execDate = normalizeDateString(order.executionDate || order.createdDate);
            return execDate === todayStr;
        });
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
                            <th className="px-2 py-2 text-[10px] font-bold uppercase bg-gray-50 w-[28%]">Y lệnh hôm nay</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {patients.length > 0 ? (
                            patients.map((patient, index) => {
                                const todayOrders = getTodayOrders(patient);
                                return (
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
                                    <td className="px-2 py-2.5 align-top">
                                        {todayOrders.length === 0 ? (
                                            <span className="text-[11px] text-gray-400">Không có</span>
                                        ) : (
                                            <div className="space-y-1">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-100">
                                                    {todayOrders.length} y lệnh
                                                </span>
                                                <ul className="text-[11px] text-gray-600 space-y-1">
                                                    {todayOrders.slice(0, 2).map(order => (
                                                        <li key={order.id} className="line-clamp-2">
                                                            • {order.content || 'Y lệnh'}
                                                        </li>
                                                    ))}
                                                </ul>
                                                {todayOrders.length > 2 && (
                                                    <span className="text-[10px] text-gray-400">
                                                        +{todayOrders.length - 2} y lệnh khác
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={4} className="text-center py-10 text-gray-300 text-sm italic">
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
