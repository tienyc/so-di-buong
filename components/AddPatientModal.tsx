import React, { useState, useMemo } from 'react';
import { Patient, PatientStatus, RoomBlock } from '../types';
import { X, Plus, Sparkles, Loader2, PenTool, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { parsePatientInput } from '../services/geminiService';

interface AddPatientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddPatients: (patients: Patient[], targetBlockId?: string) => void;
    rooms: RoomBlock[]; // Needed for dropdown
}

const AddPatientModal: React.FC<AddPatientModalProps> = ({ isOpen, onClose, onAddPatients, rooms }) => {
    const [activeTab, setActiveTab] = useState<'MANUAL' | 'AI'>('MANUAL');
    const [isProcessing, setIsProcessing] = useState(false);
    const [aiPreview, setAiPreview] = useState<Patient[] | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    
    // AI State
    const [importText, setImportText] = useState('');

    // Manual State
    const [manualForm, setManualForm] = useState<Partial<Patient> & { selectedBlockId?: string }>({
        gender: 'Nam',
        age: 0,
        admissionDate: new Date().toISOString().split('T')[0],
        status: PatientStatus.ACTIVE,
        isSevere: false,
        selectedBlockId: rooms[0]?.id
    });

    const availableRooms = useMemo(() => {
        const block = rooms.find(r => r.id === manualForm.selectedBlockId);
        if (!block) return [];
        const existingRooms = Array.from(new Set(block.patients.map(p => p.roomNumber))).sort();
        return existingRooms;
    }, [manualForm.selectedBlockId, rooms]);

    if (!isOpen) return null;

    const handleManualChange = (field: string, value: any) => {
        setManualForm(prev => ({ ...prev, [field]: value }));
    };

    const changeAdmissionDate = (days: number) => {
        const date = new Date(manualForm.admissionDate || new Date());
        date.setDate(date.getDate() + days);
        handleManualChange('admissionDate', date.toISOString().split('T')[0]);
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualForm.fullName || !manualForm.roomNumber || !manualForm.selectedBlockId) return;

        const assignedBlock = rooms.find(r => r.id === manualForm.selectedBlockId);
        const wardName = assignedBlock?.name || 'Chưa xác định';

        const newPatient: Patient = {
            id: Math.random().toString(36).substr(2, 9),
            fullName: manualForm.fullName!,
            age: manualForm.age || 0,
            gender: manualForm.gender || 'Nam',
            roomNumber: manualForm.roomNumber!,
            bedNumber: '', // Removed from UI
            admissionDate: manualForm.admissionDate || new Date().toISOString().split('T')[0],
            roomEntryDate: new Date().toISOString().split('T')[0], // Set entry date to today
            diagnosis: manualForm.diagnosis || 'Chưa có chẩn đoán',
            historySummary: manualForm.historySummary || 'Bệnh mới vào',
            orders: [],
            isScheduledForSurgery: false,
            status: PatientStatus.ACTIVE,
            isSevere: manualForm.isSevere || false,
            ward: wardName
        };

        onAddPatients([newPatient], manualForm.selectedBlockId); 
        
        setManualForm({ 
            gender: 'Nam', 
            age: 0, 
            admissionDate: new Date().toISOString().split('T')[0], 
            status: PatientStatus.ACTIVE, 
            isSevere: false,
            selectedBlockId: rooms[0]?.id
        });
        onClose();
    };

    const FALLBACK_WARD = 'Cấp cứu 1';
    const FALLBACK_ROOM = 'Cấp cứu 1';

    const handleAIImport = async () => {
        if (!importText.trim()) return;
        setIsProcessing(true);
        const parsedPatients = await parsePatientInput(importText);
        
        if (parsedPatients && parsedPatients.length > 0) {
            const baseWard = rooms[0]?.name || 'Chưa xác định';
            const newPatients: Patient[] = parsedPatients.map((p: any) => ({
                id: Math.random().toString(36).substr(2, 9),
                fullName: p.fullName,
                age: p.age || 0,
                gender: 'Nam',
                roomNumber: p.roomNumber || FALLBACK_ROOM,
                bedNumber: '',
                admissionDate: p.admissionDate || new Date().toISOString().split('T')[0],
                roomEntryDate: p.roomEntryDate || new Date().toISOString().split('T')[0],
                diagnosis: p.diagnosis || 'Chưa có chẩn đoán',
                historySummary: p.historySummary || 'Chưa có thông tin chi tiết',
                orders: [],
                isScheduledForSurgery: false,
                status: PatientStatus.ACTIVE,
                isSevere: false,
                ward: p.ward || baseWard || FALLBACK_WARD
            }));
            setAiPreview(newPatients);
            setAiError(null);
        }
        setIsProcessing(false);
    };

    const handleAcceptAi = () => {
        if (!aiPreview?.length) return;
        onAddPatients(aiPreview);
        setAiPreview(null);
        setImportText('');
        onClose();
    };

    const handleEditManually = () => {
        if (!aiPreview?.length) return;

        // Take the first patient from AI preview and populate manual form
        const firstPatient = aiPreview[0];
        const targetBlock = rooms.find(r => r.name === firstPatient.ward) || rooms[0];

        setManualForm({
            fullName: firstPatient.fullName,
            age: firstPatient.age,
            gender: firstPatient.gender,
            roomNumber: firstPatient.roomNumber,
            diagnosis: firstPatient.diagnosis,
            historySummary: firstPatient.historySummary,
            admissionDate: firstPatient.admissionDate,
            isSevere: firstPatient.isSevere,
            status: firstPatient.status,
            selectedBlockId: targetBlock?.id
        });

        // Clear AI state and switch to manual tab
        setAiPreview(null);
        setImportText('');
        setActiveTab('MANUAL');
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in zoom-in-95 duration-200">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-black/5">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                        <div className="bg-medical-100 p-1.5 rounded-lg text-medical-600"><Plus size={20}/></div> Thêm Bệnh Nhân
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><X size={20} className="text-gray-400"/></button>
                </div>
                
                {/* Tabs Segmented Control */}
                <div className="p-4 pb-0">
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button 
                            onClick={() => setActiveTab('MANUAL')}
                            className={`flex-1 py-2 text-sm font-bold flex items-center justify-center gap-2 rounded-lg transition-all shadow-sm ${activeTab === 'MANUAL' ? 'bg-white text-medical-600 shadow' : 'text-gray-500 hover:text-gray-700 shadow-none'}`}
                        >
                            <PenTool size={16}/> Nhập Thủ Công
                        </button>
                        <button 
                            onClick={() => setActiveTab('AI')}
                            className={`flex-1 py-2 text-sm font-bold flex items-center justify-center gap-2 rounded-lg transition-all shadow-sm ${activeTab === 'AI' ? 'bg-white text-medical-600 shadow' : 'text-gray-500 hover:text-gray-700 shadow-none'}`}
                        >
                            <Sparkles size={16}/> Quét Nhanh (AI)
                        </button>
                    </div>
                </div>

                <div className="p-5 overflow-y-auto">
                    {activeTab === 'MANUAL' ? (
                        <form onSubmit={handleManualSubmit} className="space-y-5">
                            
                            {/* Severe Toggle - Prominent at TOP */}
                             <div 
                                className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-colors ${manualForm.isSevere ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                onClick={() => handleManualChange('isSevere', !manualForm.isSevere)}
                            >
                                <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors ${manualForm.isSevere ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-gray-300'}`}>
                                    {manualForm.isSevere && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                                </div>
                                <span className={`font-bold text-sm ${manualForm.isSevere ? 'text-red-700' : 'text-slate-700'}`}>
                                    Bệnh nhân nặng (Theo dõi sát)
                                </span>
                            </div>

                            {/* Name & Age Row */}
                            <div className="flex gap-4">
                                <div className="flex-[3]">
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2 tracking-wide">Họ tên *</label>
                                    <input required type="text" className="w-full bg-gray-50 border-transparent p-3.5 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-medical-500 transition-all font-bold text-lg text-slate-800" 
                                        value={manualForm.fullName || ''} onChange={e => handleManualChange('fullName', e.target.value)} />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2 tracking-wide">Tuổi</label>
                                    <input type="number" className="w-full bg-gray-50 border-transparent p-3.5 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-medical-500 text-center font-bold text-lg"
                                        value={manualForm.age || ''} onChange={e => handleManualChange('age', parseInt(e.target.value))} />
                                </div>
                            </div>
                            
                            {/* Zone and Room Selection */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2 tracking-wide">Chọn Khu/Nhà *</label>
                                    <select 
                                        className="w-full bg-gray-50 border-transparent p-3.5 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-medical-500 font-bold text-slate-700"
                                        value={manualForm.selectedBlockId}
                                        onChange={e => handleManualChange('selectedBlockId', e.target.value)}
                                    >
                                        {rooms.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2 tracking-wide">Phòng *</label>
                                <div className="relative">
                                    {availableRooms.length > 0 ? (
                                        <select
                                            required
                                            className="w-full bg-gray-50 border-transparent p-3.5 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-medical-500 font-bold text-slate-700"
                                            value={manualForm.roomNumber || ''}
                                            onChange={e => handleManualChange('roomNumber', e.target.value)}
                                        >
                                            <option value="" disabled>Chọn phòng...</option>
                                            {availableRooms.map(room => (
                                                <option key={room} value={room}>{room}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input 
                                            required 
                                            type="text" 
                                            className="w-full bg-gray-50 border-transparent p-3.5 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-medical-500 font-bold text-slate-700"
                                            value={manualForm.roomNumber || ''} 
                                            onChange={e => handleManualChange('roomNumber', e.target.value)} 
                                            placeholder="Số phòng..."
                                        />
                                    )}
                                </div>
                                </div>
                            </div>

                            {/* Admission Date - High Prominence as requested */}
                            <div className="bg-medical-50 p-5 rounded-2xl border-2 border-medical-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                                    <Calendar size={60} className="text-medical-500"/>
                                </div>
                                <label className="block text-xs font-bold text-medical-700 uppercase mb-3 tracking-wide flex items-center gap-2">
                                    <Calendar size={14}/> Ngày vào viện
                                </label>
                                <div className="flex items-center gap-3 relative z-10">
                                    <button type="button" onClick={() => changeAdmissionDate(-1)} className="p-3 bg-white shadow-sm border border-medical-200 rounded-xl hover:bg-medical-100 active:scale-95 transition-all">
                                        <ChevronLeft size={22} className="text-medical-700"/>
                                    </button>
                                    <div className="relative flex-1">
                                        <input 
                                            type="date" 
                                            value={manualForm.admissionDate}
                                            onChange={(e) => handleManualChange('admissionDate', e.target.value)}
                                            className="w-full bg-white border-2 border-medical-500 rounded-xl p-3 text-center text-xl font-extrabold text-slate-800 shadow-sm focus:ring-4 focus:ring-medical-500/30 outline-none"
                                        />
                                    </div>
                                    <button type="button" onClick={() => changeAdmissionDate(1)} className="p-3 bg-white shadow-sm border border-medical-200 rounded-xl hover:bg-medical-100 active:scale-95 transition-all">
                                        <ChevronRight size={22} className="text-medical-700"/>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-2 tracking-wide">Chẩn đoán sơ bộ</label>
                                <textarea className="w-full bg-gray-50 border-transparent p-3.5 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-medical-500 text-slate-700 font-medium" rows={2}
                                    value={manualForm.diagnosis || ''} onChange={e => handleManualChange('diagnosis', e.target.value)} />
                            </div>

                            <button type="submit" className="w-full bg-medical-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-medical-600 mt-2 shadow-xl shadow-medical-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all">
                                <Plus size={24} className="inline"/> Tạo Hồ Sơ Bệnh Án
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                                <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                                    💡 <span className="font-bold">Mẹo:</span> Copy tin nhắn bàn giao hoặc chụp ảnh danh sách bệnh nhân (Text Scan) rồi dán vào đây. AI sẽ tự động tách tên, tuổi, chẩn đoán.
                                </p>
                            </div>
                    <textarea 
                        className="w-full bg-gray-50 border-transparent rounded-2xl p-4 h-48 focus:bg-white focus:ring-2 focus:ring-medical-500 outline-none text-sm leading-relaxed"
                        placeholder="VD: 1. Nguyễn Văn A, 50t, Viêm phổi. Khu B3, P301..."
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                    />
                    {aiPreview && (
                        <div className="mt-4 bg-white rounded-2xl border border-blue-100 p-4 space-y-3">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-sm text-blue-700">Dự đoán từ AI</h4>
                                <button onClick={() => setAiPreview(null)} className="text-xs text-blue-500">Đóng</button>
                            </div>
                            {aiPreview.map(p => (
                                <div key={p.id} className="text-sm text-slate-600">
                                    <div className="font-semibold text-slate-800">{p.fullName}</div>
                                    <div className="text-xs text-slate-500">{p.age} tuổi · {p.diagnosis}</div>
                                    <div className="text-xs text-slate-500">Khu: {p.ward} · Phòng: {p.roomNumber}</div>
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <button type="button" onClick={handleAcceptAi} className="flex-1 bg-blue-500 text-white rounded-xl py-2 text-sm font-bold">Chấp nhận</button>
                                <button type="button" onClick={handleEditManually} className="flex-1 bg-gray-100 rounded-xl py-2 text-sm font-bold text-slate-600 hover:bg-gray-200 transition-colors">Chỉnh tay</button>
                            </div>
                        </div>
                    )}
                            <button 
                                onClick={handleAIImport} 
                                disabled={isProcessing || !importText.trim()}
                                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 rounded-2xl hover:opacity-90 flex items-center justify-center gap-2 font-bold disabled:opacity-50 shadow-lg shadow-indigo-500/30 active:scale-95 transition-all"
                            >
                                {isProcessing ? <Loader2 className="animate-spin" size={20}/> : <Sparkles size={20}/>}
                                Phân tích & Tạo Danh Sách
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddPatientModal;
