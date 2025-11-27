import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import { Loader, X, Edit2 } from 'lucide-react';

type AISuggestion = {
    id: string;
    PPPT: string;
    operatingRoom: string;
    surgeryTime: string;
    surgeonName: string;
};

interface SurgerySchedulerModalProps {
    isOpen: boolean;
    onClose: () => void;
    patients: Patient[];
    suggestedSchedule: AISuggestion[];
    isLoading: boolean;
    onConfirm: (schedule: AISuggestion[]) => void;
}

const SurgerySchedulerModal: React.FC<SurgerySchedulerModalProps> = ({
    isOpen,
    onClose,
    patients,
    suggestedSchedule,
    isLoading,
    onConfirm
}) => {
    const [editableSchedule, setEditableSchedule] = useState<AISuggestion[]>([]);

    useEffect(() => {
        setEditableSchedule(suggestedSchedule);
    }, [suggestedSchedule]);

    if (!isOpen) return null;

    const handleScheduleChange = (id: string, field: keyof AISuggestion, value: string | number) => {
        setEditableSchedule(currentSchedule =>
            currentSchedule.map(item =>
                item.id === id ? { ...item, [field]: value } : item
            )
        );
    };
    
    const handleConfirm = () => {
        onConfirm(editableSchedule);
    };

    const getPatientById = (id: string) => patients.find(p => p.id === id);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
                    <h2 className="font-bold text-lg text-blue-600">Gợi ý và Chỉnh sửa Lịch mổ</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center text-center py-16">
                            <Loader size={40} className="text-blue-500 animate-spin" />
                            <p className="mt-4 text-gray-500 font-medium">AI đang phân tích và xếp lịch...</p>
                            <p className="text-sm text-gray-400">Quá trình này có thể mất vài giây.</p>
                        </div>
                    )}

                    {!isLoading && editableSchedule.length > 0 && (
                        <div className="space-y-4">
                             <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg text-sm mb-6 flex gap-3">
                                <Edit2 size={24} className="shrink-0 mt-0.5"/>
                                <div>
                                    <p className="font-bold">Đây là gợi ý từ AI. Bạn có thể chỉnh sửa trực tiếp các trường thông tin dưới đây trước khi áp dụng.</p>
                                </div>
                            </div>
                            
                            {editableSchedule.map((item, index) => {
                                const patient = getPatientById(item.id);
                                if (!patient) return null;
                                return (
                                    <div key={item.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200/80">
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-lg font-bold text-blue-600">{index + 1}.</span>
                                            <div className="flex-1">
                                                <div className="font-bold text-slate-800">{patient.fullName} <span className="font-normal text-gray-500">({patient.age}T)</span></div>
                                                <div className="text-xs text-gray-600 mt-0.5">{patient.diagnosis}</div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3 mt-4 pl-8">
                                            <div className="col-span-2">
                                                <label className="text-xs font-bold text-gray-500">PP Phẫu thuật</label>
                                                <input type="text" value={item.PPPT} onChange={e => handleScheduleChange(item.id, 'PPPT', e.target.value)} className="w-full text-sm p-2 border border-gray-300 rounded-md mt-1"/>
                                            </div>
                                             <div>
                                                <label className="text-xs font-bold text-gray-500">Phẫu thuật viên</label>
                                                <input type="text" value={item.surgeonName} onChange={e => handleScheduleChange(item.id, 'surgeonName', e.target.value)} className="w-full text-sm p-2 border border-gray-300 rounded-md mt-1"/>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-gray-500">Phòng mổ</label>
                                                <input type="text" value={item.operatingRoom} onChange={e => handleScheduleChange(item.id, 'operatingRoom', e.target.value)} className="w-full text-sm p-2 border border-gray-300 rounded-md mt-1"/>
                                            </div>
                                            <div className="col-span-2 lg:col-span-4">
                                                <label className="text-xs font-bold text-gray-500">Giờ bắt đầu</label>
                                                <input type="time" value={item.surgeryTime} onChange={e => handleScheduleChange(item.id, 'surgeryTime', e.target.value)} className="w-full text-sm p-2 border border-gray-300 rounded-md mt-1"/>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                     {!isLoading && suggestedSchedule.length === 0 && (
                         <div className="text-center py-16 text-gray-400">
                             <p>Không có bệnh nhân nào trong danh sách chờ mổ.</p>
                         </div>
                     )}
                </div>

                <div className="p-4 bg-gray-50 border-t border-gray-200 rounded-b-2xl flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 transition-all"
                    >
                        Đóng
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isLoading || editableSchedule.length === 0}
                        className="px-8 py-2.5 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-all shadow-md"
                    >
                        Áp dụng và Xếp lịch
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SurgerySchedulerModal;