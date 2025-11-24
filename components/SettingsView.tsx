
import React, { useState } from 'react';
import { RoomBlock } from '../types';
import { Trash2, Plus, User, Building, Table, ChevronRight, ChevronDown, Home, Activity, List, Syringe } from 'lucide-react';

interface SettingsViewProps {
    doctors: string[];
    onUpdateDoctors: (doctors: string[]) => void;
    rooms: RoomBlock[];
    onUpdateRooms: (rooms: RoomBlock[]) => void;
    sheetUrl?: string;
    onUpdateSheetUrl?: (url: string) => void;
    surgerySheetUrl?: string;
    onUpdateSurgerySheetUrl?: (url: string) => void;
    onConfigChange?: () => void;

    // New Config Props
    operatingRooms?: string[];
    onUpdateOperatingRooms?: (list: string[]) => void;
    anesthesiaMethods?: string[];
    onUpdateAnesthesiaMethods?: (list: string[]) => void;
    surgeryClassifications?: string[];
    onUpdateSurgeryClassifications?: (list: string[]) => void;
    surgeryRequirements?: string[];
    onUpdateSurgeryRequirements?: (list: string[]) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({
    doctors, onUpdateDoctors,
    rooms, onUpdateRooms,
    sheetUrl = '', onUpdateSheetUrl,
    surgerySheetUrl = '', onUpdateSurgerySheetUrl,
    operatingRooms = [], onUpdateOperatingRooms,
    anesthesiaMethods = [], onUpdateAnesthesiaMethods,
    surgeryClassifications = [], onUpdateSurgeryClassifications,
    surgeryRequirements = [], onUpdateSurgeryRequirements,
    onConfigChange
}) => {
    const [newDoctor, setNewDoctor] = useState('');
    const [newBlockName, setNewBlockName] = useState('');
    const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
    const [newRoomNumber, setNewRoomNumber] = useState('');

    // Generic list state helpers
    const [newItemText, setNewItemText] = useState('');
    const [activeConfigTab, setActiveConfigTab] = useState<string | null>(null);
    const notifyConfigChange = () => { onConfigChange && onConfigChange(); };

    const handleAddDoctor = () => {
        if (newDoctor.trim()) {
            onUpdateDoctors([...doctors, newDoctor.trim()]);
            setNewDoctor('');
            notifyConfigChange();
        }
    };

    const handleRemoveDoctor = (index: number) => {
        const newDocs = [...doctors];
        newDocs.splice(index, 1);
        onUpdateDoctors(newDocs);
        notifyConfigChange();
    };

    const handleAddBlock = () => {
        if (newBlockName.trim()) {
            const newBlock: RoomBlock = {
                id: Date.now().toString(),
                name: newBlockName.trim(),
                definedRooms: [],
                patients: []
            };
            onUpdateRooms([...rooms, newBlock]);
            setNewBlockName('');
            notifyConfigChange();
        }
    };

    const handleRemoveBlock = (id: string) => {
        const block = rooms.find(r => r.id === id);
        if (block && block.patients.length > 0) {
            alert('Không thể xóa khu vực đang có bệnh nhân!');
            return;
        }
        if (window.confirm('Bạn có chắc chắn muốn xóa khu vực này?')) {
            onUpdateRooms(rooms.filter(r => r.id !== id));
            notifyConfigChange();
        }
    };

    const handleAddRoomToBlock = (blockId: string) => {
        if (!newRoomNumber.trim()) return;
        const updatedRooms = rooms.map(block => {
            if (block.id === blockId) {
                const currentRooms = block.definedRooms || [];
                if (!currentRooms.includes(newRoomNumber.trim())) {
                    return { ...block, definedRooms: [...currentRooms, newRoomNumber.trim()].sort() };
                }
            }
            return block;
        });
        onUpdateRooms(updatedRooms);
        notifyConfigChange();
        setNewRoomNumber('');
        notifyConfigChange();
    };

    const handleRemoveRoomFromBlock = (blockId: string, roomNum: string) => {
        const updatedRooms = rooms.map(block => {
            if (block.id === blockId) {
                return { ...block, definedRooms: (block.definedRooms || []).filter(r => r !== roomNum) };
            }
            return block;
        });
        onUpdateRooms(updatedRooms);
    };

    // Generic List Handlers
    const handleAddItemToList = (list: string[], updater: (l: string[]) => void) => {
        if (newItemText.trim()) {
            updater([...list, newItemText.trim()]);
            setNewItemText('');
            notifyConfigChange();
        }
    };

    const handleRemoveItemFromList = (list: string[], index: number, updater: (l: string[]) => void) => {
        const newList = [...list];
        newList.splice(index, 1);
        updater(newList);
        notifyConfigChange();
    };

    const renderConfigSection = (
        title: string, 
        icon: React.ReactNode, 
        list: string[], 
        updater?: (l: string[]) => void, 
        placeholder: string = "Nhập nội dung...",
        colorClass: string = "bg-gray-100 text-gray-700"
    ) => {
        if (!updater) return null;
        const isActive = activeConfigTab === title;

        return (
            <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden transition-all">
                <div 
                    className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between cursor-pointer hover:bg-gray-100/50"
                    onClick={() => setActiveConfigTab(isActive ? null : title)}
                >
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${colorClass}`}>{icon}</div>
                        <h3 className="font-bold text-slate-800">{title}</h3>
                    </div>
                    {isActive ? <ChevronDown size={20} className="text-gray-400"/> : <ChevronRight size={20} className="text-gray-400"/>}
                </div>
                
                {isActive && (
                    <div className="p-5 animate-in slide-in-from-top-2">
                         <div className="flex gap-2 mb-4">
                            <input 
                                type="text" 
                                value={newItemText}
                                onChange={(e) => setNewItemText(e.target.value)}
                                placeholder={placeholder}
                                className="flex-1 bg-gray-50 border-transparent rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-slate-400 outline-none"
                            />
                            <button 
                                onClick={() => handleAddItemToList(list, updater)} 
                                className="bg-slate-700 text-white px-4 rounded-xl hover:bg-slate-800 font-bold shadow-md active:scale-95 transition-all"
                            >
                                <Plus size={22} />
                            </button>
                        </div>

                        <ul className="space-y-0 divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
                            {list.map((item, idx) => (
                                <li key={idx} className="flex justify-between items-center bg-white p-3 hover:bg-gray-50 transition-colors">
                                    <span className="text-slate-700 font-medium pl-2">{item}</span>
                                    <button onClick={() => handleRemoveItemFromList(list, idx, updater)} className="text-gray-300 hover:text-red-500 p-2 transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-2xl mx-auto space-y-4 pb-20">
            <h2 className="text-3xl font-bold text-slate-800 px-1 mb-6">Cài Đặt Hệ Thống</h2>

            {/* Google Sheet Config */}
            <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden mb-6">
                 <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                    <div className="bg-green-100 p-1.5 rounded-lg text-green-700"><Table size={20} /></div>
                    <h3 className="font-bold text-slate-800">Liên kết Google Sheet</h3>
                </div>
                <div className="p-5 space-y-4">
                    {/* Main Patient Sheet */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Sheet bệnh nhân (Data chính)</label>
                        <p className="text-xs text-gray-500 mb-2">Dán đường dẫn file Google Sheet quản lý bệnh nhân của bạn.</p>
                        <input
                            type="url"
                            value={sheetUrl}
                            onChange={(e) => onUpdateSheetUrl && onUpdateSheetUrl(e.target.value)}
                            placeholder="https://docs.google.com/spreadsheets/d/..."
                            className="w-full bg-gray-50 border-transparent rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-green-500 outline-none transition-all"
                        />
                    </div>

                    {/* Surgery Sheet for Department */}
                    <div className="pt-4 border-t border-gray-200">
                        <label className="block text-sm font-bold text-slate-700 mb-2">Sheet lịch mổ khoa (Đồng bộ)</label>
                        <p className="text-xs text-gray-500 mb-2">
                            Dán <strong>Web App URL</strong> của Apps Script đã deploy trên sheet lịch mổ khoa.
                            <br />
                            <span className="text-emerald-600 font-semibold">💡 Hướng dẫn:</span> Mở sheet lịch mổ → Extensions → Apps Script → Paste code từ <code className="bg-gray-100 px-1 rounded">docs/SurgerySheetScript.gs</code> → Deploy as Web App → Copy URL
                        </p>
                        <input
                            type="url"
                            value={surgerySheetUrl}
                            onChange={(e) => {
                                onUpdateSurgerySheetUrl && onUpdateSurgerySheetUrl(e.target.value);
                                onConfigChange && onConfigChange();
                            }}
                            placeholder="https://script.google.com/macros/s/..."
                            className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Doctor Management */}
            <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                    <div className="bg-medical-100 p-1.5 rounded-lg text-medical-700"><User size={20} /></div>
                    <h3 className="font-bold text-slate-800">Danh Sách Bác Sĩ</h3>
                </div>
                
                <div className="p-5">
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            value={newDoctor}
                            onChange={(e) => setNewDoctor(e.target.value)}
                            placeholder="Nhập tên bác sĩ (VD: BS. Hùng)"
                            className="flex-1 bg-gray-50 border-transparent rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-medical-500 outline-none"
                        />
                        <button onClick={handleAddDoctor} className="bg-medical-500 text-white px-4 rounded-xl hover:bg-medical-600 font-bold shadow-md shadow-medical-500/20 active:scale-95 transition-all">
                            <Plus size={22} />
                        </button>
                    </div>

                    <ul className="space-y-0 divide-y divide-gray-100 rounded-xl border border-gray-100 overflow-hidden">
                        {doctors.map((doc, idx) => (
                            <li key={idx} className="flex justify-between items-center bg-white p-3 hover:bg-gray-50 transition-colors">
                                <span className="text-slate-700 font-medium pl-2">{doc}</span>
                                <button onClick={() => handleRemoveDoctor(idx)} className="text-gray-300 hover:text-red-500 p-2 transition-colors">
                                    <Trash2 size={18} />
                                </button>
                            </li>
                        ))}
                        {doctors.length === 0 && <p className="text-gray-400 text-sm italic p-4 text-center">Chưa có danh sách bác sĩ.</p>}
                    </ul>
                </div>
            </div>

            {/* Room/Block Management */}
            <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden mb-8">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                    <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-700"><Building size={20} /></div>
                    <h3 className="font-bold text-slate-800">Quản Lý Khu Vực & Phòng</h3>
                </div>

                 <div className="p-5">
                    <div className="flex gap-2 mb-6">
                        <input 
                            type="text" 
                            value={newBlockName}
                            onChange={(e) => setNewBlockName(e.target.value)}
                            placeholder="Tên khu vực (VD: Khu A)"
                            className="flex-1 bg-gray-50 border-transparent rounded-xl p-3 focus:bg-white focus:ring-2 focus:ring-medical-500 outline-none"
                        />
                        <button onClick={handleAddBlock} className="bg-indigo-500 text-white px-5 rounded-xl hover:bg-indigo-600 font-bold shadow-md shadow-indigo-500/20 whitespace-nowrap active:scale-95 transition-all">
                            <Plus size={20} /> Thêm Khu
                        </button>
                    </div>

                    <div className="space-y-3">
                        {rooms.map((block) => (
                            <div key={block.id} className="border border-gray-100 rounded-xl overflow-hidden transition-all hover:border-indigo-100">
                                {/* Block Header */}
                                <div className="bg-white p-4 flex justify-between items-center cursor-pointer hover:bg-gray-50 transition-colors"
                                     onClick={() => setExpandedBlockId(expandedBlockId === block.id ? null : block.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        {expandedBlockId === block.id ? <ChevronDown size={20} className="text-indigo-500"/> : <ChevronRight size={20} className="text-gray-400"/>}
                                        <div>
                                            <span className="text-slate-800 font-bold text-lg">{block.name}</span>
                                            <span className="text-xs font-semibold text-slate-400 ml-2 bg-slate-100 px-2 py-0.5 rounded-full">({block.patients.length} BN)</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleRemoveBlock(block.id); }} 
                                        className="text-gray-300 hover:text-red-500 p-2 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>

                                {/* Rooms List (Expanded) */}
                                {expandedBlockId === block.id && (
                                    <div className="p-4 bg-gray-50/50 border-t border-gray-100 animate-in slide-in-from-top-2">
                                        <div className="flex gap-2 mb-4">
                                            <input 
                                                type="text" 
                                                value={newRoomNumber}
                                                onChange={(e) => setNewRoomNumber(e.target.value)}
                                                placeholder="Thêm số phòng (VD: 101)"
                                                className="w-40 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleAddRoomToBlock(block.id); }}
                                                className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-200"
                                            >
                                                Thêm
                                            </button>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2">
                                            {(block.definedRooms && block.definedRooms.length > 0) ? block.definedRooms.map(roomNum => (
                                                <span key={roomNum} className="inline-flex items-center gap-1 bg-white text-slate-700 px-3 py-1.5 rounded-lg text-sm border border-gray-200 shadow-sm">
                                                    <Home size={14} className="text-gray-400"/> <span className="font-semibold">{roomNum}</span>
                                                    <button onClick={() => handleRemoveRoomFromBlock(block.id, roomNum)} className="hover:text-red-500 ml-1.5 text-gray-300 transition-colors"><Trash2 size={14}/></button>
                                                </span>
                                            )) : (
                                                <p className="text-sm text-gray-400 italic">Chưa có phòng nào được cài đặt trong khu này.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Surgery Configurations */}
            <h3 className="text-lg font-bold text-gray-500 uppercase tracking-wider px-1 mb-3">Cấu hình Lịch Mổ</h3>
            <div className="space-y-3">
                {renderConfigSection("Danh sách Phòng Mổ", <Home size={20}/>, operatingRooms, onUpdateOperatingRooms, "VD: Phòng 1, Phòng Hồi sức...", "bg-orange-100 text-orange-700")}
                {renderConfigSection("Phương pháp Vô cảm", <Syringe size={20}/>, anesthesiaMethods, onUpdateAnesthesiaMethods, "VD: Mê nội khí quản...", "bg-blue-100 text-blue-700")}
                {renderConfigSection("Phân loại Phẫu thuật", <Activity size={20}/>, surgeryClassifications, onUpdateSurgeryClassifications, "VD: Chấn thương, Dịch vụ...", "bg-purple-100 text-purple-700")}
                {renderConfigSection("Yêu cầu Dụng cụ", <List size={20}/>, surgeryRequirements, onUpdateSurgeryRequirements, "VD: Săng đại, C-Arm...", "bg-emerald-100 text-emerald-700")}
            </div>
        </div>
    );
};

export default SettingsView;
