import React, { useState, useEffect } from 'react';
import { fetchSettings, saveSettings, getDefaultSettings } from '../services/api';
// Giả định SettingsPayload bao gồm các trường sheetUrl và surgerySheetUrl
import { SettingsPayload } from '../services/sheetMapping'; 
import { Trash2, Plus, User, Building, Home, Activity, List, Syringe, Save, RefreshCw, AlertCircle, Link, ChevronRight, ChevronDown } from 'lucide-react';

// Định nghĩa kiểu dữ liệu nội bộ để tránh phụ thuộc file types bên ngoài nếu chưa có
interface WardConfig {
    id: string;
    name: string;
    rooms: string[];
}

interface SettingsViewProps {
    onSettingsSaved?: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onSettingsSaved }) => {
    // State lưu toàn bộ cài đặt
    const [settings, setSettings] = useState<SettingsPayload>(getDefaultSettings());
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Inputs state
    const [newDoctor, setNewDoctor] = useState('');
    const [newBlockName, setNewBlockName] = useState('');
    const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
    const [newRoomNumber, setNewRoomNumber] = useState('');
    
    // State quản lý input cho các mục cấu hình danh sách (generic)
    const [configInputs, setConfigInputs] = useState<{[key: string]: string}>({});
    const [activeConfigTab, setActiveConfigTab] = useState<string | null>(null);

    // --- 1. Tải dữ liệu khi mở trang ---
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const data = await fetchSettings();
                // Đảm bảo data không bị null/undefined các trường mảng và URL
                setSettings({
                    doctors: data.doctors || [],
                    wards: data.wards || [],
                    operatingRooms: data.operatingRooms || [],
                    anesthesiaMethods: data.anesthesiaMethods || [],
                    surgeryClassifications: data.surgeryClassifications || [],
                    surgeryRequirements: data.surgeryRequirements || [],
                    // ✅ LƯU Ý: Phải đảm bảo data trả về có các trường này để tránh lỗi
                    sheetUrl: data.sheetUrl || '', 
                    surgerySheetUrl: data.surgerySheetUrl || '',
                    hospitalSyncUrl: data.hospitalSyncUrl || '',
                });
            } catch (err) {
                console.error("Lỗi tải cài đặt:", err);
                setError("Không thể tải cài đặt. Vui lòng kiểm tra kết nối mạng.");
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    // --- 2. Hàm Lưu chung ---
    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            await saveSettings(settings);
            if (onSettingsSaved) onSettingsSaved();
            alert('✅ Đã lưu cài đặt thành công!');
        } catch (err) {
            console.error("Lỗi lưu cài đặt:", err);
            setError("Lưu thất bại. Vui lòng thử lại.");
        } finally {
            setIsSaving(false);
        }
    };

    // Helper cập nhật state settings (Dùng cho cả URL và List)
    const updateField = (field: keyof SettingsPayload, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    // --- 3. Logic xử lý Bác sĩ ---
    const handleAddDoctor = () => {
        if (newDoctor.trim()) {
            updateField('doctors', [...settings.doctors, newDoctor.trim()]);
            setNewDoctor('');
        }
    };
    const handleRemoveDoctor = (idx: number) => {
        const next = [...settings.doctors];
        next.splice(idx, 1);
        updateField('doctors', next);
    };

    // --- 4. Logic xử lý Khu vực (Wards) & Phòng ---
    const wards = (settings.wards as unknown as WardConfig[]) || [];

    const handleAddWard = () => {
        if (newBlockName.trim()) {
            const newWard: WardConfig = {
                id: Date.now().toString(),
                name: newBlockName.trim(),
                rooms: []
            };
            updateField('wards', [...wards, newWard]);
            setNewBlockName('');
        }
    };

    const handleRemoveWard = (id: string) => {
        if (window.confirm('Bạn có chắc muốn xóa khu vực này?')) {
            updateField('wards', wards.filter(w => w.id !== id));
        }
    };

    const handleAddRoom = (wardId: string) => {
        if (!newRoomNumber.trim()) return;
        const nextWards = wards.map(w => {
            if (w.id === wardId) {
                const currentRooms = w.rooms || [];
                if (!currentRooms.includes(newRoomNumber.trim())) {
                    return { ...w, rooms: [...currentRooms, newRoomNumber.trim()].sort() };
                }
            }
            return w;
        });
        updateField('wards', nextWards);
        setNewRoomNumber('');
    };

    const handleRemoveRoom = (wardId: string, room: string) => {
        const nextWards = wards.map(w => {
            if (w.id === wardId) {
                return { ...w, rooms: (w.rooms || []).filter(r => r !== room) };
            }
            return w;
        });
        updateField('wards', nextWards);
    };

    // --- 5. Logic xử lý các danh sách cấu hình khác (Generic) ---
    const renderConfigSection = (
        fieldKey: keyof SettingsPayload,
        title: string,
        icon: React.ReactNode,
        placeholder: string,
        colorClass: string
    ) => {
        const list = (settings[fieldKey] as string[]) || [];
        const isActive = activeConfigTab === fieldKey;
        const inputValue = configInputs[fieldKey] || '';

        const onAdd = () => {
            if (inputValue.trim()) {
                updateField(fieldKey, [...list, inputValue.trim()]);
                setConfigInputs(prev => ({ ...prev, [fieldKey]: '' }));
            }
        };

        const onRemove = (idx: number) => {
            const next = [...list];
            next.splice(idx, 1);
            updateField(fieldKey, next);
        };

        return (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-3">
                <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 select-none transition-colors"
                    onClick={() => setActiveConfigTab(isActive ? null : fieldKey)}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${colorClass} bg-opacity-20`}>{icon}</div>
                        <h3 className="font-bold text-slate-800">{title}</h3>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{list.length}</span>
                    </div>
                    {isActive ? <ChevronDown size={20} className="text-gray-400"/> : <ChevronRight size={20} className="text-gray-400"/>}
                </div>
                
                {isActive && (
                    <div className="p-4 border-t border-gray-100 animate-in slide-in-from-top-2 bg-gray-50/30">
                        <div className="flex gap-2 mb-3">
                            <input 
                                type="text" 
                                value={inputValue}
                                onChange={(e) => setConfigInputs(prev => ({ ...prev, [fieldKey]: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && onAdd()}
                                placeholder={placeholder}
                                className="flex-1 bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            <button onClick={onAdd} disabled={!inputValue.trim()} className="bg-slate-700 text-white px-3.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm">
                                <Plus size={20} />
                            </button>
                        </div>
                        
                        {list.length === 0 ? (
                            <div className="text-center py-4 text-gray-400 text-sm italic">Chưa có dữ liệu</div>
                        ) : (
                            <ul className="space-y-1">
                                {list.map((item, idx) => (
                                    <li key={idx} className="flex justify-between items-center bg-white border border-gray-100 p-2.5 rounded-lg group hover:border-blue-200 transition-colors">
                                        <span className="text-slate-700 text-sm font-medium pl-1">{item}</span>
                                        <button onClick={() => onRemove(idx)} className="text-gray-300 hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                                            <Trash2 size={16} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // --- Render Giao Diện ---

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                <RefreshCw className="animate-spin" size={32}/>
                <p>Đang tải dữ liệu...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 text-center text-red-500 bg-red-50 rounded-2xl border border-red-100 m-4">
                <AlertCircle className="mx-auto mb-2" size={32}/>
                <p className="font-bold">{error}</p>
                <button onClick={() => window.location.reload()} className="mt-4 text-sm underline hover:text-red-700">Tải lại trang</button>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto pb-24 px-2">
            {/* Header Sticky */}
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md py-4 mb-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 pl-2">Cài Đặt Hệ Thống</h2>
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-70"
                >
                    {isSaving ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18}/>}
                    {isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
            </div>

            {/* --- 0. Khu vực Cấu hình Link Đồng Bộ (PHẦN BỔ SUNG QUAN TRỌNG) --- */}
            <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-200 space-y-4 mb-6">
                <h3 className="font-bold text-lg text-orange-800 flex items-center gap-2">
                    <Link size={20} className="text-orange-600"/> Cấu Hình Link Đồng Bộ
                </h3>
                
                {/* 0.1. Link Sheet Chính (Gốc) */}
                <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Link Google Sheet Dữ liệu Chính</label>
                    <input
                        type="url"
                        // ✅ Lấy dữ liệu từ state settings
                        value={settings.sheetUrl || ''} 
                        // ✅ Cập nhật state bằng updateField
                        onChange={(e) => updateField('sheetUrl' as keyof SettingsPayload, e.target.value)}
                        className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                        placeholder="Dán URL Google Sheet chính tại đây..."
                    />
                </div>
                
                {/* 0.2. Link Sheet Lịch Mổ (Link cần thiết để sync) */}
                <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                        Link Google Sheet Lịch Mổ Khoa <span className="text-red-500 font-extrabold">(Đích đến của dữ liệu PT)</span>
                    </label>
                    <input
                        type="url"
                        // ✅ Lấy dữ liệu từ state settings
                        value={settings.surgerySheetUrl || ''} 
                        // ✅ Cập nhật state bằng updateField
                        onChange={(e) => updateField('surgerySheetUrl' as keyof SettingsPayload, e.target.value)}
                        className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                        placeholder="Dán URL Lịch Mổ Khoa tại đây..."
                    />
                </div>

                {/* 0.3. Link Web App Đồng bộ BV */}
                <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                        Link Web App Đồng bộ lên BV <span className="text-blue-600 font-extrabold">(Trigger duyệt mổ)</span>
                    </label>
                    <input
                        type="url"
                        value={settings.hospitalSyncUrl || ''}
                        onChange={(e) => updateField('hospitalSyncUrl' as keyof SettingsPayload, e.target.value)}
                        className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="URL Apps Script gửi dữ liệu sang BV"
                    />
                    <p className="text-xs text-gray-500 mt-1">Dùng chung URL này cho nút "Đồng bộ lên BV" trong app và trigger tự động 20h.</p>
                </div>
            </div>

            {/* 1. Quản lý Bác sĩ */}
            <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden mb-6">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                    <div className="bg-blue-100 p-1.5 rounded-lg text-blue-700"><User size={20} /></div>
                    <h3 className="font-bold text-slate-800">Danh Sách Bác Sĩ</h3>
                </div>
                <div className="p-5">
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text" 
                            value={newDoctor}
                            onChange={(e) => setNewDoctor(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddDoctor()}
                            placeholder="Thêm BS (VD: BS. Hùng)"
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button onClick={handleAddDoctor} disabled={!newDoctor.trim()} className="bg-blue-600 text-white px-4 rounded-xl hover:bg-blue-700 shadow-md active:scale-95 transition-all disabled:opacity-50">
                            <Plus size={22} />
                        </button>
                    </div>
                    <ul className="max-h-60 overflow-y-auto space-y-1 pr-1">
                        {settings.doctors.map((doc, idx) => (
                            <li key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-transparent hover:border-gray-200 hover:shadow-sm transition-all group">
                                <span className="text-slate-700 font-medium pl-1">{doc}</span>
                                <button onClick={() => handleRemoveDoctor(idx)} className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100">
                                    <Trash2 size={18} />
                                </button>
                            </li>
                        ))}
                        {settings.doctors.length === 0 && <p className="text-gray-400 text-sm italic text-center py-2">Danh sách trống</p>}
                    </ul>
                </div>
            </div>

            {/* 2. Quản lý Khu vực & Phòng */}
            <div className="bg-white rounded-2xl shadow-soft border border-gray-100 overflow-hidden mb-8">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                    <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-700"><Building size={20} /></div>
                    <h3 className="font-bold text-slate-800">Khu Vực & Phòng</h3>
                </div>
                <div className="p-5">
                    <div className="flex gap-2 mb-6">
                        <input 
                            type="text" 
                            value={newBlockName}
                            onChange={(e) => setNewBlockName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddWard()}
                            placeholder="Tên Khu (VD: Khu A)"
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button onClick={handleAddWard} disabled={!newBlockName.trim()} className="bg-indigo-500 text-white px-4 rounded-xl hover:bg-indigo-600 shadow-md active:scale-95 transition-all disabled:opacity-50 whitespace-nowrap">
                            <Plus size={20} /> Thêm Khu
                        </button>
                    </div>

                    <div className="space-y-3">
                        {wards.map((ward) => (
                            <div key={ward.id} className="border border-gray-100 rounded-xl overflow-hidden transition-all hover:border-indigo-200 hover:shadow-sm">
                                <div 
                                    className="bg-white p-4 flex justify-between items-center cursor-pointer select-none"
                                    onClick={() => setExpandedBlockId(expandedBlockId === ward.id ? null : ward.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        {expandedBlockId === ward.id ? <ChevronDown size={20} className="text-indigo-500"/> : <ChevronRight size={20} className="text-gray-400"/>}
                                        <span className="font-bold text-slate-800">{ward.name}</span>
                                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md font-bold">{(ward.rooms || []).length} phòng</span>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleRemoveWard(ward.id); }}
                                        className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>

                                {expandedBlockId === ward.id && (
                                    <div className="p-4 bg-gray-50/50 border-t border-gray-100 animate-in slide-in-from-top-2">
                                        <div className="flex gap-2 mb-3">
                                            <input 
                                                type="text" 
                                                value={newRoomNumber}
                                                onChange={(e) => setNewRoomNumber(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleAddRoom(ward.id)}
                                                placeholder="Số phòng (VD: 101)"
                                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <button onClick={(e) => { e.stopPropagation(); handleAddRoom(ward.id); }} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-200 whitespace-nowrap">
                                                Thêm
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {(ward.rooms && ward.rooms.length > 0) ? ward.rooms.map(room => (
                                                <div key={room} className="flex items-center gap-1 bg-white border border-gray-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm shadow-sm">
                                                    <Home size={14} className="text-gray-400"/>
                                                    <span className="font-medium">{room}</span>
                                                    <button onClick={() => handleRemoveRoom(ward.id, room)} className="ml-1.5 text-gray-300 hover:text-red-500 transition-colors">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )) : <span className="text-xs text-gray-400 italic pl-1">Chưa có phòng</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                        {wards.length === 0 && <div className="text-center py-6 text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">Chưa có khu vực nào</div>}
                    </div>
                </div>
            </div>

            {/* 3. Cấu hình Lịch mổ & Khác */}
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider pl-2 mb-3 mt-8">Cấu hình Lịch Mổ</h3>
            <div className="space-y-1">
                {renderConfigSection('operatingRooms', "Danh sách Phòng Mổ", <Home size={20} className="text-orange-600"/>, "VD: Phòng 1...", "bg-orange-100 text-orange-700")}
                {renderConfigSection('anesthesiaMethods', "Phương pháp Vô cảm", <Syringe size={20} className="text-blue-600"/>, "VD: Mê nội khí quản...", "bg-blue-100 text-blue-700")}
                {renderConfigSection('surgeryClassifications', "Phân loại Phẫu thuật", <Activity size={20} className="text-purple-600"/>, "VD: Loại I...", "bg-purple-100 text-purple-700")}
                {renderConfigSection('surgeryRequirements', "Yêu cầu Dụng cụ", <List size={20} className="text-emerald-600"/>, "VD: C-Arm...", "bg-emerald-100 text-emerald-700")}
            </div>
        </div>
    );
};

export default SettingsView;
