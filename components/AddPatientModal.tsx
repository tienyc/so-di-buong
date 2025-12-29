import React, { useState, useMemo } from 'react';
import { Patient, PatientStatus, RoomBlock } from '../types';
import { X, Plus, Sparkles, Loader2, PenTool, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { parsePatientInput } from '../services/geminiService';
import { WardConfig } from '../services/sheetMapping';

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
    const [isAiManualEditing, setIsAiManualEditing] = useState(false);
    const [aiDraftPatients, setAiDraftPatients] = useState<Patient[]>([]);
    const [aiManualError, setAiManualError] = useState<string | null>(null);

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

    const availableRooms = useMemo(() => {
        const block = rooms.find(r => r.id === manualForm.selectedBlockId);
        if (!block) return [];
        const defined = block.definedRooms || [];
        const existingRooms = block.patients.map(p => p.roomNumber).filter(Boolean);
        return Array.from(new Set([...defined, ...existingRooms])).sort();
    }, [manualForm.selectedBlockId, rooms]);

    const aiWardOptions = useMemo(() => {
        return rooms.map(r => {
            const defined = r.definedRooms || [];
            const patientRooms = r.patients.map(p => p.roomNumber).filter(Boolean);
            const uniqueRooms = Array.from(new Set([...defined, ...patientRooms])).sort();
            return { name: r.name, rooms: uniqueRooms };
        });
    }, [rooms]);

    // ✅ Convert rooms -> WardConfig để truyền vào parsePatientInput
    const wardConfigs = useMemo((): WardConfig[] => {
        return rooms.map(r => ({
            id: r.id,
            name: r.name,
            rooms: r.definedRooms || []
        }));
    }, [rooms]);

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

    const FALLBACK_WARD = 'Tiếp đón';
    const FALLBACK_ROOM = 'Tiếp đón';

    const handleAIImport = async () => {
        if (!importText.trim()) return;
        setIsProcessing(true);
        try {
            // ✅ Truyền wardConfigs để AI sử dụng dynamic settings
            const parsedPatients = await parsePatientInput(importText, wardConfigs);
            
            if (!parsedPatients || parsedPatients.length === 0) {
                setAiPreview(null);
                setAiError('AI không nhận diện được bệnh nhân nào từ đoạn văn bản này. Hãy kiểm tra lại định dạng hoặc thử nhập rõ ràng hơn.');
                return;
            }

            const baseWard = rooms[0]?.name || 'Chưa xác định';
            const newPatients: Patient[] = parsedPatients.map((p: any) => ({
                id: Math.random().toString(36).substr(2, 9),
                fullName: p.fullName,
                age: p.age || 0,
                gender: p.gender || 'Nam',
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
            setAiDraftPatients(newPatients);
            setAiError(null);
            setIsAiManualEditing(false);
            setAiManualError(null);
        } catch (error) {
            console.error('AI import error:', error);
            setAiPreview(null);
            setAiError('Có lỗi khi gọi AI. Vui lòng thử lại sau ít phút.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAcceptAi = () => {
        if (!aiPreview?.length) return;
        onAddPatients(aiPreview);
        setAiPreview(null);
        setAiDraftPatients([]);
        setImportText('');
        setIsAiManualEditing(false);
        setAiManualError(null);
        onClose();
    };

    const handleEditManually = () => {
        if (!aiPreview?.length) return;
        setAiDraftPatients(aiPreview);
        setAiManualError(null);
        setIsAiManualEditing(true);
    };

    const handleAiDraftChange = (index: number, field: keyof Patient | 'ward', value: string | number | boolean) => {
        setAiDraftPatients(prev => {
            const next = [...prev];
            const patient = { ...next[index] };
            if (field === 'ward') {
                patient.ward = value as string;
                const wardRooms = aiWardOptions.find(o => o.name === patient.ward)?.rooms || [];
                if (wardRooms.length > 0 && !wardRooms.includes(patient.roomNumber)) {
                    patient.roomNumber = wardRooms[0];
                }
            } else {
                (patient as any)[field] = value;
            }
            next[index] = patient;
            return next;
        });
    };

    const handleAddDraftPatient = () => {
        const baseWard = aiWardOptions[0]?.name || rooms[0]?.name || FALLBACK_WARD;
        const defaultRoom = aiWardOptions[0]?.rooms?.[0] || FALLBACK_ROOM;
        const newPatient: Patient = {
            id: Math.random().toString(36).substr(2, 9),
            fullName: 'Bệnh nhân mới',
            age: 0,
            gender: 'Nam',
            roomNumber: defaultRoom,
            bedNumber: '',
            admissionDate: new Date().toISOString().split('T')[0],
            roomEntryDate: new Date().toISOString().split('T')[0],
            diagnosis: 'Chưa có chẩn đoán',
            historySummary: 'Chưa có thông tin chi tiết',
            orders: [],
            isScheduledForSurgery: false,
            status: PatientStatus.ACTIVE,
            isSevere: false,
            ward: baseWard,
        };
        setAiDraftPatients(prev => [...prev, newPatient]);
    };

    const handleRemoveDraftPatient = (index: number) => {
        setAiDraftPatients(prev => prev.filter((_, i) => i !== index));
    };

    const handleApplyAiManualEdit = () => {
        if (!aiDraftPatients.length) {
            setAiManualError('Danh sách đang trống. Hãy thêm ít nhất một bệnh nhân.');
            return;
        }
        const cleaned = aiDraftPatients.map((patient, idx) => {
            const wardName = patient.ward || aiWardOptions[0]?.name || rooms[0]?.name || FALLBACK_WARD;
            const wardRooms = aiWardOptions.find(o => o.name === wardName)?.rooms || [];
            const normalizedRoom = wardRooms.length === 0
                ? (patient.roomNumber || FALLBACK_ROOM)
                : (wardRooms.includes(patient.roomNumber) ? patient.roomNumber : wardRooms[0]);
            return {
                ...patient,
                fullName: capitalizeWords(patient.fullName || `Bệnh nhân ${idx + 1}`),
                diagnosis: patient.diagnosis || 'Chưa có chẩn đoán',
                ward: wardName,
                roomNumber: normalizedRoom,
            };
        });
        setAiPreview(cleaned);
        setIsAiManualEditing(false);
        setAiManualError(null);
    };

    const handleCancelAiManualEdit = () => {
        setAiDraftPatients(aiPreview || []);
        setIsAiManualEditing(false);
        setAiManualError(null);
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
                                        value={manualForm.fullName || ''} onChange={e => handleManualChange('fullName', capitalizeWords(e.target.value))} />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2 tracking-wide">Tuổi</label>
                                    <input type="number" className="w-full bg-gray-50 border-transparent p-3.5 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-medical-500 text-center font-bold text-lg"
                                        value={manualForm.age || ''} onChange={e => handleManualChange('age', parseInt(e.target.value))} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-2 tracking-wide">Chẩn đoán sơ bộ</label>
                                <textarea
                                    className="w-full bg-gray-50 border-transparent p-3.5 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-medical-500 text-slate-700 font-medium"
                                    rows={2}
                                    value={manualForm.diagnosis || ''}
                                    onChange={e => handleManualChange('diagnosis', capitalizeSentence(e.target.value))}
                                />
                            </div>
                            
                            {/* Zone and Room Selection */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-2 tracking-wide">Chọn Khu/Nhà *</label>
                                    <select
                                        className="w-full bg-gray-50 border-transparent p-3.5 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-medical-500 font-bold text-slate-700"
                                        value={manualForm.selectedBlockId}
                                        onChange={e => {
                                            handleManualChange('selectedBlockId', e.target.value);
                                            handleManualChange('roomNumber', ''); // Reset room when changing ward
                                        }}
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

                            {/* Admission Date - Compact version */}
                            <div className="bg-medical-50 p-3 rounded-xl border border-medical-100 shadow-sm relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-2 opacity-10 pointer-events-none">
                                    <Calendar size={40} className="text-medical-500"/>
                                </div>
                                <label className="block text-xs font-bold text-medical-700 uppercase mb-2 tracking-wide flex items-center gap-1.5">
                                    <Calendar size={12}/> Ngày vào viện
                                </label>
                                <div className="flex items-center gap-2 relative z-10">
                                    <button type="button" onClick={() => changeAdmissionDate(-1)} className="p-2 bg-white shadow-sm border border-medical-200 rounded-lg hover:bg-medical-100 active:scale-95 transition-all">
                                        <ChevronLeft size={18} className="text-medical-700"/>
                                    </button>
                                    <div className="relative flex-1">
                                        <input
                                            type="date"
                                            value={manualForm.admissionDate}
                                            onChange={(e) => handleManualChange('admissionDate', e.target.value)}
                                            className="w-full bg-white border border-medical-500 rounded-lg p-2 text-center text-base font-bold text-slate-800 shadow-sm focus:ring-2 focus:ring-medical-500/30 outline-none"
                                        />
                                    </div>
                                    <button type="button" onClick={() => changeAdmissionDate(1)} className="p-2 bg-white shadow-sm border border-medical-200 rounded-lg hover:bg-medical-100 active:scale-95 transition-all">
                                        <ChevronRight size={18} className="text-medical-700"/>
                                    </button>
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-medical-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-medical-600 mt-2 shadow-xl shadow-medical-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all">
                                <Plus size={24} className="inline"/> Tạo Hồ Sơ Bệnh Án
                            </button>
                        </form>
                    ) : (
                    <div className="space-y-4">
                            {!isAiManualEditing && (
                                <>
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
                                    {aiError && (
                                        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-2xl p-3">
                                            {aiError}
                                        </div>
                                    )}
                                </>
                            )}
                            {aiPreview && (
                                <div className="mt-4 bg-white rounded-2xl border border-blue-100 p-4 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <h4 className="font-bold text-sm text-blue-700">Dự đoán từ AI</h4>
                                        {isAiManualEditing ? (
                                            <button onClick={handleCancelAiManualEdit} className="text-xs text-blue-500">Thoát chỉnh tay</button>
                                        ) : (
                                            <button onClick={() => setAiPreview(null)} className="text-xs text-blue-500">Đóng</button>
                                        )}
                                    </div>
                                    {isAiManualEditing ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-xs text-slate-500">Chỉnh từng bệnh nhân bằng form nhanh bên dưới.</p>
                                                <button type="button" onClick={handleAddDraftPatient} className="text-xs font-semibold text-blue-600 hover:underline">
                                                    + Thêm bệnh nhân
                                                </button>
                                            </div>
                                            {aiDraftPatients.length === 0 && (
                                                <div className="text-xs text-slate-400 text-center border border-dashed border-blue-200 rounded-xl py-6">
                                                    Chưa có bệnh nhân nào. Bấm “+ Thêm bệnh nhân” để bắt đầu.
                                                </div>
                                            )}
                                            <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                                                {aiDraftPatients.map((patient, idx) => {
                                                    const wardOption = aiWardOptions.find(o => o.name === patient.ward);
                                                    const roomOptions = wardOption?.rooms || [];
                                                    const wardValue = wardOption ? wardOption.name : (aiWardOptions[0]?.name || '');
                                                    const roomValue = roomOptions.length > 0
                                                        ? (roomOptions.includes(patient.roomNumber) ? patient.roomNumber : roomOptions[0])
                                                        : (patient.roomNumber || '');
                                                    return (
                                                    <div key={patient.id} className="border border-blue-100 rounded-2xl p-3 bg-blue-50/50 shadow-sm space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold text-blue-700 uppercase">BN #{idx + 1}</span>
                                                            <button type="button" onClick={() => handleRemoveDraftPatient(idx)} className="text-xs text-red-500 hover:underline">
                                                                Xóa
                                                            </button>
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                                                            <div className="sm:col-span-3">
                                                                <label className="font-semibold text-slate-600 mb-1 block">Họ tên</label>
                                                                <input
                                                                    type="text"
                                                                    value={patient.fullName}
                                                                    onChange={(e) => handleAiDraftChange(idx, 'fullName', e.target.value)}
                                                                    className="w-full border border-blue-200 rounded-lg px-2 py-1.5 text-sm"
                                                                />
                                                            </div>
                                                            <div className="sm:col-span-1">
                                                                <label className="font-semibold text-slate-600 mb-1 block">Tuổi</label>
                                                                <input
                                                                    type="number"
                                                                    value={patient.age}
                                                                    onChange={(e) => handleAiDraftChange(idx, 'age', Number(e.target.value))}
                                                                    className="w-full border border-blue-200 rounded-lg px-2 py-1.5 text-sm"
                                                                />
                                                            </div>
                                                            <div className="sm:col-span-4">
                                                                <label className="font-semibold text-slate-600 mb-1 block">Chẩn đoán</label>
                                                                <input
                                                                    type="text"
                                                                    value={patient.diagnosis || ''}
                                                                    onChange={(e) => handleAiDraftChange(idx, 'diagnosis', e.target.value)}
                                                                    className="w-full border border-blue-200 rounded-lg px-2 py-1.5 text-sm"
                                                                />
                                                            </div>
                                                        <div className="sm:col-span-2">
                                                            <label className="font-semibold text-slate-600 mb-1 block">Khu</label>
                                                            {aiWardOptions.length > 0 ? (
                                                                <select
                                                                    value={wardValue}
                                                                    onChange={(e) => handleAiDraftChange(idx, 'ward', e.target.value)}
                                                                    className="w-full border border-blue-200 rounded-lg px-2 py-1.5 text-sm"
                                                                >
                                                                    <option value="" disabled>Chọn khu...</option>
                                                                    {aiWardOptions.map(opt => (
                                                                        <option key={opt.name} value={opt.name}>{opt.name}</option>
                                                                    ))}
                                                                </select>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    value={patient.ward || ''}
                                                                    onChange={(e) => handleAiDraftChange(idx, 'ward', e.target.value)}
                                                                    className="w-full border border-blue-200 rounded-lg px-2 py-1.5 text-sm"
                                                                />
                                                                )}
                                                            </div>
                                                        <div className="sm:col-span-2">
                                                            <label className="font-semibold text-slate-600 mb-1 block">Phòng</label>
                                                            {roomOptions.length > 0 ? (
                                                                <select
                                                                    value={roomValue}
                                                                    onChange={(e) => handleAiDraftChange(idx, 'roomNumber', e.target.value)}
                                                                    className="w-full border border-blue-200 rounded-lg px-2 py-1.5 text-sm"
                                                                >
                                                                    {roomOptions.map(room => (
                                                                        <option key={room} value={room}>{room}</option>
                                                                    ))}
                                                                </select>
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    value={patient.roomNumber || ''}
                                                                    onChange={(e) => handleAiDraftChange(idx, 'roomNumber', e.target.value)}
                                                                    className="w-full border border-blue-200 rounded-lg px-2 py-1.5 text-sm"
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="font-semibold text-slate-600 mb-1 block">Chẩn đoán</label>
                                                            <input
                                                                type="text"
                                                                value={patient.diagnosis || ''}
                                                                onChange={(e) => handleAiDraftChange(idx, 'diagnosis', e.target.value)}
                                                                className="w-full border border-blue-200 rounded-lg px-2 py-1.5 text-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                                    );
                                                })}
                                            </div>
                                            {aiManualError && (
                                                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl p-2">
                                                    {aiManualError}
                                                </div>
                                            )}
                                            <div className="flex gap-2">
                                                <button type="button" onClick={handleApplyAiManualEdit} className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-sm font-bold">
                                                    Áp dụng danh sách
                                                </button>
                                                <button type="button" onClick={handleCancelAiManualEdit} className="flex-1 bg-gray-100 text-slate-600 rounded-xl py-2 text-sm font-bold hover:bg-gray-200">
                                                    Hủy
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
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
                                        </>
                                    )}
                                </div>
                            )}
                            {!isAiManualEditing && (
                                <button 
                                onClick={handleAIImport} 
                                disabled={isProcessing || !importText.trim()}
                                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-4 rounded-2xl hover:opacity-90 flex items-center justify-center gap-2 font-bold disabled:opacity-50 shadow-lg shadow-indigo-500/30 active:scale-95 transition-all"
                            >
                                {isProcessing ? <Loader2 className="animate-spin" size={20}/> : <Sparkles size={20}/>}
                                Phân tích & Tạo Danh Sách
                            </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddPatientModal;
