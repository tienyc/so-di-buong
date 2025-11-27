
import React, { useState } from 'react';
import { OrderType, MedicalOrder, OrderStatus } from '../types';
import { X, Plus, ChevronLeft, ChevronRight, Calendar, LogOut } from 'lucide-react';

interface OrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddOrder: (order: Omit<MedicalOrder, 'id'>, isDischargeOrder?: boolean, dischargeDate?: string) => void;
    patientName: string;
    doctors: string[]; 
}

const OrderModal: React.FC<OrderModalProps> = ({ isOpen, onClose, onAddOrder, patientName }) => {
    const [content, setContent] = useState('');
    const [executionDate, setExecutionDate] = useState(new Date().toISOString().split('T')[0]);
    const [isDischarge, setIsDischarge] = useState(false);

    if (!isOpen) return null;

    const changeDate = (days: number) => {
        const date = new Date(executionDate);
        date.setDate(date.getDate() + days);
        setExecutionDate(date.toISOString().split('T')[0]);
    };

    const formatDateVN = (isoDate: string) => {
        if (!isoDate) return '';
        const [y, m, d] = isoDate.split('-');
        return `${d}/${m}/${y}`;
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        let finalContent = content;
        let type = OrderType.CARE;

        if (isDischarge) {
            type = OrderType.DISCHARGE;
            finalContent = content.trim() ? `Dự kiến ra viện: ${content}` : 'Dự kiến ra viện';
        }

        onAddOrder({
            type: type, 
            content: finalContent,
            createdDate: new Date().toISOString(),
            executionDate: new Date(executionDate).toISOString(),
            status: OrderStatus.PENDING,
            doctorName: 'Y lệnh' 
        }, isDischarge, executionDate);
        
        setContent('');
        setIsDischarge(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-black/5 scale-100">
                <div className="p-5 flex justify-between items-center border-b border-gray-100">
                    <div>
                        <h3 className="font-bold text-xl text-slate-800 leading-tight">Ra Y Lệnh Mới</h3>
                        <p className="text-sm text-slate-500 font-medium">{patientName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"><X size={20} className="text-gray-500"/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
                    
                    {/* Discharge Toggle - iOS Style Switch */}
                    <div
                        onClick={() => setIsDischarge(!isDischarge)}
                        className={`group flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all duration-300 ${isDischarge ? 'bg-sky-500 border-sky-600 text-white shadow-lg shadow-sky-500/30' : 'bg-gray-50 border-gray-100 hover:bg-gray-100 hover:border-gray-200'}`}
                    >
                        <span className="font-bold flex items-center gap-3 text-lg">
                            <div className={`p-2 rounded-xl transition-colors ${isDischarge ? 'bg-white/20' : 'bg-white shadow-sm'}`}>
                                <LogOut size={20} className={isDischarge ? 'text-white' : 'text-slate-500'} />
                            </div>
                            Dự Kiến Ra Viện
                        </span>

                        <div className={`w-12 h-7 rounded-full relative transition-colors duration-300 ${isDischarge ? 'bg-green-500' : 'bg-gray-300'}`}>
                            <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${isDischarge ? 'left-6' : 'left-1'}`}></div>
                        </div>
                    </div>

                    {/* Date Picker - Compact with Quick Actions */}
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                            {isDischarge ? 'Ngày Ra Viện (Dự kiến)' : 'Ngày thực hiện'}
                        </label>
                        <div className="flex items-center gap-2 mb-2">
                            <button type="button" onClick={() => changeDate(-1)} className="p-2 bg-white shadow-sm border border-gray-200 rounded-lg hover:bg-gray-50 active:scale-95 transition-transform">
                                <ChevronLeft size={18} className="text-gray-600"/>
                            </button>
                            <div className="flex-1 relative group">
                                <input
                                    type="date"
                                    value={executionDate}
                                    onChange={(e) => setExecutionDate(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg p-2 pl-8 text-center font-bold text-base text-slate-900 shadow-sm focus:ring-2 focus:ring-medical-500/50 outline-none transition-all"
                                />
                                <Calendar size={16} className="absolute left-2.5 top-2.5 text-gray-400 group-hover:text-medical-500 transition-colors pointer-events-none"/>
                            </div>
                            <button type="button" onClick={() => changeDate(1)} className="p-2 bg-white shadow-sm border border-gray-200 rounded-lg hover:bg-gray-50 active:scale-95 transition-transform">
                                <ChevronRight size={18} className="text-gray-600"/>
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setExecutionDate(new Date().toISOString().split('T')[0])}
                                className="flex-1 py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-medical-50 hover:border-medical-300 hover:text-medical-700 active:scale-95 transition-all"
                            >
                                Hôm nay
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const tomorrow = new Date();
                                    tomorrow.setDate(tomorrow.getDate() + 1);
                                    setExecutionDate(tomorrow.toISOString().split('T')[0]);
                                }}
                                className="flex-1 py-1.5 px-3 bg-white border border-gray-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 active:scale-95 transition-all"
                            >
                                Ngày mai
                            </button>
                        </div>
                    </div>

                    {/* Content Input */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Nội dung y lệnh {isDischarge && '(Ghi chú thêm)'}</label>
                        <textarea 
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            required={!isDischarge}
                            rows={isDischarge ? 2 : 5}
                            className="w-full bg-gray-50 border-transparent rounded-2xl p-4 focus:bg-white focus:ring-2 focus:ring-medical-500 text-lg shadow-inner placeholder-gray-400 transition-all resize-none text-slate-800"
                            placeholder={isDischarge ? "VD: Ổn định, cho về, kê đơn..." : "Nhập y lệnh..."}
                        />
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-lg shadow-xl active:scale-95 transition-all ${isDischarge ? 'bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/30' : 'bg-medical-500 hover:bg-medical-600 text-white shadow-medical-500/30'}`}
                        >
                            {isDischarge ? <><LogOut size={24}/> Lưu Dự Kiến Ra Viện</> : <><Plus size={24}/> Lưu Y Lệnh</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OrderModal;
