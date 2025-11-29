import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import { X, Save, User, Activity, Clock, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

// --- HELPER FUNCTIONS ---

// Chuyển đổi giờ từ ISO hoặc dạng text sang HH:mm để hiển thị trong input time
const formatSurgeryTimeForInput = (timeStr?: string): string => {
    if (!timeStr) return '';
    try {
        // Nếu đã là HH:mm
        if (timeStr.includes(':') && timeStr.length <= 5 && !timeStr.includes('T')) {
            return timeStr;
        }
        // Nếu là ISO string (2024-11-26T08:30:00.000Z)
        if (timeStr.includes('T')) {
            const date = new Date(timeStr);
            if (isNaN(date.getTime())) return '';
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        }
        return timeStr;
    } catch {
        return '';
    }
};

// Chuẩn hóa ngày về YYYY-MM-DD
const normalizeDateString = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
        // Nếu là ISO string, cắt lấy phần ngày
        if (dateStr.includes('T')) return dateStr.split('T')[0];
        return dateStr;
    } catch { return ''; }
};

interface PatientEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, updates: Partial<Patient>) => void;
    onDelete: (id: string) => Promise<void> | void;
    patient: Patient | null;
    // Config Lists (Cho phép undefined để tránh lỗi crash)
    doctors?: string[];
    operatingRooms?: string[];
    anesthesiaMethods?: string[];
    surgeryClassifications?: string[];
    surgeryRequirements?: string[];
}

const PatientEditModal: React.FC<PatientEditModalProps> = ({
    isOpen, onClose, onSave, onDelete, patient,
    doctors = [], operatingRooms = [], anesthesiaMethods = [], surgeryClassifications = [], surgeryRequirements = []
}) => {
    const [formData, setFormData] = useState<Partial<Patient>>({});

    // Auto-capitalize helper functions
    const capitalizeWords = (text: string): string => {
        return text.toLowerCase().split(' ').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    };

    const capitalizeSentence = (text: string): string => {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    };

    // Reset form khi mở modal hoặc đổi bệnh nhân
    useEffect(() => {
        if (patient) {
            setFormData({
                fullName: patient.fullName || '',
                age: patient.age,
                gender: patient.gender,
                roomNumber: patient.roomNumber || '',
                diagnosis: patient.diagnosis || '',
                historySummary: patient.historySummary || '',                
                admissionDate: normalizeDateString(patient.admissionDate),
                
                // Surgery Fields
                surgeryDate: normalizeDateString(patient.surgeryDate),
                surgeryTime: formatSurgeryTimeForInput(patient.surgeryTime),
                surgeryMethod: patient.surgeryMethod || '',
                surgeonName: patient.surgeonName || '',
                operatingRoom: patient.operatingRoom || '',
                anesthesiaMethod: patient.anesthesiaMethod || '',
                surgeryClassification: patient.surgeryClassification || '',
                surgeryRequirements: patient.surgeryRequirements || '',

                isSevere: patient.isSevere || false,
                dischargeDate: normalizeDateString(patient.dischargeDate),
            });
        }
    }, [patient, isOpen]);

    if (!isOpen || !patient) return null;

    const handleChange = (field: keyof Patient, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // --- FIX LỖI TĂNG GIẢM NGÀY ---
    const changeSurgeryDate = (days: number) => {
        // 1. Lấy ngày hiện tại trong form, nếu không có thì lấy ngày hôm nay
        let dateObj = formData.surgeryDate ? new Date(formData.surgeryDate) : new Date();
        
        // 2. Cộng/Trừ ngày
        dateObj.setDate(dateObj.getDate() + days);

        // 3. Format thủ công YYYY-MM-DD để tránh lệch múi giờ khi dùng toISOString()
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        
        handleChange('surgeryDate', `${y}-${m}-${d}`);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Giữ nguyên logic cũ
        const cleanedData = {
            ...formData,
            surgeryTime: formData.surgeryTime ? formatSurgeryTimeForInput(formData.surgeryTime) : ''
        };
        onSave(patient.id, cleanedData);
        onClose();
    };

    const inputClass = "w-full bg-white border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-medical-500 outline-none text-slate-900 text-sm";
    const labelClass = "block text-[10px] font-bold text-gray-500 uppercase mb-1";

    const handleDelete = async () => {
        if (!patient) return;
        const confirmed = window.confirm(`Xóa bệnh nhân "${patient.fullName}"?`);
        if (!confirmed) return;
        await onDelete(patient.id);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh]">
                
                {/* Header */}
                <div className="bg-slate-800 px-4 py-3 flex justify-between items-center text-white shrink-0">
                    <h3 className="font-bold text-base flex items-center gap-2">
                        <User size={18} /> Sửa Hồ Sơ: {patient.fullName}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
                </div>
                
                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
                    
                    {/* Thông tin hành chính */}
                    <div className="grid grid-cols-1 gap-3">
                         <div>
                            <label className={labelClass}>Họ và tên</label>
                            <input
                                type="text"
                                required
                                value={formData.fullName || ''}
                                onChange={(e) => handleChange('fullName', capitalizeWords(e.target.value))}
                                className={`${inputClass} font-bold`}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                        <div className="col-span-2">
                            <label className={labelClass}>Tuổi</label>
                            <input 
                                type="number" 
                                value={formData.age || ''}
                                onChange={(e) => handleChange('age', parseInt(e.target.value))}
                                className={inputClass}
                            />
                        </div>
                        <div className="col-span-2">
                            <label className={labelClass}>Phòng</label>
                            <input 
                                type="text" 
                                value={formData.roomNumber || ''}
                                onChange={(e) => handleChange('roomNumber', e.target.value)}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Chẩn đoán</label>
                        <textarea
                            rows={2}
                            required
                            value={formData.diagnosis || ''}
                            onChange={(e) => handleChange('diagnosis', capitalizeSentence(e.target.value))}
                            className={inputClass}
                        />
                    </div>
                    
                    {/* Ngày ra viện */}
                    <div>
                        <label className={labelClass}>Dự kiến ra viện</label>
                        <input 
                            type="date" 
                            value={formData.dischargeDate || ''}
                            onChange={(e) => handleChange('dischargeDate', e.target.value)}
                            className={inputClass}
                        />
                    </div>

                    {/* Khu vực Lịch mổ */}
                    <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 space-y-3">
                        <div className="flex items-center gap-2 text-blue-800 font-bold text-xs border-b border-blue-200 pb-1.5 mb-1">
                            <Activity size={14}/> THÔNG TIN PHẪU THUẬT
                        </div>

                        {/* Ngày giờ mổ + Nút tăng giảm */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="col-span-3 sm:col-span-2">
                                <label className={labelClass}>Ngày mổ</label>
                                <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => changeSurgeryDate(-1)} className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 active:scale-95 shrink-0 transition-colors">
                                        <ChevronLeft size={16} className="text-gray-600"/>
                                    </button>
                                    <input 
                                        type="date" 
                                        value={formData.surgeryDate || ''}
                                        onChange={(e) => handleChange('surgeryDate', e.target.value)}
                                        className={`${inputClass} text-center font-bold min-w-0`}
                                    />
                                    <button type="button" onClick={() => changeSurgeryDate(1)} className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 active:scale-95 shrink-0 transition-colors">
                                        <ChevronRight size={16} className="text-gray-600"/>
                                    </button>
                                </div>
                            </div>
                            <div className="col-span-3 sm:col-span-1">
                                <label className={labelClass}>Giờ (Dự kiến)</label>
                                <div className="relative">
                                    <input 
                                        type="time" 
                                        value={formData.surgeryTime || ''}
                                        onChange={(e) => handleChange('surgeryTime', e.target.value)}
                                        className={`${inputClass} pl-8`}
                                    />
                                    <Clock size={14} className="absolute left-2.5 top-2.5 text-gray-400"/>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Phương pháp (Tên mổ)</label>
                            <input
                                type="text"
                                placeholder="VD: Nội soi cắt ruột thừa..."
                                value={formData.surgeryMethod || ''}
                                onChange={(e) => handleChange('surgeryMethod', capitalizeSentence(e.target.value))}
                                className={inputClass}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className={labelClass}>Phẫu thuật viên</label>
                                <select 
                                    value={formData.surgeonName || ''}
                                    onChange={(e) => handleChange('surgeonName', e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">-- Chọn BS --</option>
                                    {doctors.map((d, idx) => <option key={idx} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Phòng mổ</label>
                                <select 
                                    value={formData.operatingRoom || ''}
                                    onChange={(e) => handleChange('operatingRoom', e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">-- Chọn --</option>
                                    {operatingRooms.map((r, idx) => <option key={idx} value={r}>{r}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                             <div>
                                <label className={labelClass}>Vô cảm</label>
                                <select 
                                    value={formData.anesthesiaMethod || ''}
                                    onChange={(e) => handleChange('anesthesiaMethod', e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">-- Chọn --</option>
                                    {anesthesiaMethods.map((m, idx) => <option key={idx} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Phân loại</label>
                                <select 
                                    value={formData.surgeryClassification || ''}
                                    onChange={(e) => handleChange('surgeryClassification', e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">-- Chọn --</option>
                                    {surgeryClassifications.map((c, idx) => <option key={idx} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                         <div>
                            <label className={labelClass}>Yêu cầu dụng cụ</label>
                            <select 
                                value={formData.surgeryRequirements || ''}
                                onChange={(e) => handleChange('surgeryRequirements', e.target.value)}
                                className={inputClass}
                            >
                                <option value="">-- Chọn yêu cầu --</option>
                                {surgeryRequirements.map((r, idx) => <option key={idx} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Diễn biến / Tình trạng</label>
                        <textarea 
                            rows={3}
                            value={formData.historySummary || ''}
                            onChange={(e) => handleChange('historySummary', e.target.value)}
                            className={inputClass}
                        />
                    </div>

                    <div className="pt-2 sticky bottom-0 bg-white pb-2">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                type="button"
                                onClick={handleDelete}
                                className="w-full bg-red-50 text-red-600 py-3 rounded-xl border border-red-200 hover:bg-red-100 flex items-center justify-center gap-2 font-bold active:scale-95 transition-all shadow-sm"
                            >
                                <Trash2 size={18} /> Xóa bệnh nhân
                            </button>
                            <button 
                                type="submit" 
                                className="w-full bg-slate-800 text-white py-3 rounded-xl hover:bg-slate-900 flex items-center justify-center gap-2 font-bold shadow-lg shadow-slate-800/20 active:scale-95 transition-all"
                            >
                                <Save size={18} /> Lưu Thay Đổi
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PatientEditModal;
