
import React, { useState, useMemo, useEffect } from 'react';
import { RoomBlock } from '../types';
import { X, ArrowRightLeft, LogOut } from 'lucide-react';

interface TransferModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'TRANSFER' | 'DISCHARGE';
    patientName: string;
    rooms: RoomBlock[];
    currentRoomId: string;
    onConfirm: (targetRoomId?: string, targetRoomNumber?: string, notes?: string, date?: string) => void;
}

const TransferModal: React.FC<TransferModalProps> = ({ 
    isOpen, onClose, mode, patientName, rooms, currentRoomId, onConfirm 
}) => {
    const [targetRoomId, setTargetRoomId] = useState(rooms[0]?.id || '');
    const [targetRoomNumber, setTargetRoomNumber] = useState('');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Update target room ID default when rooms change or open
    useEffect(() => {
        if (isOpen && rooms.length > 0 && !targetRoomId) {
            setTargetRoomId(rooms.filter(r => r.id !== currentRoomId)[0]?.id || rooms[0].id);
        }
    }, [isOpen, rooms, currentRoomId, targetRoomId]);

    // Calculate available rooms based on selected target block
    const availableRooms = useMemo(() => {
        const block = rooms.find(r => r.id === targetRoomId);
        if (!block) return [];
        // Combine defined rooms and existing patient rooms
        const existingRooms = block.patients.map(p => p.roomNumber);
        const defined = block.definedRooms || [];
        const unique = Array.from(new Set([...defined, ...existingRooms])).sort();
        return unique;
    }, [rooms, targetRoomId]);

    // Reset room number when block changes
    useEffect(() => {
        if (availableRooms.length > 0) {
            setTargetRoomNumber(availableRooms[0]);
        } else {
            setTargetRoomNumber('');
        }
    }, [availableRooms]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        onConfirm(
            mode === 'TRANSFER' ? targetRoomId : undefined, 
            mode === 'TRANSFER' ? targetRoomNumber : undefined,
            notes, 
            date
        );
        setNotes('');
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden ring-1 ring-black/5">
                <div className={`p-5 flex justify-between items-center text-white ${mode === 'TRANSFER' ? 'bg-gradient-to-r from-medical-500 to-medical-600' : 'bg-gradient-to-r from-slate-700 to-slate-800'}`}>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        {mode === 'TRANSFER' ? <ArrowRightLeft size={22}/> : <LogOut size={22}/>}
                        {mode === 'TRANSFER' ? 'Chuyển Phòng' : 'Cho Ra Viện'}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
                </div>
                
                <div className="p-6 space-y-5">
                    <p className="text-sm text-slate-500">
                        Thực hiện cho bệnh nhân: <span className="font-bold text-slate-800 block mt-1 text-xl">{patientName}</span>
                    </p>

                    {mode === 'TRANSFER' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wide">Chuyển đến Khu/Nhà</label>
                                <select 
                                    value={targetRoomId}
                                    onChange={(e) => setTargetRoomId(e.target.value)}
                                    className="w-full border-transparent bg-gray-50 rounded-xl p-3.5 focus:ring-2 focus:ring-medical-500 outline-none font-medium"
                                >
                                    {rooms.filter(r => r.id !== currentRoomId).map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                    {rooms.filter(r => r.id !== currentRoomId).length === 0 && (
                                         <option value="">Không có khu vực khác</option>
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wide">Chuyển đến Phòng</label>
                                <div className="relative">
                                    {availableRooms.length > 0 ? (
                                        <select
                                            className="w-full border-transparent bg-gray-50 rounded-xl p-3.5 focus:ring-2 focus:ring-medical-500 outline-none font-bold"
                                            value={targetRoomNumber}
                                            onChange={(e) => setTargetRoomNumber(e.target.value)}
                                        >
                                            <option value="" disabled>Chọn phòng</option>
                                            {availableRooms.map(r => (
                                                <option key={r} value={r}>{r}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input 
                                            type="text" 
                                            value={targetRoomNumber}
                                            onChange={(e) => setTargetRoomNumber(e.target.value)}
                                            className="w-full border-transparent bg-gray-50 rounded-xl p-3.5 focus:ring-2 focus:ring-medical-500 outline-none font-bold"
                                            placeholder="Nhập hoặc chọn số phòng"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-3 tracking-wide">Ngày ra viện (Dự kiến/Chính thức)</label>
                            <input 
                                type="date" 
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-xl p-3 focus:ring-2 focus:ring-gray-500 outline-none font-bold text-slate-800 text-center shadow-sm"
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-2 tracking-wide">Ghi chú</label>
                        <textarea 
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="w-full border-transparent bg-gray-50 rounded-xl p-3.5 focus:ring-2 focus:ring-medical-500 outline-none"
                            placeholder={mode === 'TRANSFER' ? "Lý do chuyển..." : "Tình trạng khi về, lời dặn..."}
                        />
                    </div>

                    <button 
                        onClick={handleSubmit}
                        className={`w-full py-3.5 rounded-2xl text-white font-bold shadow-lg active:scale-95 transition-all text-lg ${mode === 'TRANSFER' ? 'bg-medical-500 hover:bg-medical-600 shadow-medical-500/30' : 'bg-slate-700 hover:bg-slate-800 shadow-slate-700/30'}`}
                    >
                        Xác Nhận
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TransferModal;
