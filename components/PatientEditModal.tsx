import React, { useState, useEffect } from 'react';
import { Patient } from '../types';
import { X, Save, User, Activity, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

// Helper to format surgery time for input[type="time"]
// Converts "1899-12-30T01:53:30.000Z" → "01:53"
const formatSurgeryTimeForInput = (timeStr?: string): string => {
    if (!timeStr) return '';
    try {
        // If it's already in HH:mm format, return as is
        if (timeStr.includes(':') && timeStr.length <= 5 && !timeStr.includes('T')) {
            return timeStr;
        }
        // If it's an ISO datetime string (from Google Sheets)
        if (timeStr.includes('T')) {
            const timePart = timeStr.split('T')[1];
            if (timePart) {
                const timeOnly = timePart.split('.')[0];
                const [hour, minute] = timeOnly.split(':');
                return `${hour}:${minute}`;
            }
        }
        return timeStr;
    } catch {
        return '';
    }
};

/**
 * Normalizes a date string (potentially from Google Sheets) to 'YYYY-MM-DD' format.
 * This avoids timezone issues by only considering the date part.
 * Handles "2024-07-20T17:00:00.000Z" -> "2024-07-20".
 */
const normalizeDateString = (dateStr?: string): string => {
    return dateStr ? dateStr.split('T')[0] : '';
};


interface PatientEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, updates: Partial<Patient>) => void;
    patient: Patient | null;
    // Config Lists
    doctors?: string[];
    operatingRooms?: string[];
    anesthesiaMethods?: string[];
    surgeryClassifications?: string[];
    surgeryRequirements?: string[];
}

const PatientEditModal: React.FC<PatientEditModalProps> = ({ 
    isOpen, onClose, onSave, patient,
    doctors = [], operatingRooms = [], anesthesiaMethods = [], surgeryClassifications = [], surgeryRequirements = []
}) => {
    const [formData, setFormData] = useState<Partial<Patient>>({});

    useEffect(() => {
        if (patient) {
            setFormData({
                fullName: patient.fullName,
                age: patient.age,
                gender: patient.gender,
                roomNumber: patient.roomNumber,
                diagnosis: patient.diagnosis,
                historySummary: patient.historySummary,                
                admissionDate: normalizeDateString(patient.admissionDate),
                
                // Surgery Fields
                surgeryDate: normalizeDateString(patient.surgeryDate),
                surgeryTime: formatSurgeryTimeForInput(patient.surgeryTime),
                surgeryMethod: patient.surgeryMethod,
                surgeonName: patient.surgeonName,
                operatingRoom: patient.operatingRoom,
                anesthesiaMethod: patient.anesthesiaMethod,
                surgeryClassification: patient.surgeryClassification,
                surgeryRequirements: patient.surgeryRequirements,

                isSevere: patient.isSevere || false,
            });
        }
    }, [patient]);

    if (!isOpen || !patient) return null;

    const handleChange = (field: keyof Patient, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const changeSurgeryDate = (days: number) => {
        const current = formData.surgeryDate || new Date().toISOString().split('T')[0];
        const date = new Date(current + 'T00:00:00'); // Add time to avoid timezone shifts on the date itself
        date.setDate(date.getDate() + days);
        handleChange('surgeryDate', date.toISOString().split('T')[0]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // ✅ Ensure surgeryTime is in HH:mm format before saving
        const cleanedData = {
            ...formData,
            surgeryTime: formData.surgeryTime ? formatSurgeryTimeForInput(formData.surgeryTime) : ''
        };

        onSave(patient.id, cleanedData);
        onClose();
    };

    // Generic CSS for inputs to ensure they aren't transparent/black
    const inputClass = "w-full bg-white border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-medical-500 outline-none text-slate-900";

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-slate-800 p-4 flex justify-between items-center text-white shrink-0">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <User size={20} /> Sửa Hồ Sơ / Lên Lịch Mổ
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-5 space-y-5 overflow-y-auto">
                    
                    {/* Removed Severe Toggle as requested */}

                    <div className="grid grid-cols-1 gap-4">
                         <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Họ và tên</label>
                            <input 
                                type="text" 
                                required
                                value={formData.fullName || ''}
                                onChange={(e) => handleChange('fullName', e.target.value)}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tuổi</label>
                            <input 
                                type="number" 
                                value={formData.age || ''}
                                onChange={(e) => handleChange('age', parseInt(e.target.value))}
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phòng</label>
                            <input 
                                type="text" 
                                value={formData.roomNumber || ''}
                                onChange={(e) => handleChange('roomNumber', e.target.value)}
                                className={inputClass}
                            />
                        </div>
                        {/* Bed Number Removed */}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Chẩn đoán</label>
                        <textarea 
                            rows={2}
                            required
                            value={formData.diagnosis || ''}
                            onChange={(e) => handleChange('diagnosis', e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
                        <div className="flex items-center gap-2 text-blue-800 font-bold text-sm border-b border-blue-200 pb-2">
                            <Activity size={16}/> Lên Lịch Phẫu Thuật (Xếp Lịch)
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-3 sm:col-span-2">
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ngày mổ</label>
                                <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => changeSurgeryDate(-1)} className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:scale-95 shrink-0">
                                        <ChevronLeft size={16} className="text-gray-600"/>
                                    </button>
                                    <input 
                                        type="date" 
                                        value={formData.surgeryDate || ''}
                                        onChange={(e) => handleChange('surgeryDate', e.target.value)}
                                        className={`${inputClass} text-center text-sm font-bold min-w-0`}
                                    />
                                    <button type="button" onClick={() => changeSurgeryDate(1)} className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:scale-95 shrink-0">
                                        <ChevronRight size={16} className="text-gray-600"/>
                                    </button>
                                </div>
                            </div>
                            <div className="col-span-3 sm:col-span-1">
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Giờ (Dự kiến)</label>
                                <div className="relative">
                                    <input 
                                        type="time" 
                                        value={formData.surgeryTime || ''}
                                        onChange={(e) => handleChange('surgeryTime', e.target.value)}
                                        className={`${inputClass} text-sm pl-8`}
                                    />
                                    <Clock size={14} className="absolute left-2.5 top-3 text-gray-400"/>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Phương pháp PT (Tên mổ)</label>
                            <input 
                                type="text"
                                placeholder="VD: Nội soi cắt ruột thừa..." 
                                value={formData.surgeryMethod || ''}
                                onChange={(e) => handleChange('surgeryMethod', e.target.value)}
                                className={inputClass}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Phẫu thuật viên</label>
                                <select 
                                    value={formData.surgeonName || ''}
                                    onChange={(e) => handleChange('surgeonName', e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">-- Chọn BS --</option>
                                    {doctors.map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Phòng mổ</label>
                                <select 
                                    value={formData.operatingRoom || ''}
                                    onChange={(e) => handleChange('operatingRoom', e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">-- Chọn --</option>
                                    {operatingRooms.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                             <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">PP Vô cảm</label>
                                <select 
                                    value={formData.anesthesiaMethod || ''}
                                    onChange={(e) => handleChange('anesthesiaMethod', e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">-- Chọn --</option>
                                    {anesthesiaMethods.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Phân loại</label>
                                <select 
                                    value={formData.surgeryClassification || ''}
                                    onChange={(e) => handleChange('surgeryClassification', e.target.value)}
                                    className={inputClass}
                                >
                                    <option value="">-- Chọn --</option>
                                    {surgeryClassifications.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                         <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Yêu cầu dụng cụ</label>
                            <select 
                                value={formData.surgeryRequirements || ''}
                                onChange={(e) => handleChange('surgeryRequirements', e.target.value)}
                                className={inputClass}
                            >
                                <option value="">-- Chọn yêu cầu --</option>
                                {surgeryRequirements.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Diễn biến / Tình trạng</label>
                        <textarea 
                            rows={3}
                            value={formData.historySummary || ''}
                            onChange={(e) => handleChange('historySummary', e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    
                    {/* Admission Date (Optional to keep or remove, user said remove "Bed" and "Severe", but admission date was removed in previous turn from UI) */}

                    <div className="pt-2">
                        <button 
                            type="submit" 
                            className="w-full bg-slate-800 text-white py-3.5 rounded-xl hover:bg-slate-900 flex items-center justify-center gap-2 font-bold shadow-lg shadow-slate-800/20 active:scale-95 transition-all"
                        >
                            <Save size={18} /> Lưu Thay Đổi
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PatientEditModal;