import React, { useState, useEffect, useMemo } from 'react';
import { RoomBlock, Patient, AppView, MedicalOrder, PatientStatus, OrderStatus, SettingsPayload } from './types'; 
import { fetchAllData, savePatient, saveOrder, confirmDischarge, fetchSettings } from './services/api';
import { buildRoomBlocksFromConfig, WardConfig } from './services/sheetMapping';
import { syncSurgeryToKhoa } from './services/surgerySync';
import PatientCard from './components/PatientCard';
import OrderModal from './components/OrderModal';
import TransferModal from './components/TransferModal';
import PatientEditModal from './components/PatientEditModal';
import AddPatientModal from './components/AddPatientModal';
import SettingsView from './components/SettingsView';
import StatisticsView from './components/StatisticsView';
import PatientTableView from './components/PatientTableView'; 
import { Stethoscope, Calendar, LayoutDashboard, Plus, Search, Settings as SettingsIcon, AlertCircle, LogOut, Filter, ChevronDown, ChevronUp, PieChart, Building, RefreshCw, Menu, Table as TableIcon, LayoutGrid, ChevronLeft, ChevronRight, X, CalendarDays } from 'lucide-react';

// --- HELPER FUNCTIONS ---
const removeVietnameseTones = (str: string) => {
    // ... (logic removeVietnameseTones giữ nguyên) ...
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g,"a"); 
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g,"e"); 
    str = str.replace(/ì|í|ị|ỉ|ĩ/g,"i"); 
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g,"o"); 
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g,"u"); 
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g,"y"); 
    str = str.replace(/đ/g,"d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str;
}

const normalizeDateString = (dateStr?: string): string => {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return dateStr.split('T')[0];
    }
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
};

const formatSurgeryTime = (timeStr?: string): string => {
    if (!timeStr || typeof timeStr !== 'string') return '';
    try {
        if (timeStr.includes('h')) return timeStr;
        if (timeStr.includes(':') && timeStr.length <= 5 && !timeStr.includes('T')) return timeStr;
        const date = new Date(timeStr);
        if (isNaN(date.getTime())) return timeStr; 
        return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    } catch { return ''; }
};
// --- END HELPER FUNCTIONS ---

const App: React.FC = () => {
    // --- STATE QUẢN LÝ DỮ LIỆU & CONFIG ---
    const [doctors, setDoctors] = useState<string[]>([]);
    const [operatingRooms, setOperatingRooms] = useState<string[]>([]);
    const [anesthesiaMethods, setAnesthesiaMethods] = useState<string[]>([]);
    const [surgeryClassifications, setSurgeryClassifications] = useState<string[]>([]);
    const [surgeryRequirements, setSurgeryRequirements] = useState<string[]>([]);
    
    const [sheetUrl, setSheetUrl] = useState<string>('');
    const [surgerySheetUrl, setSurgerySheetUrl] = useState<string>('');

    // Main Data
    const [rooms, setRooms] = useState<RoomBlock[]>([]);
    const [wardConfigs, setWardConfigs] = useState<WardConfig[]>([]);

    // UI States
    const [currentView, setCurrentView] = useState<AppView>(AppView.WARD_ROUND);
    const [displayMode, setDisplayMode] = useState<'GRID' | 'TABLE'>('GRID');

    const [isLoadingPatients, setIsLoadingPatients] = useState(true);
    const [apiError, setApiError] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    
    // Filtering
    const [selectedRoomBlockId, setSelectedRoomBlockId] = useState<string>(''); 
    const [selectedRoomNumber, setSelectedRoomNumber] = useState<string>(''); 
    const [admissionDateFilterDate, setAdmissionDateFilterDate] = useState<Date | null>(null); 
    const [searchQuery, setSearchQuery] = useState('');

    // Modals & Menus
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferMode, setTransferMode] = useState<'TRANSFER' | 'DISCHARGE'>('TRANSFER');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);

    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [expandedBlocks, setExpandedBlocks] = useState<{[key: string]: boolean}>({});

    const [surgeryTab, setSurgeryTab] = useState<'WAITING' | 'SCHEDULED'>('WAITING');
    const [expandedSurgeryGroups, setExpandedSurgeryGroups] = useState<{[key: string]: boolean}>({ 'today': true, 'tomorrow': true, 'upcoming': true });
    const [expandedDischargeGroups, setExpandedDischargeGroups] = useState<{[key: string]: boolean}>({ 'today': true, 'tomorrow': true, 'upcoming': true });

    // --- LOGIC: DATE FILTER UI (Tăng/Giảm/Format) ---
    const handleShiftDate = (days: number) => {
        const current = admissionDateFilterDate || new Date(); 
        const nextDate = new Date(current);
        nextDate.setDate(nextDate.getDate() + days);
        setAdmissionDateFilterDate(nextDate);
    };

    const handleClearDate = () => setAdmissionDateFilterDate(null);

    const formatDateDisplay = (date: Date) => {
        return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    };

    // Ref cho date input
    const dateInputRef = React.useRef<HTMLInputElement>(null);


    // --- MAIN DATA LOADING ---
    const loadDataFromSheet = async () => {
        setIsLoadingPatients(true);
        try {
            const settings = await fetchSettings();
            setDoctors(settings.doctors || []);
            setOperatingRooms(settings.operatingRooms || []);
            setAnesthesiaMethods(settings.anesthesiaMethods || []);
            setSurgeryClassifications(settings.surgeryClassifications || []);
            setSurgeryRequirements(settings.surgeryRequirements || []);
            setWardConfigs(settings.wards || []);
            setSheetUrl(settings.sheetUrl || '');
            setSurgerySheetUrl(settings.surgerySheetUrl || '');
            
            const patientsWithOrders = await fetchAllData();
            setRooms(buildRoomBlocksFromConfig(patientsWithOrders, settings.wards || []));
            setApiError(null);
        } catch (error) {
            console.error('Lỗi tải dữ liệu:', error);
            setApiError('Không kết nối được server.');
        } finally {
            setIsLoadingPatients(false);
        }
    };

    useEffect(() => { loadDataFromSheet(); }, []);

    useEffect(() => {
        if (rooms.length > 0 && Object.keys(expandedBlocks).length === 0) {
            const initialExpanded: {[key: string]: boolean} = {};
            rooms.forEach(r => initialExpanded[r.id] = true);
            setExpandedBlocks(initialExpanded);
        }
    }, [rooms]);

    useEffect(() => {
        if (!notification) return;
        const timeout = setTimeout(() => setNotification(null), 3000);
        return () => clearTimeout(timeout);
    }, [notification]);


    // --- DERIVED DATA & ACTION HANDLERS ---
    
    const selectedPatient = useMemo(() => {
        for (const block of rooms) {
            const p = block.patients.find(p => p.id === selectedPatientId);
            if (p) return p;
        }
        return null;
    }, [rooms, selectedPatientId]);

    const selectedPatientName = selectedPatient?.fullName || '';
    const currentBlock = rooms.find(r => r.id === selectedRoomBlockId);
    
    const availableRoomsInBlock = useMemo(() => {
        if (!currentBlock) return [];
        const patientRooms = Array.from(new Set(currentBlock.patients.map(p => p.roomNumber)));
        const defined = currentBlock.definedRooms || [];
        return Array.from(new Set([...defined, ...patientRooms])).sort();
    }, [currentBlock]);

    // FIX LỖI ĐỒNG BỘ: TRUYỀN surgerySheetUrl VÀ XỬ LÝ KẾT QUẢ
    const handleUpdatePatient = async (id: string, updates: Partial<Patient>) => {
        const updatedRooms = rooms.map(block => ({
            ...block,
            patients: block.patients.map(p => p.id === id ? { ...p, ...updates } : p)
        }));
        setRooms(updatedRooms);
        const patient = updatedRooms.flatMap(r => r.patients).find(p => p.id === id);
        
        if (patient) {
            try {
                if (!patient.isScheduledForSurgery && updates.surgeryDate) patient.isScheduledForSurgery = true;
                await savePatient(patient);
                
                const hasSurgeryUpdate = updates.surgeryDate !== undefined || updates.surgeryTime !== undefined || updates.surgeonName !== undefined;
                
                // LOGIC ĐỒNG BỘ MỚI:
                if (hasSurgeryUpdate && patient.surgeryDate && surgerySheetUrl) {
                    const syncResult = await syncSurgeryToKhoa(surgerySheetUrl, patient);
                    
                    if (syncResult.success) {
                         setNotification({ message: syncResult.message || 'Đồng bộ lịch mổ thành công.', type: 'success' });
                    } else {
                         setNotification({ message: `Đồng bộ thất bại: ${syncResult.error || 'Lỗi không xác định'}`, type: 'error' });
                    }
                }
            } catch (err) { 
                setNotification({ message: 'Lỗi lưu thông tin', type: 'error' }); 
            }
        }
    };

    const handleAddPatients = async (newPatients: Patient[]) => {
        try {
            await Promise.all(newPatients.map(p => savePatient(p)));
            setNotification({ message: 'Thêm bệnh nhân thành công', type: 'success' });
            loadDataFromSheet();
            setIsAddPatientModalOpen(false);
        } catch (e) { setNotification({ message: 'Lỗi thêm bệnh nhân', type: 'error' }); }
    };

    const handleAddOrder = async (orderData: Omit<MedicalOrder, 'id'>, isDischarge: boolean, dischargeDate?: string) => {
        if (!selectedPatientId) return;
        const newOrder: MedicalOrder = { ...orderData, id: Math.random().toString(36).substr(2, 9) };
        const updatedRooms = rooms.map(b => ({
            ...b,
            patients: b.patients.map(p => {
                if(p.id === selectedPatientId) {
                    const nextP = { ...p, orders: [newOrder, ...p.orders] };
                    if(isDischarge && dischargeDate) nextP.dischargeDate = dischargeDate;
                    savePatient(nextP);
                    return nextP;
                }
                return p;
            })
        }));
        setRooms(updatedRooms);
        setNotification({ message: 'Đã thêm y lệnh', type: 'success' });
    };

    const handleToggleCompleteOrder = (pid: string, oid: string) => {
        const updatedRooms = rooms.map(b => ({
            ...b,
            patients: b.patients.map(p => {
                if (p.id === pid) {
                    const nextP = {
                        ...p,
                        orders: p.orders.map(o => o.id === oid ? { ...o, status: o.status === OrderStatus.COMPLETED ? OrderStatus.PENDING : OrderStatus.COMPLETED } : o)
                    };
                    savePatient(nextP);
                    return nextP;
                }
                return p;
            })
        }));
        setRooms(updatedRooms);
    };

    const handleRegisterSurgery = (id: string) => handleUpdatePatient(id, { isScheduledForSurgery: true });
    const handleCancelSurgery = (id: string) => handleUpdatePatient(id, { isScheduledForSurgery: false, surgeryDate: '', surgeryTime: '' });

    const handleConfirmDischarge = async (id: string) => {
        if (window.confirm('Xác nhận bệnh nhân đã ra viện?')) {
            try {
                await confirmDischarge(id, new Date().toISOString().split('T')[0]);
                setNotification({ message: 'Đã lưu trữ hồ sơ', type: 'success' });
                loadDataFromSheet();
            } catch { setNotification({ message: 'Lỗi xác nhận ra viện', type: 'error' }); }
        }
    };

    const handleTransferConfirm = async (targetRoomId?: string, targetRoomNumber?: string, notes?: string, date?: string) => {
        if (!selectedPatientId) return;
        if (transferMode === 'TRANSFER' && targetRoomId) {
            const targetBlock = rooms.find(b => b.id === targetRoomId);
            const p = rooms.flatMap(r => r.patients).find(pat => pat.id === selectedPatientId);
            if (p) {
                const updatedP = { ...p, ward: targetBlock?.name || p.ward, roomNumber: targetRoomNumber || p.roomNumber };
                await savePatient(updatedP);
                setNotification({ message: 'Đã chuyển phòng', type: 'success' });
                loadDataFromSheet();
            }
        } else {
             handleUpdatePatient(selectedPatientId, { dischargeDate: date });
        }
    };


    // --- FILTERING ---
    const passesGlobalFilters = (p: Patient) => {
        if (currentView === AppView.WARD_ROUND && p.status === PatientStatus.ARCHIVED) return false;
        if (currentView === AppView.SEVERE_CASES && (!p.isSevere || p.status === PatientStatus.ARCHIVED)) return false;
        if (currentView === AppView.SURGERY_SCHEDULE && (!p.isScheduledForSurgery || p.status === PatientStatus.ARCHIVED)) return false;
        if (currentView === AppView.DISCHARGE_LIST && (!p.dischargeDate || p.status === PatientStatus.ARCHIVED || p.dischargeConfirmed)) return false;

        if (selectedRoomNumber && p.roomNumber !== selectedRoomNumber) return false;
        if (admissionDateFilterDate && p.admissionDate) {
            const filterDate = admissionDateFilterDate.toISOString().split('T')[0];
            const pDate = normalizeDateString(p.admissionDate);
            if (pDate !== filterDate) return false;
        }
        if (searchQuery) {
            const q = removeVietnameseTones(searchQuery.toLowerCase());
            return removeVietnameseTones(p.fullName.toLowerCase()).includes(q) || p.roomNumber.toLowerCase().includes(q);
        }
        return true;
    };

    const filteredPatients = rooms.flatMap(r => {
        if (selectedRoomBlockId && r.id !== selectedRoomBlockId) return [];
        return r.patients;
    }).filter(passesGlobalFilters);

    // Grouping for Surgery
    const { surgeryGroups, unscheduledPatients } = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        const hasDate = (p: Patient) => typeof p.surgeryDate === 'string' && p.surgeryDate.trim() !== '';
        const waiting = filteredPatients.filter(p => !hasDate(p));
        const scheduled = filteredPatients.filter(p => hasDate(p));
        return {
            surgeryGroups: {
                today: scheduled.filter(p => normalizeDateString(p.surgeryDate) === today).sort((a,b) => (a.surgeryTime||'').localeCompare(b.surgeryTime||'')),
                tomorrow: scheduled.filter(p => normalizeDateString(p.surgeryDate) === tomorrow).sort((a,b) => (a.surgeryTime||'').localeCompare(b.surgeryTime||'')),
                upcoming: scheduled.filter(p => normalizeDateString(p.surgeryDate) > tomorrow).sort((a,b) => (a.surgeryDate||'').localeCompare(b.surgeryDate||'')),
            },
            unscheduledPatients: waiting
        };
    }, [filteredPatients]);

    const dischargeGroups = useMemo(() => {
        if (currentView !== AppView.DISCHARGE_LIST) return { today: [], tomorrow: [], upcoming: [] };
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
        return {
            today: filteredPatients.filter(p => normalizeDateString(p.dischargeDate) === today),
            tomorrow: filteredPatients.filter(p => normalizeDateString(p.dischargeDate) === tomorrow),
            upcoming: filteredPatients.filter(p => normalizeDateString(p.dischargeDate) > tomorrow).sort((a,b) => (a.dischargeDate||'').localeCompare(b.dischargeDate||''))
        };
    }, [filteredPatients, currentView]);


    const severeCount = rooms.flatMap(r => r.patients).filter(p => p.isSevere && p.status !== PatientStatus.ARCHIVED).length;
    const surgeryCount = rooms.flatMap(r => r.patients).filter(p => p.isScheduledForSurgery && (!p.surgeryDate || p.surgeryDate === "") && p.status !== PatientStatus.ARCHIVED).length;

    // Số BN ra viện hôm nay
    const dischargeTodayCount = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return rooms.flatMap(r => r.patients).filter(p =>
            p.dischargeDate &&
            normalizeDateString(p.dischargeDate) === today &&
            p.status !== PatientStatus.ARCHIVED &&
            !p.dischargeConfirmed
        ).length;
    }, [rooms]);

    // --- RENDER ---
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm">
                <div className="px-4 py-3 max-w-2xl mx-auto">
                    {/* Dòng 1: Logo, Tên App, Toggle View, Nút hành động */}
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2" onClick={() => setCurrentView(AppView.WARD_ROUND)}>
                                <div className="bg-medical-500 text-white p-2 rounded-xl shadow-glow cursor-pointer">
                                    <Stethoscope size={20} />
                                </div>
                                <h1 className="font-bold text-slate-800 text-lg cursor-pointer">Ngoại CT- Bỏng</h1>
                            </div>

                            {/* Toggle View: 1 nút 2 icon */}
                            {currentView === AppView.WARD_ROUND && (
                                <button
                                    onClick={() => setDisplayMode(displayMode === 'GRID' ? 'TABLE' : 'GRID')}
                                    className="bg-gray-100 p-2 rounded-lg hover:bg-gray-200 transition-colors"
                                    title={displayMode === 'GRID' ? 'Chuyển sang bảng' : 'Chuyển sang thẻ'}
                                >
                                    {displayMode === 'GRID' ? <TableIcon size={18} className="text-slate-600"/> : <LayoutGrid size={18} className="text-slate-600"/>}
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                             <button onClick={loadDataFromSheet} disabled={isLoadingPatients} className="bg-blue-100 text-blue-600 p-2.5 rounded-full hover:bg-blue-200 transition-colors" title="Tải lại dữ liệu">
                                <RefreshCw size={20} className={isLoadingPatients ? 'animate-spin' : ''} />
                            </button>
                            <button onClick={() => setIsAddPatientModalOpen(true)} className="bg-medical-500 text-white p-2.5 rounded-full shadow-lg hover:bg-medical-600 active:scale-95 transition-all" title="Thêm bệnh nhân mới">
                                <Plus size={24} />
                            </button>
                            <div className="relative">
                                <button onClick={() => setShowHamburgerMenu(!showHamburgerMenu)} className="bg-gray-100 text-gray-700 p-2.5 rounded-full hover:bg-gray-200" title="Menu">
                                    <Menu size={20} />
                                </button>
                                {showHamburgerMenu && (
                                    <div className="absolute top-12 right-0 bg-white shadow-xl border border-gray-100 rounded-2xl py-2 w-48 z-50 animate-in fade-in zoom-in-95">
                                        <button onClick={() => { setCurrentView(AppView.STATISTICS); setShowHamburgerMenu(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-3 font-medium">
                                            <PieChart size={18} className="text-purple-500" /> Thống kê
                                        </button>
                                        <button onClick={() => { setCurrentView(AppView.SETTINGS); setShowHamburgerMenu(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-3 font-medium">
                                            <SettingsIcon size={18} className="text-slate-500" /> Cài đặt
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Dòng 2: Search & Filters (Tối giản hơn) */}
                    {currentView !== AppView.SETTINGS && currentView !== AppView.STATISTICS && (
                        <div className="space-y-2.5">
                            
                            {/* DATE FILTER - Luôn hiện < >, nút X riêng */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center bg-gray-100 rounded-lg p-1 h-10 flex-1">
                                    {/* Nút giảm ngày */}
                                    <button onClick={() => handleShiftDate(-1)} className="w-8 h-8 flex items-center justify-center rounded-md bg-white shadow-sm text-gray-600 hover:text-blue-600 active:scale-95 shrink-0">
                                        <ChevronLeft size={18} />
                                    </button>

                                    {/* Khu vực hiển thị ngày - Click để mở calendar */}
                                    <div
                                        className="flex-1 flex items-center justify-center gap-1.5 px-2 text-sm font-bold text-slate-700 relative min-h-[32px] cursor-pointer"
                                        onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.focus()}
                                    >
                                        <input
                                            ref={dateInputRef}
                                            type="date"
                                            value={admissionDateFilterDate ? admissionDateFilterDate.toISOString().split('T')[0] : ''}
                                            onChange={(e) => setAdmissionDateFilterDate(e.target.value ? new Date(e.target.value) : null)}
                                            className="absolute inset-0 opacity-0 pointer-events-none"
                                            title="Chọn ngày vào viện"
                                        />
                                        {admissionDateFilterDate ? (
                                            <>
                                                <CalendarDays size={16} className="text-blue-500 shrink-0" />
                                                <span>{formatDateDisplay(admissionDateFilterDate)}</span>
                                                {/* Nút X nổi */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleClearDate(); }}
                                                    className="ml-1 w-5 h-5 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 active:scale-95 z-20 relative"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-gray-400 font-medium text-xs">Chọn ngày</span>
                                        )}
                                    </div>

                                    {/* Nút tăng ngày */}
                                    <button onClick={() => handleShiftDate(1)} className="w-8 h-8 flex items-center justify-center rounded-md bg-white shadow-sm text-gray-600 hover:text-blue-600 active:scale-95 shrink-0">
                                        <ChevronRight size={18} />
                                    </button>
                                </div>

                                {/* Nút Hôm nay */}
                                <button
                                    onClick={() => setAdmissionDateFilterDate(new Date())}
                                    className="px-3 h-10 bg-blue-500 text-white rounded-lg text-sm font-bold hover:bg-blue-600 active:scale-95 transition-all shrink-0"
                                >
                                    Hôm nay
                                </button>
                            </div>
                            
                            {/* KHU VỰC 2: SEARCH BAR */}
                            <div className="relative group">
                                <input 
                                    type="text" 
                                    placeholder="Tìm tên, số phòng..." 
                                    className="w-full bg-gray-100 border-none rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-medical-500/50 focus:bg-white transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <Search className="absolute left-3.5 top-3 text-gray-400 group-focus-within:text-medical-500" size={18} />
                            </div>

                            {/* KHU VỰC 3: DROPDOWNS */}
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Filter size={14} className="absolute left-3 top-3 text-gray-500 pointer-events-none"/>
                                    <select 
                                        value={selectedRoomBlockId} 
                                        onChange={(e) => { setSelectedRoomBlockId(e.target.value); setSelectedRoomNumber(''); }}
                                        className="w-full bg-white border border-gray-200 text-gray-700 text-sm rounded-xl pl-9 pr-8 py-2.5 appearance-none focus:outline-none focus:border-medical-500 font-medium"
                                    >
                                        <option value="">Tất cả khu vực</option>
                                        {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                    </select>
                                    <ChevronDown size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none"/>
                                </div>
                                <div className="relative w-[35%]">
                                    <select 
                                        value={selectedRoomNumber} 
                                        onChange={(e) => setSelectedRoomNumber(e.target.value)}
                                        disabled={!selectedRoomBlockId}
                                        className={`w-full bg-white border border-gray-200 text-gray-700 text-sm rounded-xl px-3 py-2.5 appearance-none focus:outline-none focus:border-medical-500 font-medium ${!selectedRoomBlockId && 'opacity-60 bg-gray-50'}`}
                                    >
                                        <option value="">Tất cả</option>
                                        {availableRoomsInBlock.map(r => <option key={r} value={r}>P.{r}</option>)}
                                    </select>
                                    <ChevronDown size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none"/>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* Notifications (Giữ nguyên) */}
            {notification && (
                <div className={`mx-4 mt-2 px-4 py-3 text-xs font-bold rounded-xl border flex items-center justify-center shadow-sm animate-in slide-in-from-top-2 ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {notification.message}
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 px-4 pt-4 pb-28 overflow-y-auto max-w-2xl mx-auto w-full">
                
                {currentView === AppView.SETTINGS && <SettingsView onSettingsSaved={loadDataFromSheet} />}
                {currentView === AppView.STATISTICS && <StatisticsView rooms={rooms} />}

                {/* --- LOGIC HIỂN THỊ CHÍNH --- */}
                {currentView !== AppView.SETTINGS && currentView !== AppView.STATISTICS && (
                    <>
                        {/* 1. HIỂN THỊ DẠNG BẢNG (TABLE VIEW) */}
                        {currentView === AppView.WARD_ROUND && displayMode === 'TABLE' ? (
                           <PatientTableView 
                                patients={filteredPatients} 
                                filterTitle={selectedRoomBlockId 
                                    ? `DANH SÁCH BỆNH NHÂN ${rooms.find(r => r.id === selectedRoomBlockId)?.name?.toUpperCase() || ''}`
                                    : "DANH SÁCH BỆNH NHÂN (TẤT CẢ)"}
                                onPatientClick={(id) => { setSelectedPatientId(id); setIsEditModalOpen(true); }}
                            />
                        ) : (
                            // 2. CÁC TRƯỜNG HỢP CÒN LẠI: CARD VIEW
                            <>
                                {/* ... (Logic View Ra viện và Lịch mổ giữ nguyên) ... */}
                                
                                {currentView === AppView.DISCHARGE_LIST && (
                                    <div className="space-y-4">
                                        {filteredPatients.length === 0 ? <div className="text-center py-12 text-gray-400">Không có bệnh nhân ra viện.</div> : (
                                            ['today', 'tomorrow', 'upcoming'].map(key => {
                                                const groupKey = key as keyof typeof dischargeGroups;
                                                const list = dischargeGroups[groupKey];
                                                const label = key === 'today' ? 'Hôm nay' : key === 'tomorrow' ? 'Ngày mai' : 'Sắp tới';
                                                const color = key === 'today' ? 'green' : key === 'tomorrow' ? 'blue' : 'gray';
                                                const isOpen = expandedDischargeGroups[groupKey];

                                                return (
                                                    <div key={key} className={`bg-white/80 backdrop-blur-sm rounded-2xl border border-${color}-200 shadow-soft overflow-hidden`}>
                                                        <div className={`bg-${color}-50/50 p-4 flex justify-between items-center cursor-pointer`} onClick={() => setExpandedDischargeGroups(prev => ({...prev, [key]: !prev[groupKey]}))}>
                                                            <h3 className={`font-bold text-${color}-800 flex items-center gap-2`}><Calendar size={20}/> {label} ({list.length})</h3>
                                                            {isOpen ? <ChevronUp size={20} className={`text-${color}-400`}/> : <ChevronDown size={20} className={`text-${color}-400`}/>}
                                                        </div>
                                                        {isOpen && list.length > 0 && (
                                                            <div className="p-3 space-y-3">
                                                                {list.map(p => <PatientCard key={p.id} patient={p} onAddOrder={() => { setSelectedPatientId(p.id); setIsOrderModalOpen(true); }} onRegisterSurgery={() => handleRegisterSurgery(p.id)} onCancelSurgery={() => handleCancelSurgery(p.id)} onTransfer={() => { setSelectedPatientId(p.id); setTransferMode('TRANSFER'); setIsTransferModalOpen(true); }} onDischarge={() => { setSelectedPatientId(p.id); setTransferMode('DISCHARGE'); setIsTransferModalOpen(true); }} onEdit={() => { setSelectedPatientId(p.id); setIsEditModalOpen(true); }} onConfirmDischarge={handleConfirmDischarge} onCompleteOrder={handleToggleCompleteOrder} onQuickSevereToggle={(id) => handleUpdatePatient(id, { isSevere: !p.isSevere })} />)}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                )}

                                {currentView === AppView.SURGERY_SCHEDULE && (
                                     <div className="space-y-4">
                                        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                                            <button onClick={() => setSurgeryTab('WAITING')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${surgeryTab === 'WAITING' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>Chờ xếp lịch ({unscheduledPatients.length})</button>
                                            <button onClick={() => setSurgeryTab('SCHEDULED')} className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${surgeryTab === 'SCHEDULED' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>Đã lên lịch ({surgeryGroups.today.length + surgeryGroups.tomorrow.length + surgeryGroups.upcoming.length})</button>
                                        </div>
                                        {surgeryTab === 'WAITING' && (
                                             <div className="space-y-3">
                                                {unscheduledPatients.map(p => (
                                                    <div key={p.id} className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex items-center justify-between">
                                                        <div><div className="font-bold text-slate-800">{p.fullName}</div><div className="text-xs text-gray-500">{p.diagnosis}</div></div>
                                                        <button onClick={() => { setSelectedPatientId(p.id); setIsEditModalOpen(true); }} className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md active:scale-95">Xếp lịch</button>
                                                    </div>
                                                ))}
                                                {unscheduledPatients.length === 0 && <div className="text-center text-gray-400 py-8">Không có bệnh nhân chờ.</div>}
                                             </div>
                                        )}
                                        {surgeryTab === 'SCHEDULED' && (
                                            <div className="space-y-6">
                                                {['today', 'tomorrow', 'upcoming'].map(key => {
                                                    const groupKey = key as keyof typeof surgeryGroups;
                                                    const list = surgeryGroups[groupKey];
                                                    const label = key === 'today' ? 'Hôm nay' : key === 'tomorrow' ? 'Ngày mai' : 'Sắp tới';
                                                    const isOpen = expandedSurgeryGroups[groupKey];
                                                    return (
                                                        <div key={key} className="bg-white/80 rounded-2xl border border-orange-100 shadow-soft overflow-hidden">
                                                            <div className="bg-orange-50/50 p-4 flex justify-between items-center cursor-pointer" onClick={() => setExpandedSurgeryGroups(prev => ({...prev, [key]: !prev[groupKey]}))}>
                                                                <h3 className="font-bold text-orange-800 flex items-center gap-2"><Calendar size={20}/> {label} ({list.length})</h3>
                                                                {isOpen ? <ChevronUp size={20} className="text-orange-400"/> : <ChevronDown size={20} className="text-orange-400"/>}
                                                            </div>
                                                            {isOpen && list.length > 0 && (
                                                                <div className="p-3 space-y-3">
                                                                    {list.map(p => (
                                                                         <div key={p.id} className="flex gap-3 bg-white p-3 rounded-xl border border-gray-100 relative">
                                                                             <div className="flex flex-col items-center justify-center w-14 border-r border-gray-100 pr-3"><span className="text-xl font-bold text-orange-500">{formatSurgeryTime(p.surgeryTime) || '--:--'}</span></div>
                                                                             <div className="flex-1"><div className="font-bold text-slate-800">{p.fullName}</div><div className="text-sm text-gray-600">{p.surgeryMethod}</div>{p.surgeonName && <div className="text-xs text-indigo-600 font-bold mt-1">BS: {p.surgeonName}</div>}</div>
                                                                             <button onClick={() => { setSelectedPatientId(p.id); setIsEditModalOpen(true); }} className="absolute bottom-3 right-3 text-xs bg-gray-100 px-2 py-1 rounded font-bold text-gray-500 hover:bg-orange-100 hover:text-orange-600">Sửa</button>
                                                                         </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                     </div>
                                )}

                                {/* --- View: Đi buồng / Bệnh nặng (Dạng Card) --- */}
                                {(currentView === AppView.WARD_ROUND || currentView === AppView.SEVERE_CASES) && (
                                    <div className="space-y-4">
                                        {filteredPatients.length === 0 ? <div className="text-center py-20 text-gray-400">Không tìm thấy bệnh nhân.</div> : (
                                            <>
                                                {selectedRoomBlockId ? (
                                                    filteredPatients.map(p => <PatientCard key={p.id} patient={p} onAddOrder={() => { setSelectedPatientId(p.id); setIsOrderModalOpen(true); }} onRegisterSurgery={() => handleRegisterSurgery(p.id)} onCancelSurgery={() => handleCancelSurgery(p.id)} onTransfer={() => { setSelectedPatientId(p.id); setTransferMode('TRANSFER'); setIsTransferModalOpen(true); }} onDischarge={() => { setSelectedPatientId(p.id); setTransferMode('DISCHARGE'); setIsTransferModalOpen(true); }} onEdit={() => { setSelectedPatientId(p.id); setIsEditModalOpen(true); }} onCompleteOrder={handleToggleCompleteOrder} onQuickSevereToggle={(id) => { const pat = rooms.flatMap(r => r.patients).find(item => item.id === id); if(pat) handleUpdatePatient(id, { isSevere: !p.isSevere }); }} />)
                                                ) : (
                                                    rooms.map(block => {
                                                        const blockPatients = block.patients.filter(passesGlobalFilters);
                                                        if (blockPatients.length === 0) return null;
                                                        
                                                        // Option 1: Khu nhà luôn có gradient xanh - chỉ khác icon mở/đóng
                                                        const isBlockExpanded = expandedBlocks[block.id];
                                                        const blockClass = 'bg-gradient-to-r from-blue-600 to-blue-400 shadow-lg';
                                                        const iconClass = 'text-white';
                                                        const textClass = 'text-white';
                                                        const badgeClass = 'bg-white text-blue-600';
                                                        const chevronClass = 'text-white';

                                                        return (
                                                            <div key={block.id} className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-soft border border-white/50 mb-4 overflow-hidden">
                                                                <div
                                                                    className={`px-5 py-4 flex justify-between items-center cursor-pointer select-none transition-colors ${blockClass}`}
                                                                    onClick={() => setExpandedBlocks(prev => ({...prev, [block.id]: !prev[block.id]}))}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 rounded-xl bg-white/20">
                                                                            <Building size={20} className={iconClass} />
                                                                        </div>
                                                                        <span className={`font-bold text-lg ${textClass}`}>{block.name}</span>
                                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeClass}`}>{blockPatients.length}</span>
                                                                    </div>
                                                                    {isBlockExpanded ? <ChevronUp size={20} className={chevronClass}/> : <ChevronDown size={20} className={chevronClass}/>}
                                                                </div>

                                                                {expandedBlocks[block.id] && (
                                                                    <div className="px-3 pb-3 pt-0">
                                                                        {blockPatients.map(p => <PatientCard key={p.id} patient={p} onAddOrder={() => { setSelectedPatientId(p.id); setIsOrderModalOpen(true); }} onRegisterSurgery={() => handleRegisterSurgery(p.id)} onCancelSurgery={() => handleCancelSurgery(p.id)} onTransfer={() => { setSelectedPatientId(p.id); setTransferMode('TRANSFER'); setIsTransferModalOpen(true); }} onDischarge={() => { setSelectedPatientId(p.id); setTransferMode('DISCHARGE'); setIsTransferModalOpen(true); }} onEdit={() => { setSelectedPatientId(p.id); setIsEditModalOpen(true); }} onCompleteOrder={handleToggleCompleteOrder} onQuickSevereToggle={(id) => handleUpdatePatient(id, { isSevere: !p.isSevere })} />)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 inset-x-0 flex justify-center z-40 pb-6 animate-in slide-in-from-bottom-4 fade-in duration-500">
                <div className="bg-white/90 backdrop-blur-2xl rounded-full flex justify-around items-center h-[72px] mx-4 px-4 shadow-2xl ring-1 ring-black/5 max-w-2xl w-full transition-all">
                    {[ { id: AppView.WARD_ROUND, icon: LayoutDashboard, label: 'Đi buồng', color: 'medical' }, { id: AppView.SEVERE_CASES, icon: AlertCircle, label: 'Nặng', color: 'red', count: severeCount }, { id: AppView.SURGERY_SCHEDULE, icon: Calendar, label: 'Lịch mổ', color: 'blue', count: surgeryCount }, { id: AppView.DISCHARGE_LIST, icon: LogOut, label: 'Ra viện', color: 'green', count: dischargeTodayCount } ].map(item => (
                        <button key={item.id} onClick={() => setCurrentView(item.id)} className={`group flex flex-col items-center gap-1.5 w-full h-full justify-center active:scale-95 transition-all ${currentView === item.id ? `text-${item.color}-600` : 'text-slate-500 hover:text-slate-700'}`}>
                            <div className={`p-1 rounded-xl relative ${currentView === item.id ? `bg-${item.color}-50` : ''}`}>
                                <item.icon size={24} strokeWidth={currentView === item.id ? 2.5 : 2} />
                                {item.count && item.count > 0 && <div className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-${item.color}-500 rounded-full animate-pulse shadow-lg flex items-center justify-center px-1`}><span className="text-white text-[10px] font-extrabold">{item.count}</span></div>}
                            </div>
                            <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
                        </button>
                    ))}
                </div>
            </nav>

            <AddPatientModal isOpen={isAddPatientModalOpen} onClose={() => setIsAddPatientModalOpen(false)} doctors={doctors} onAddPatients={handleAddPatients} rooms={rooms} />
            <OrderModal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} onAddOrder={handleAddOrder} patientName={selectedPatientName} doctors={doctors} />
            <TransferModal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} mode={transferMode} patientName={selectedPatientName} rooms={rooms} currentRoomId={selectedRoomBlockId} onConfirm={handleTransferConfirm} />
            <PatientEditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} patient={selectedPatient} onSave={handleUpdatePatient} doctors={doctors} operatingRooms={operatingRooms} anesthesiaMethods={anesthesiaMethods} surgeryClassifications={surgeryClassifications} surgeryRequirements={surgeryRequirements} />
        </div>
    );
};

export default App;