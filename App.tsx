import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { RoomBlock, Patient, AppView, MedicalOrder, PatientStatus, OrderStatus, OrderType } from './types'; 
import { fetchAllData, savePatient, saveOrder, confirmDischarge, fetchSettings, deletePatient } from './services/api';
import { generateSurgerySchedule } from './services/geminiService';
import { autoScheduleLocally } from './services/localScheduler';
import { buildRoomBlocksFromConfig, WardConfig } from './services/sheetMapping';
import { syncSurgeryToKhoa, triggerHospitalSync } from './services/surgerySync';
import PatientCard from './components/PatientCard';
import OrderModal from './components/OrderModal';
import TransferModal from './components/TransferModal';
import PatientEditModal from './components/PatientEditModal';
import AddPatientModal from './components/AddPatientModal';
import SettingsView from './components/SettingsView';
import StatisticsView from './components/StatisticsView';
import PatientTableView from './components/PatientTableView';
import SurgerySchedulerModal from './components/SurgerySchedulerModal';
import { Stethoscope, Calendar, LayoutDashboard, Plus, Search, Settings as SettingsIcon, AlertCircle, LogOut, Filter, ChevronDown, ChevronUp, PieChart, Building, RefreshCw, Menu, Table as TableIcon, LayoutGrid, ChevronLeft, ChevronRight, X, CalendarDays, Wand2, UploadCloud, FileText, Lightbulb } from 'lucide-react';

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

const getLocalIsoDate = (date: Date) => (
    date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
);
const getTodayString = () => getLocalIsoDate(new Date());

const escapeHtml = (text?: string) => {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

const normalizeDateString = (dateStr?: string): string => {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const baseRaw = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const base = baseRaw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(base)) return base;
    const slashMatch = base.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (slashMatch) {
        const day = slashMatch[1].padStart(2, '0');
        const month = slashMatch[2].padStart(2, '0');
        let year = slashMatch[3];
        if (!year) {
        year = String(new Date().getFullYear());
    } else if (year.length === 2) {
        year = '20' + year;
    }
        return `${year}-${month}-${day}`;
    }
    const parsed = new Date(base);
    if (!isNaN(parsed.getTime())) {
        return getLocalIsoDate(parsed);
    }
    return '';
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

const formatDateVN = (isoDate?: string): string => {
    if (!isoDate) return '';
    const parts = isoDate.split('T')[0].split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return isoDate;
};

const formatDayMonth = (isoDate?: string): string => {
    if (!isoDate) return '--/--';
    const normalized = normalizeDateString(isoDate);
    if (!normalized) return '--/--';
    const [year, month, day] = normalized.split('-');
    return `${day}/${month}`;
};

const roomTagCollator = new Intl.Collator("vi", {
    numeric: true,
    sensitivity: "base",
});

const getPatientRoomTag = (patient: Patient): string => {
    const source = (patient.roomNumber || patient.ward || '').trim();
    if (!source) return '';
    const normalized = source.toLowerCase();

    if (normalized.startsWith('dịch vụ') || normalized.startsWith('dv')) {
        const digits = source.match(/\d+/)?.[0] || '';
        return `DV${digits}`;
    }
    if (normalized.includes('cấp cứu') || normalized.includes('cap cuu')) {
        const digits = source.match(/\d+/)?.[0];
        return digits ? `CC${digits}` : 'CC';
    }
    if (normalized.includes('hậu phẫu') || normalized.includes('hau phau')) return 'HP';
    if (normalized.includes('tiền phẫu') || normalized.includes('tien phau')) return 'TP';
    if (normalized.includes('nhiễm trùng') || normalized.includes('nhiem trung')) return 'N.Trùng';
    if (normalized.includes('tuyến cao') || normalized.includes('tuyen cao') || normalized.includes('trung cao')) return 'Tr.Cao';
    if (normalized.includes('cao tuổi') || normalized.includes('cao tuoi')) return 'C.Tuổi';

    const words = source.replace(/[^a-zA-Z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return source.slice(0, 4).toUpperCase();
    if (words.length === 1) return words[0].slice(0, 6).toUpperCase();
    return words.slice(0, 2).map((w) => (w[0] || '').toUpperCase()).join('');
};

const comparePatientsByRoomTag = (a: Patient, b: Patient): number => {
    const tagA = getPatientRoomTag(a) || 'ZZZ';
    const tagB = getPatientRoomTag(b) || 'ZZZ';
    const primary = roomTagCollator.compare(tagA, tagB);
    if (primary !== 0) return primary;
    const fallbackRoomA = (a.roomNumber || '').toLowerCase();
    const fallbackRoomB = (b.roomNumber || '').toLowerCase();
    if (fallbackRoomA && fallbackRoomB) {
        const second = roomTagCollator.compare(fallbackRoomA, fallbackRoomB);
        if (second !== 0) return second;
    }
    return a.fullName.localeCompare(b.fullName, 'vi', { sensitivity: 'base' });
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
    const [hospitalSyncUrl, setHospitalSyncUrl] = useState<string>('');

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
    const [isSurgerySchedulerModalOpen, setIsSurgerySchedulerModalOpen] = useState(false);
    
    const [isScheduling, setIsScheduling] = useState(false);
    const [suggestedSchedule, setSuggestedSchedule] = useState<any[]>([]);
    const [isHospitalSyncing, setIsHospitalSyncing] = useState(false);
    const [showServiceOnly, setShowServiceOnly] = useState(false);
    const [filtersVisible, setFiltersVisible] = useState(true);
    const [headerHidden, setHeaderHidden] = useState(false);

    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [expandedBlocks, setExpandedBlocks] = useState<{[key: string]: boolean}>({});
    const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

    const [surgeryTab, setSurgeryTab] = useState<'WAITING' | 'SCHEDULED'>('WAITING');
    const [expandedSurgeryGroups, setExpandedSurgeryGroups] = useState<{[key: string]: boolean}>({ 'today': true, 'tomorrow': true, 'upcoming': true });
    const [expandedDischargeGroups, setExpandedDischargeGroups] = useState<{[key: string]: boolean}>({ 'today': true, 'tomorrow': true, 'upcoming': true, 'overdue': true });

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
    const dateInputRef = useRef<HTMLInputElement>(null);
    const scrollMetaRef = useRef({ lastTop: 0 });


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
            setHospitalSyncUrl(settings.hospitalSyncUrl || '');
            
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

    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
            if (scrollTop < 0) return;

            const lastTop = scrollMetaRef.current.lastTop;
            const threshold = 120;
            const showThreshold = 20;
            const velocityThreshold = 10;

            const delta = scrollTop - lastTop;

            if (delta > velocityThreshold && scrollTop > threshold) {
                setHeaderHidden(true);
            } else if (delta < -velocityThreshold && (lastTop - scrollTop) > showThreshold) {
                setHeaderHidden(false);
            } else if (scrollTop <= threshold) {
                setHeaderHidden(false);
            }

            scrollMetaRef.current.lastTop = scrollTop <= 0 ? 0 : scrollTop;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [currentView]);


    // --- DERIVED DATA & ACTION HANDLERS ---
    
    const todayString = useMemo(() => getTodayString(), []);

    const isServiceRoomName = useCallback((room?: string) => {
        if (!room) return false;
        const normalizedRoom = room.trim().toLowerCase();
        const simplifiedRoom = normalizedRoom.replace(/\./g, '').replace(/\s+/g, '');
        return (
            normalizedRoom.startsWith('dịch vụ') ||
            normalizedRoom.startsWith('dv') ||
            normalizedRoom.includes('trung cao') ||
            normalizedRoom.includes('tr.cao') ||
            simplifiedRoom.includes('trcao')
        );
    }, []);

    const isServiceRoomPatient = useCallback((patient: Patient) => {
        return isServiceRoomName(patient.roomNumber);
    }, [isServiceRoomName]);

    const matchesServiceFilter = useCallback((patient: Patient, dateMatch?: string | null) => {
        if (!isServiceRoomPatient(patient)) return false;
        if (!dateMatch) return true;
        return normalizeDateString(patient.admissionDate) === dateMatch;
    }, [isServiceRoomPatient]);

    const isServicePatientToday = useCallback((patient: Patient) => (
        matchesServiceFilter(patient, todayString)
    ), [matchesServiceFilter, todayString]);


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
        } catch (e) { 
            setNotification({ message: 'Lỗi thêm bệnh nhân', type: 'error' }); 
        }
    };

    const handleAddOrder = async (orderData: Omit<MedicalOrder, 'id'>, isDischarge: boolean, dischargeDate?: string) => {
        if (!selectedPatientId) return;

        try {
            const newOrder: MedicalOrder = {
                ...orderData,
                id: Math.random().toString(36).substr(2, 9)
            };

            // Find and update patient
            let updatedPatient: Patient | null = null;
            const updatedRooms = rooms.map(b => ({
                ...b,
                patients: b.patients.map(p => {
                    if(p.id === selectedPatientId) {
                        // Filter out old discharge orders if this is a discharge order (keep only the latest)
                        const existingOrders = isDischarge
                            ? (p.orders || []).filter(o => o.type !== OrderType.DISCHARGE)
                            : (p.orders || []);

                        const nextP = {
                            ...p,
                            orders: [newOrder, ...existingOrders]
                        };
                        if(isDischarge && dischargeDate) {
                            nextP.dischargeDate = dischargeDate;
                            nextP.dischargeConfirmed = false;
                        }
                        updatedPatient = nextP;
                        return nextP;
                    }
                    return p;
                })
            }));

            // Save to Firebase FIRST
            if (updatedPatient) {
                await savePatient(updatedPatient);
            }

            // Then update UI state
            setRooms(updatedRooms);
            await loadDataFromSheet();
            setNotification({ message: 'Đã thêm y lệnh', type: 'success' });
        } catch (error) {
            console.error('Error adding order:', error);
            setNotification({ message: 'Lỗi thêm y lệnh', type: 'error' });
        }
    };

    const handleDeletePatientRecord = async (id: string) => {
        try {
            await deletePatient(id);
            setRooms(prev => prev.map(block => ({
                ...block,
                patients: block.patients.filter(p => p.id !== id)
            })));
            setSelectedPatientId(null);
            setIsEditModalOpen(false);
            setNotification({ message: 'Đã xóa bệnh nhân khỏi danh sách.', type: 'success' });
        } catch (error) {
            console.error('Lỗi xoá bệnh nhân:', error);
            setNotification({ message: 'Không thể xóa bệnh nhân. Vui lòng thử lại.', type: 'error' });
        }
    };

    const handleCleanupDischargedPatients = async (): Promise<string> => {
        const retentionDays = 7;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - retentionDays);

        const toDelete = rooms
            .flatMap(block => block.patients)
            .filter(patient => {
                if (!patient.dischargeConfirmed || !patient.dischargeDate) return false;
                const date = new Date(patient.dischargeDate);
                return !isNaN(date.getTime()) && date < cutoff;
            });

        if (toDelete.length === 0) {
            const msg = 'Không có bệnh nhân ra viện quá 7 ngày.';
            setNotification({ message: msg, type: 'success' });
            return msg;
        }

        try {
            for (const patient of toDelete) {
                await deletePatient(patient.id);
            }

            const removedIds = new Set(toDelete.map(p => p.id));
            setRooms(prev => prev.map(block => ({
                ...block,
                patients: block.patients.filter(p => !removedIds.has(p.id))
            })));

            if (selectedPatientId && removedIds.has(selectedPatientId)) {
                setSelectedPatientId(null);
                setIsEditModalOpen(false);
            }

            const msg = `Đã xóa ${toDelete.length} bệnh nhân ra viện > ${retentionDays} ngày.`;
            setNotification({ message: msg, type: 'success' });
            return msg;
        } catch (error) {
            console.error('Lỗi dọn bệnh nhân ra viện:', error);
            setNotification({ message: 'Không thể xóa dữ liệu cũ. Vui lòng thử lại.', type: 'error' });
            throw error;
        }
    };

    const handleToggleCompleteOrder = (pid: string, oid: string) => {
        const updatedRooms = rooms.map(b => ({
            ...b,
            patients: b.patients.map(p => {
                if (p.id === pid) {
                    const nextP = {
                        ...p,
                        orders: (p.orders || []).map(o => o.id === oid ? { ...o, status: o.status === OrderStatus.COMPLETED ? OrderStatus.PENDING : OrderStatus.COMPLETED } : o)
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
    const handleCancelSurgery = async (id: string) => {
        await handleUpdatePatient(id, {
            isScheduledForSurgery: false,
            isRegisteredForSurgery: false,
            surgeryDate: '',
            surgeryTime: '',
            operatingRoom: '',
            surgeryMethod: '',
            surgeonName: '',
            anesthesiaMethod: '',
            surgeryClassification: '',
            surgeryRequirements: '',
            surgeryNotes: '',
        });
        setNotification({ message: 'Đã hủy đăng ký mổ', type: 'success' });
    };

    const handleConfirmDischarge = async (id: string) => {
        if (window.confirm('Xác nhận bệnh nhân đã ra viện?')) {
            try {
                await confirmDischarge(id, getTodayString());
                setNotification({ message: 'Đã lưu trữ hồ sơ', type: 'success' });
                loadDataFromSheet();
            } catch { setNotification({ message: 'Lỗi xác nhận ra viện', type: 'error' }); }
        }
    };

    // NEW: Cancel discharge (patient stays)
    const handleCancelDischarge = async (id: string) => {
        if (window.confirm('Xác nhận bệnh nhân tiếp tục nằm viện?')) {
            try {
                await handleUpdatePatient(id, { dischargeDate: '', dischargeConfirmed: false });
                setNotification({ message: 'Đã hủy lịch ra viện', type: 'success' });
                await loadDataFromSheet();
            } catch {
                setNotification({ message: 'Lỗi hủy lịch ra viện', type: 'error' });
            }
        }
    };

    // NEW: Batch confirm all discharges in a group
    const handleBatchConfirmDischarges = async (patients: Patient[]) => {
        const count = patients.length;
        if (window.confirm(`Xác nhận ${count} bệnh nhân đã ra viện?`)) {
            try {
                await Promise.all(
                    patients.map(p =>
                        confirmDischarge(p.id, p.dischargeDate || getTodayString())
                    )
                );
                setNotification({
                    message: `Đã xác nhận ${count} bệnh nhân ra viện`,
                    type: 'success'
                });
                await loadDataFromSheet();
            } catch {
                setNotification({
                    message: 'Lỗi xác nhận hàng loạt',
                    type: 'error'
                });
            }
        }
    };

    const handleTransferConfirm = async (targetRoomId?: string, targetRoomNumber?: string, notes?: string, date?: string) => {
        if (!selectedPatientId) return;
        if (transferMode === 'TRANSFER' && targetRoomId) {
            const targetBlock = rooms.find(b => b.id === targetRoomId);
            const p = rooms.flatMap(r => r.patients).find(pat => pat.id === selectedPatientId);
            if (p) {
                const updatedP = {
                    ...p,
                    ward: targetBlock?.name || p.ward,
                    roomNumber: targetRoomNumber || p.roomNumber,
                    roomEntryDate: getTodayString(),
                };
                await savePatient(updatedP);
                setNotification({ message: 'Đã chuyển phòng', type: 'success' });
                loadDataFromSheet();
            }
        } else {
            // DISCHARGE MODE
            try {
                await handleUpdatePatient(selectedPatientId, { dischargeDate: date });
                setNotification({ message: 'Đã đặt lịch ra viện', type: 'success' });
                await loadDataFromSheet();
            } catch (error) {
                console.error('Error setting discharge date:', error);
                setNotification({ message: 'Lỗi đặt lịch ra viện', type: 'error' });
            }
        }
    };


    // --- FILTERING ---
    const passesGlobalFilters = (p: Patient) => {
        if (currentView === AppView.WARD_ROUND && p.status === PatientStatus.ARCHIVED) return false;
        if (currentView === AppView.SEVERE_CASES && (!p.isSevere || p.status === PatientStatus.ARCHIVED)) return false;
        if (currentView === AppView.SURGERY_SCHEDULE && p.status === PatientStatus.ARCHIVED) return false;
        if (currentView === AppView.WARD_ROUND && showServiceOnly) {
            if (!isServiceRoomPatient(p)) return false;
        }
        if (currentView === AppView.WARD_ROUND && selectedRoomBlockId && currentBlock) {
            if ((p.ward || '') !== currentBlock.name) return false;
        }
        if (currentView === AppView.DISCHARGE_LIST && (!p.dischargeDate || p.status === PatientStatus.ARCHIVED || p.dischargeConfirmed)) return false;

        if (selectedRoomNumber && p.roomNumber !== selectedRoomNumber) return false;
        if (admissionDateFilterDate && p.admissionDate) {
            const filterDate = getLocalIsoDate(admissionDateFilterDate);
            const pDate = normalizeDateString(p.admissionDate);
            if (pDate !== filterDate) return false;
        }
        if (searchQuery) {
            const q = removeVietnameseTones(searchQuery.toLowerCase());
            return removeVietnameseTones(p.fullName.toLowerCase()).includes(q) || p.roomNumber.toLowerCase().includes(q);
        }
        return true;
    };

    const allPatients = useMemo(() => rooms.flatMap(r => r.patients), [rooms]);

    // This state will hold the temporary, reordered list for the UI
    const [uiOrderedPatients, setUiOrderedPatients] = useState<Patient[] | null>(null);

    const filteredPatients = useMemo(() => {
        const baseList = uiOrderedPatients || allPatients;
        return baseList.filter(passesGlobalFilters);
    }, [allPatients, uiOrderedPatients, passesGlobalFilters]);

    // Grouping for Surgery
    const { surgeryGroups, unscheduledPatients } = useMemo(() => {
        const today = getTodayString();
        const tomorrowDate = new Date();
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrow = getLocalIsoDate(tomorrowDate);
        const hasDate = (p: Patient) => typeof p.surgeryDate === 'string' && p.surgeryDate.trim() !== '';
        const waiting = filteredPatients.filter(p => p.isScheduledForSurgery && !hasDate(p));
        const scheduled = filteredPatients.filter(p => p.isScheduledForSurgery && hasDate(p));
        return {
            surgeryGroups: {
                today: scheduled.filter(p => normalizeDateString(p.surgeryDate) === today).sort((a,b) => (a.surgeryTime||'').localeCompare(b.surgeryTime||'')),
                tomorrow: scheduled.filter(p => normalizeDateString(p.surgeryDate) === tomorrow).sort((a,b) => (a.surgeryTime||'').localeCompare(b.surgeryTime||'')),
                upcoming: scheduled.filter(p => normalizeDateString(p.surgeryDate) > tomorrow).sort((a,b) => (a.surgeryDate||'').localeCompare(b.surgeryDate||'')),
            },
            unscheduledPatients: waiting
        };
    }, [filteredPatients]);

    const serviceFilterDate = admissionDateFilterDate ? getLocalIsoDate(admissionDateFilterDate) : null;

    const dischargeGroups = useMemo(() => {
        if (currentView !== AppView.DISCHARGE_LIST) return { today: [], tomorrow: [], upcoming: [], overdue: [] };
        const today = getTodayString();
        const tomorrowDate = new Date();
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrow = getLocalIsoDate(tomorrowDate);
        return {
            today: filteredPatients.filter(p => normalizeDateString(p.dischargeDate) === today),
            tomorrow: filteredPatients.filter(p => normalizeDateString(p.dischargeDate) === tomorrow),
            upcoming: filteredPatients.filter(p => normalizeDateString(p.dischargeDate) > tomorrow).sort((a,b) => (a.dischargeDate||'').localeCompare(b.dischargeDate||'')),
            overdue: filteredPatients.filter(p => normalizeDateString(p.dischargeDate) < today).sort((a,b) => (a.dischargeDate||'').localeCompare(b.dischargeDate||''))
        };
    }, [filteredPatients, currentView]);


    const formatSurgeryDateLabel = (dateKey: string, groupKey: keyof typeof surgeryGroups) => {
        if (dateKey === 'unknown' || !dateKey) return 'Chưa rõ ngày';
        const base = formatDayMonth(dateKey);
        if (groupKey === 'today') return `Hôm nay · ${base}`;
        if (groupKey === 'tomorrow') return `Ngày mai · ${base}`;
        return base;
    };

    const severeCount = rooms.flatMap(r => r.patients).filter(p => p.isSevere && p.status !== PatientStatus.ARCHIVED).length;
    const surgeryCount = rooms.flatMap(r => r.patients).filter(p => p.isScheduledForSurgery && (!p.surgeryDate || p.surgeryDate === "") && p.status !== PatientStatus.ARCHIVED).length;

    // Số BN ra viện hôm nay
    const dischargeTodayCount = useMemo(() => {
        const today = getTodayString();
        return rooms.flatMap(r => r.patients).filter(p =>
            p.dischargeDate &&
            normalizeDateString(p.dischargeDate) === today &&
            p.status !== PatientStatus.ARCHIVED &&
            !p.dischargeConfirmed
        ).length;
    }, [rooms]);

    const handleScanServicePatients = async () => {
        const targetDate = admissionDateFilterDate ? getLocalIsoDate(admissionDateFilterDate) : null;
        const patientsToSchedule = allPatients.filter(p => !p.isScheduledForSurgery && matchesServiceFilter(p, targetDate));

        if (patientsToSchedule.length === 0) {
            setNotification({ message: 'Không tìm thấy bệnh nhân mới trong phòng dịch vụ cần đăng ký mổ.', type: 'success' });
            return;
        }

        try {
            await Promise.all(patientsToSchedule.map(p => handleUpdatePatient(p.id, {
                isScheduledForSurgery: true,
                status: PatientStatus.SURGERY_READY,
            })));
            setNotification({ message: `Đã tự động đăng ký mổ cho ${patientsToSchedule.length} bệnh nhân phòng dịch vụ.`, type: 'success' });
            loadDataFromSheet();
        } catch (error) {
            setNotification({ message: 'Đã xảy ra lỗi khi đăng ký mổ cho bệnh nhân dịch vụ.', type: 'error' });
        }
    };

    const handleTriggerHospitalSync = async () => {
        if (!hospitalSyncUrl) {
            setNotification({ message: 'Chưa cấu hình link Web App đồng bộ BV.', type: 'error' });
            return;
        }

        try {
            setIsHospitalSyncing(true);
            const result = await triggerHospitalSync(hospitalSyncUrl);

            if (result.success) {
                setNotification({ message: result.message || 'Đã gửi yêu cầu đồng bộ lên BV.', type: 'success' });
            } else {
                setNotification({ message: result.error || 'Đồng bộ BV thất bại.', type: 'error' });
            }
        } catch (error) {
            console.error('Error triggering hospital sync:', error);
            setNotification({ message: 'Không thể kết nối Web App đồng bộ BV.', type: 'error' });
        } finally {
            setIsHospitalSyncing(false);
        }
    };

    const handleExportHtmlReport = () => {
        const reportDate = new Date().toLocaleDateString('vi-VN');
        const wardName = selectedRoomBlockId
            ? rooms.find(r => r.id === selectedRoomBlockId)?.name || 'Tất cả'
            : 'Tất cả';
        const todayISO = getTodayString();

        const rowsHtml = filteredPatients.map((p, idx) => {
            const dischargeDateNormalized = normalizeDateString(p.dischargeDate);
            const isDischargeToday =
                dischargeDateNormalized && dischargeDateNormalized === todayISO;

            const surgeryDateNormalized = normalizeDateString(p.surgeryDate);
            const isSurgeryToday = !!(surgeryDateNormalized && surgeryDateNormalized === todayISO);

            const ordersToday = (p.orders || []).filter(order => {
                if (!order.executionDate) return false;
                const execDate = normalizeDateString(order.executionDate);
                return execDate === todayISO && order.status !== OrderStatus.CANCELLED;
            });

            const orderNotes: string[] = [];
            if (isDischargeToday) {
                orderNotes.push('☐ Ra viện');
            }
            if (isSurgeryToday) {
                const timeLabel = formatSurgeryTime(p.surgeryTime) || '';
                orderNotes.push(timeLabel ? `☐ Chuyển mổ lúc ${timeLabel}` : '☐ Chuyển mổ');
            }

            if (ordersToday.length > 0) {
                ordersToday.forEach(order => {
                    const prefix = order.status === OrderStatus.COMPLETED ? '☑' : '☐';
                    orderNotes.push(`${prefix} ${order.content}`);
                });
            }

            const orderText = orderNotes.join('<br/>');

            return `
            <tr>
                <td>${idx + 1}</td>
                <td>${escapeHtml(p.fullName)}</td>
                <td>${escapeHtml(p.diagnosis)}</td>
                <td style="text-align:left;">${orderText}</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
            </tr>
        `;
        }).join('');

        const blankRows = Array.from({ length: 4 }).map((_, idx) => `
            <tr>
                <td>${filteredPatients.length + idx + 1}</td>
                <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
            </tr>
        `).join('');

        const html = `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8" />
            <title>Sổ đi buồng</title>
            <style>
                body { font-family: 'Times New Roman', serif; font-size: 14px; line-height: 1.5; margin: 32px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #cbd5f5; padding: 8px; text-align: center; }
                th:nth-child(2), td:nth-child(2), th:nth-child(3), td:nth-child(3) { text-align: left; }
                th { background: #eef2ff; }
                header { text-align: center; }
                .actions { text-align: right; margin-top: 16px; }
                button { padding: 8px 16px; border: 1px solid #2563eb; background: #fff; color: #2563eb; border-radius: 6px; font-weight: 600; cursor: pointer; }
                @media print {
                    .actions { display: none; }
                }
            </style>
        </head>
        <body>
            <header>
                <h2>Sổ đi buồng</h2>
                <p>Ngày: ${reportDate} &nbsp;|&nbsp; Khu: ${escapeHtml(wardName)}</p>
            </header>
            <table>
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Tên bệnh nhân</th>
                        <th>Chẩn đoán</th>
                        <th>Y lệnh</th>
                        <th>Mạch</th>
                        <th>Nhiệt</th>
                        <th>HA</th>
                        <th>NT</th>
                        <th>Người thực hiện</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                    ${blankRows}
                </tbody>
            </table>
            <div class="actions">
                <button onclick="window.print()">In</button>
            </div>
        </body>
        </html>
        `;

        const reportWindow = window.open('', '_blank');
        if (reportWindow) {
            reportWindow.document.write(html);
            reportWindow.document.close();
        }
    };

    // --- AI SCHEDULER HANDLERS ---
    const buildExistingSurgeries = useCallback(() => {
        const scheduledPatients = [
            ...surgeryGroups.today,
            ...surgeryGroups.tomorrow,
            ...surgeryGroups.upcoming,
        ];
        return scheduledPatients.map(p => ({
            id: p.id,
            operatingRoom: (p.operatingRoom || '').trim(),
            surgeryTime: (p.surgeryTime || '').trim(),
            PPPT: p.surgeryMethod || '',
            diagnosis: p.diagnosis || ''
        }));
    }, [surgeryGroups.today, surgeryGroups.tomorrow, surgeryGroups.upcoming]);

    const handleOpenSurgeryScheduler = async () => {
        setIsScheduling(true);
        setIsSurgerySchedulerModalOpen(true);
        setSuggestedSchedule([]);

        const scheduledPatients = buildExistingSurgeries();
        const result = await generateSurgerySchedule(unscheduledPatients, scheduledPatients);
        
        if (result && !result.error) {
            setSuggestedSchedule(result);
        } else {
             setNotification({ message: result.message || 'Lỗi khi sắp xếp lịch mổ.', type: 'error' });
             setIsSurgerySchedulerModalOpen(false);
        }
        setIsScheduling(false);
    };

    const handleOpenLocalScheduler = () => {
        if (unscheduledPatients.length === 0) {
            setNotification({ message: 'Không có bệnh nhân cần xếp lịch.', type: 'error' });
            return;
        }
        setIsScheduling(true);
        setIsSurgerySchedulerModalOpen(true);
        setSuggestedSchedule([]);

        const scheduledPatients = buildExistingSurgeries();
        const suggestions = autoScheduleLocally(unscheduledPatients, scheduledPatients);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowISO = tomorrow.toISOString().split('T')[0];

        setSuggestedSchedule(
            suggestions.map(item => ({
                ...item,
                surgeryDate: item.surgeryDate || tomorrowISO
            }))
        );
        setIsScheduling(false);
    };

    const handleConfirmSchedule = (schedule: any[]) => {
        const today = getTodayString();
        schedule.forEach(item => {
            const updates = {
                surgeryMethod: item.PPPT,
                operatingRoom: item.operatingRoom,
                surgeonName: item.surgeonName,
                surgeryTime: item.surgeryTime,
                surgeryDate: item.surgeryDate || today,
            };
            handleUpdatePatient(item.id, updates);
        });

        setIsSurgerySchedulerModalOpen(false);
        setNotification({ message: `Đã áp dụng và xếp lịch cho ${schedule.length} bệnh nhân.`, type: 'success' });
        loadDataFromSheet(); // Tải lại dữ liệu để cập nhật UI
    };

    const displayPatientCount = filteredPatients.length;

    // --- RENDER ---
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
            {/* Header */}
            <header className={`sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-200 shadow-sm transition-transform duration-300 ease-out ${headerHidden ? '-translate-y-full' : 'translate-y-0'}`}>
                <div className="px-3 py-3 pb-4 max-w-2xl xl:max-w-[1100px] 2xl:max-w-[1400px] w-full mx-auto relative">
                    <div className="bg-white rounded-[28px] px-4 py-3 shadow-lg border border-slate-100 flex flex-col gap-3">
                        {/* Dòng 1: Logo, Tên App, Icon actions */}
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView(AppView.WARD_ROUND)}>
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center shadow-[0_8px_20px_rgba(59,130,246,0.25)]">
                                    <Stethoscope size={22} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900 text-base sm:text-lg">
                                            <span className="sm:hidden">Ngoại CT</span>
                                            <span className="hidden sm:inline">Ngoại CT - Bỏng</span>
                                        </span>
                                        {currentView === AppView.WARD_ROUND && (
                                            <button
                                                type="button"
                                                onClick={() => setDisplayMode(displayMode === 'GRID' ? 'TABLE' : 'GRID')}
                                                className="sm:hidden inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-gray-200 text-gray-600 bg-white shadow-sm"
                                            >
                                                {displayMode === 'GRID' ? <TableIcon size={12} /> : <LayoutGrid size={12} />}
                                                {displayMode === 'GRID' ? 'Bảng' : 'Thẻ'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="mt-1 flex items-center gap-2">
                                        <span className="inline-flex text-[10px] sm:text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                            {displayPatientCount} BN
                                        </span>
                                        <span className="hidden sm:inline text-[11px] text-slate-400">Sổ đi buồng trực tuyến</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5 shadow-inner">
                                    {currentView === AppView.WARD_ROUND && (
                                        <button
                                            onClick={() => setDisplayMode(displayMode === 'GRID' ? 'TABLE' : 'GRID')}
                                            className="p-2 text-slate-600 hover:text-blue-500 transition-colors"
                                            title={displayMode === 'GRID' ? 'Chuyển sang bảng' : 'Chuyển sang thẻ'}
                                        >
                                            {displayMode === 'GRID' ? <TableIcon size={18}/> : <LayoutGrid size={18}/>}
                                        </button>
                                    )}
                                    <button onClick={loadDataFromSheet} disabled={isLoadingPatients} className="p-2 text-slate-600 hover:text-blue-500 transition-colors disabled:opacity-50" title="Tải lại dữ liệu">
                                        <RefreshCw size={18} className={isLoadingPatients ? 'animate-spin' : ''} />
                                    </button>
                                    <button onClick={handleExportHtmlReport} className="p-2 text-slate-600 hover:text-blue-500 transition-colors" title="Xuất HTML Sổ đi buồng">
                                        <FileText size={18} />
                                    </button>
                                    <div className="relative">
                                        <button onClick={() => setShowHamburgerMenu(prev => !prev)} className="p-2 text-slate-600 hover:text-blue-500 transition-colors" title="Menu nhanh">
                                            <Menu size={18} />
                                        </button>
                                        {showHamburgerMenu && (
                                            <div className="absolute right-0 top-12 bg-white shadow-xl border border-gray-100 rounded-2xl py-2 w-48 z-50 animate-in fade-in zoom-in-95">
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
                                <button onClick={() => setIsAddPatientModalOpen(true)} className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 sm:px-4 py-2 text-xs sm:text-sm rounded-full font-semibold shadow-[0_10px_20px_rgba(59,130,246,0.35)] hover:opacity-90 active:scale-95 transition-all flex items-center gap-1.5 min-w-[90px] justify-center" title="Thêm bệnh nhân mới">
                                    <Plus size={13} className="sm:size-[16px]" />
                                    <span className="sm:hidden">Thêm</span>
                                    <span className="hidden sm:inline">Thêm mới</span>
                                </button>
                                <div className="relative sm:hidden">
                                    <button onClick={() => setShowHamburgerMenu(prev => !prev)} className="bg-gray-100 text-gray-700 p-2.5 rounded-full hover:bg-gray-200" title="Menu">
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
                            <>
                                <div className="sm:hidden flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setFiltersVisible(prev => !prev)}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full border border-gray-200 text-gray-600 bg-gray-100"
                                    >
                                        <Filter size={12} />
                                        {filtersVisible ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
                                    </button>
                                </div>
                                <div className={`space-y-1 ${filtersVisible ? '' : 'hidden'}`}>
                                    {/* SEARCH BAR & DATE FILTER - Cùng 1 hàng */}
                                    <div className="flex items-center gap-2">
                                        <div className="relative group flex-1">
                                            <input
                                                type="text"
                                            placeholder="Tìm tên, số phòng..."
                                            className="w-full bg-gray-100 border-none rounded-2xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-medical-500/50 focus:bg-white transition-all"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                        <Search className="absolute left-3.5 top-3 text-gray-400 group-focus-within:text-medical-500" size={18} />
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleShiftDate(-1)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 shrink-0">
                                            <ChevronLeft size={18} />
                                        </button>
                                        <div
                                            className="flex items-center justify-center gap-1.5 px-3 h-9 bg-gray-100 rounded-lg text-sm font-bold text-slate-700 cursor-pointer hover:bg-gray-200 transition-colors min-w-[80px]"
                                            onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.focus()}
                                        >
                                            <input
                                                ref={dateInputRef}
                                                type="date"
                                                value={admissionDateFilterDate ? getLocalIsoDate(admissionDateFilterDate) : ''}
                                                onChange={(e) => setAdmissionDateFilterDate(e.target.value ? new Date(e.target.value) : null)}
                                                className="absolute opacity-0 pointer-events-none"
                                                title="Chọn ngày vào viện"
                                            />
                                            {admissionDateFilterDate ? (
                                                <>
                                                    <CalendarDays size={14} className="text-blue-500 shrink-0" />
                                                    <span className="text-xs">{formatDateDisplay(admissionDateFilterDate)}</span>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleClearDate(); }}
                                                        className="w-4 h-4 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-200 active:scale-95"
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <CalendarDays size={14} className="text-gray-400 shrink-0" />
                                                    <span className="text-xs text-gray-400">Ngày</span>
                                                </>
                                            )}
                                        </div>
                                        <button onClick={() => handleShiftDate(1)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 active:scale-95 shrink-0">
                                            <ChevronRight size={18} />
                                        </button>
                                    </div>
                                </div>

                                {/* KHU VỰC 3: DROPDOWNS */}
                                <div className="flex gap-2 items-start flex-wrap">
                                    <div className="relative flex-1">
                                        <Filter size={14} className="absolute left-3 top-3 text-gray-500 pointer-events-none" />
                                        <select
                                            value={selectedRoomBlockId}
                                            onChange={(e) => { setSelectedRoomBlockId(e.target.value); setSelectedRoomNumber(''); }}
                                            className="w-full bg-white border border-gray-200 text-gray-700 text-sm rounded-xl pl-9 pr-8 py-2.5 appearance-none focus:outline-none focus:border-medical-500 font-medium"
                                        >
                                            <option value="">Tất cả khu vực</option>
                                            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                        </select>
                                        <ChevronDown size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
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
                                        <ChevronDown size={16} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
                                    </div>
                                    {currentView === AppView.WARD_ROUND && (
                                        <button
                                            type="button"
                                            onClick={() => setShowServiceOnly(prev => !prev)}
                                            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border ${showServiceOnly ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-gray-500 border-gray-200'}`}
                                        >
                                            <Filter size={12} /> {showServiceOnly ? 'Đang lọc BN DV' : 'Lọc BN dịch vụ'}
                                        </button>
                                    )}
                                </div>
                                </div>
                            </>
                        )}
                    </div>
                    {currentView !== AppView.SETTINGS && currentView !== AppView.STATISTICS && (
                        <button
                            type="button"
                            aria-label={filtersVisible ? 'Ẩn bộ lọc' : 'Hiện bộ lọc'}
                            onClick={() => setFiltersVisible(prev => !prev)}
                            className="hidden sm:flex absolute left-1/2 -bottom-4 -translate-x-1/2 items-center justify-center w-8 h-4 rounded-b-full rounded-t-none border border-gray-200 bg-white text-slate-500 shadow-[0_4px_14px_rgba(15,23,42,0.15)] hover:text-blue-500 transition-colors z-20"
                        >
                            {filtersVisible ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
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
            <main className="flex-1 px-4 pt-4 pb-28 max-w-2xl xl:max-w-[1100px] 2xl:max-w-[1400px] mx-auto w-full">
                
                {currentView === AppView.SETTINGS && (
                    <SettingsView 
                        onSettingsSaved={loadDataFromSheet} 
                        onCleanupDischarged={async () => {
                            await handleCleanupDischargedPatients();
                        }}
                    />
                )}
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
                                        {filteredPatients.length === 0 ? (
                                            <div className="text-center py-12 text-gray-400">Không có bệnh nhân ra viện.</div>
                                        ) : (
                                            ['today', 'tomorrow', 'upcoming', 'overdue'].map(key => {
                                                const groupKey = key as keyof typeof dischargeGroups;
                                                const list = dischargeGroups[groupKey];

                                                // Labels and colors
                                                const groupConfig = {
                                                    today: { label: 'Hôm nay', color: 'green', showBatchConfirm: true },
                                                    tomorrow: { label: 'Ngày mai', color: 'blue', showBatchConfirm: false },
                                                    upcoming: { label: 'Sắp tới', color: 'gray', showBatchConfirm: false },
                                                    overdue: { label: 'Quá hạn', color: 'red', showBatchConfirm: true }
                                                };

                                                const config = groupConfig[groupKey];
                                                const isOpen = expandedDischargeGroups[groupKey];

                                                if (list.length === 0) return null;  // Skip empty groups

                                                return (
                                                    <div key={key} className={`bg-white/80 backdrop-blur-sm rounded-2xl border border-${config.color}-200 shadow-soft overflow-hidden`}>
                                                        {/* Group Header with Batch Confirm Button */}
                                                        <div className={`bg-${config.color}-50/50 p-4 flex justify-between items-center`}>
                                                            <div
                                                                className="flex items-center gap-2 cursor-pointer flex-1"
                                                                onClick={() => setExpandedDischargeGroups(prev => ({
                                                                    ...prev,
                                                                    [key]: !prev[groupKey]
                                                                }))}
                                                            >
                                                                <h3 className={`font-bold text-${config.color}-800 flex items-center gap-2`}>
                                                                    <Calendar size={20}/> {config.label} ({list.length})
                                                                </h3>
                                                                {isOpen ?
                                                                    <ChevronUp size={20} className={`text-${config.color}-400`}/> :
                                                                    <ChevronDown size={20} className={`text-${config.color}-400`}/>
                                                                }
                                                            </div>

                                                            {/* Batch Confirm Button */}
                                                            {config.showBatchConfirm && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleBatchConfirmDischarges(list);
                                                                    }}
                                                                    className={`ml-3 px-4 py-2 bg-${config.color}-600 text-white rounded-lg text-sm font-bold hover:bg-${config.color}-700 active:scale-95 transition-all shadow-md`}
                                                                >
                                                                    Xác nhận toàn bộ
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Patient Cards - SURGERY SCHEDULE PATTERN */}
                                                        {isOpen && list.length > 0 && (
                                                            <div className="p-3 space-y-3">
                                                                {list.map(p => (
                                                                    <div key={p.id} className="flex gap-3 bg-white p-3 rounded-xl border border-gray-100 relative">
                                                                        {/* Patient Info */}
                                                                        <div className="flex-1">
                                                                            <div className="font-bold text-slate-800">{p.fullName}</div>
                                                                            <div className="text-sm text-gray-600">
                                                                                Phòng {p.roomNumber} • {p.ward}
                                                                            </div>
                                                                            <div className="text-xs text-gray-500 mt-1">
                                                                                Dự kiến: {formatDateVN(p.dischargeDate)}
                                                                            </div>
                                                                        </div>

                                                                        {/* "Ở LẠI" BUTTON - Same position as "Sửa" in surgery */}
                                                                        <button
                                                                            onClick={() => handleCancelDischarge(p.id)}
                                                                            className="absolute bottom-3 right-3 text-sm px-3 py-2 rounded-lg font-bold bg-orange-100 text-orange-600 hover:bg-orange-200 active:scale-95 transition-all"
                                                                        >
                                                                            Ở lại
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}

                                {currentView === AppView.SURGERY_SCHEDULE && (
                                     <div className="space-y-4">
                                        <div className="flex gap-2 p-1 bg-white rounded-2xl border border-blue-100 shadow-inner">
                                            <button onClick={() => setSurgeryTab('WAITING')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${surgeryTab === 'WAITING' ? 'bg-blue-500 text-white shadow-lg' : 'text-gray-500 hover:text-blue-600'}`}>Chờ xếp lịch ({unscheduledPatients.length})</button>
                                            <button onClick={() => setSurgeryTab('SCHEDULED')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${surgeryTab === 'SCHEDULED' ? 'bg-orange-500 text-white shadow-lg' : 'text-gray-500 hover:text-orange-600'}`}>Đã lên lịch ({surgeryGroups.today.length + surgeryGroups.tomorrow.length + surgeryGroups.upcoming.length})</button>
                                        </div>
                                        {surgeryTab === 'WAITING' && (
                                             <div className="space-y-3">
                                                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                                    <button 
                                                        onClick={handleOpenLocalScheduler}
                                                        disabled={isScheduling || unscheduledPatients.length === 0}
                                                        className="w-full flex items-center justify-center gap-2 bg-white border border-gray-200 text-sky-600 font-semibold py-2.5 px-4 rounded-xl shadow-sm hover:bg-gray-50 hover:text-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <Lightbulb size={18} />
                                                        Gợi ý Xếp lịch
                                                    </button>
                                                    <button 
                                                        onClick={handleScanServicePatients}
                                                        className="w-full flex items-center justify-center gap-2 bg-white border border-emerald-200 text-emerald-600 font-semibold py-2.5 px-4 rounded-xl shadow-sm hover:bg-emerald-50"
                                                    >
                                                        Quét BN Dịch Vụ
                                                    </button>
                                                </div>

                                                <div className="pt-4 space-y-3">
                                                    {unscheduledPatients.map(p => (
                                                        <div key={p.id} className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex items-center justify-between gap-3">
                                                            <div>
                                                                <div className="font-bold text-slate-800">{p.fullName}</div>
                                                                <div className="text-xs text-gray-500">{p.diagnosis}</div>
                                                                {isServicePatientToday(p) && (
                                                                    <span className="inline-flex items-center text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 mt-1">
                                                                        Phòng dịch vụ hôm nay
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col sm:flex-row gap-2">
                                                                <button
                                                                    onClick={() => { setSelectedPatientId(p.id); setIsEditModalOpen(true); }}
                                                                    className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-md active:scale-95"
                                                                >
                                                                    Xếp lịch
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (window.confirm('Hủy đưa bệnh nhân này vào danh sách chờ mổ?')) {
                                                                            handleCancelSurgery(p.id);
                                                                        }
                                                                    }}
                                                                    className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 hover:bg-gray-200 active:scale-95"
                                                                >
                                                                    Hủy đăng ký
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {unscheduledPatients.length === 0 && <div className="text-center text-gray-400 py-8">Không có bệnh nhân chờ.</div>}
                                                </div>
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
                                                                <div className="p-3 space-y-5">
                                                                    {Object.entries(
                                                                        [...list]
                                                                            .sort((a, b) => {
                                                                                const dateA = normalizeDateString(a.surgeryDate);
                                                                                const dateB = normalizeDateString(b.surgeryDate);
                                                                                if (dateA === dateB) {
                                                                                    return (a.surgeryTime || '').localeCompare(b.surgeryTime || '');
                                                                                }
                                                                                if (!dateA) return 1;
                                                                                if (!dateB) return -1;
                                                                                return dateA.localeCompare(dateB);
                                                                            })
                                                                            .reduce<Record<string, Patient[]>>((acc, patient) => {
                                                                               const key = normalizeDateString(patient.surgeryDate) || 'unknown';
                                                                               (acc[key] = acc[key] || []).push(patient);
                                                                               return acc;
                                                                           }, {})
                                                                    ).sort((a, b) => {
                                                                        if (a[0] === 'unknown') return 1;
                                                                        if (b[0] === 'unknown') return -1;
                                                                        return a[0].localeCompare(b[0]);
                                                                    }).map(([dateKey, patientsForDate]) => (
                                                                        <div key={`${key}-${dateKey}`}>
                                                                            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wide px-1 mb-2">
                                                                                <Calendar size={14} className="text-orange-400" />
                                                                                <span>{formatSurgeryDateLabel(dateKey, groupKey)}</span>
                                                                            </div>
                                                                            <div className="space-y-3">
                                                                                {patientsForDate.map(p => {
                                                                                    const timeLabel = formatSurgeryTime(p.surgeryTime) || '--:--';
                                                                                    const hour = p.surgeryTime && p.surgeryTime.includes(':') ? parseInt(p.surgeryTime.split(':')[0], 10) : null;
                                                                                    const isAfternoon = hour !== null && hour >= 12;
                                                                                    const roomLabel = getPatientRoomTag(p);
                                                                                    return (
                                                                                        <div key={p.id} className="flex gap-3 bg-white p-3 rounded-xl border border-gray-100 relative">
                                                                                            <div className="flex flex-col items-center justify-center w-14 border-r border-gray-100 pr-3">
                                                                                                <span className={`text-xl font-bold ${isAfternoon ? 'text-blue-500' : 'text-orange-500'}`}>{timeLabel}</span>
                                                                                            </div>
                                                                                            <div className="flex-1">
                                                                                                <div className="font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                                                                                                    <span>{p.fullName}</span>
                                                                                                    {typeof p.age === 'number' && p.age > 0 && (
                                                                                                        <span className="text-[11px] font-bold text-slate-500 bg-white/60 px-1.5 py-0.5 rounded-md border border-slate-200/50">{p.age}t</span>
                                                                                                    )}
                                                                                                    {roomLabel && (
                                                                                                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">{roomLabel}</span>
                                                                                                    )}
                                                                                                    {isServicePatientToday(p) && (
                                                                                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">DV hôm nay</span>
                                                                                                    )}
                                                                                                </div>
                                                                                                <div className="text-sm text-gray-600">{p.surgeryMethod}</div>
                                                                                                {p.surgeonName && <div className="text-xs text-indigo-600 font-bold mt-1">BS: {p.surgeonName}</div>}
                                                                                            </div>
                                                                                            <div className="absolute bottom-3 right-3 flex gap-2">
                                                                                                <button
                                                                                                    onClick={() => { setSelectedPatientId(p.id); setIsEditModalOpen(true); }}
                                                                                                    className="text-sm px-3 py-2 rounded-lg font-bold bg-gray-100 text-gray-500 hover:bg-orange-200 hover:text-orange-600 active:scale-95 transition-all shadow-sm"
                                                                                                >
                                                                                                    Sửa
                                                                                                </button>
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        if (window.confirm('Hủy ca mổ đã xếp cho bệnh nhân này? Ca sẽ được đưa ra khỏi danh sách lịch mổ.')) {
                                                                                                            handleCancelSurgery(p.id);
                                                                                                        }
                                                                                                    }}
                                                                                                    className="text-sm px-3 py-2 rounded-lg font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 active:scale-95 transition-all"
                                                                                                >
                                                                                                    Hủy ca
                                                                                                </button>
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-3 flex flex-col gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-100 text-blue-600 p-2 rounded-xl"><UploadCloud size={18} /></div>
                                                <div>
                                                    <p className="font-semibold text-slate-800 text-sm">Đẩy lịch lên duyệt BV</p>
                                                    <p className="text-[11px] text-gray-500">Chạy tự động lúc 20h mỗi ngày, có thể bấm tay khi cần.</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <button 
                                                    onClick={handleTriggerHospitalSync}
                                                    disabled={isHospitalSyncing || !hospitalSyncUrl}
                                                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-sm font-bold transition-all border ${isHospitalSyncing || !hospitalSyncUrl ? 'bg-gray-200 text-gray-500 border-gray-300' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50'}`}
                                                >
                                                    {isHospitalSyncing ? 'Đang gửi...' : 'Đồng bộ lên BV'}
                                                </button>
                                                {!hospitalSyncUrl && (
                                                    <span className="text-xs text-red-500 font-semibold text-center sm:text-left">Chưa cấu hình URL Web App đồng bộ BV.</span>
                                                )}
                                            </div>
                                        </div>
                                     </div>
                                )}

                                {/* --- View: Đi buồng / Bệnh nặng (Dạng Card) --- */}
                                {(currentView === AppView.WARD_ROUND || currentView === AppView.SEVERE_CASES) && (
                                    <div className="space-y-4">
                                        {filteredPatients.length === 0 ? <div className="text-center py-20 text-gray-400">Không tìm thấy bệnh nhân.</div> : (
                                            <>
                                                {rooms.map(block => {
                                                    const blockPatients = block.patients.filter(passesGlobalFilters);
                                                    if (blockPatients.length === 0) return null;
                                                    const sortedBlockPatients = [...blockPatients].sort(comparePatientsByRoomTag);
                                                    
                                                    const isBlockExpanded = expandedBlocks[block.id];
                                                    const blockClass = 'bg-gradient-to-r from-blue-600 to-blue-400 shadow-lg';
                                                    const iconClass = 'text-white';
                                                    const textClass = 'text-white';
                                                    const badgeClass = 'bg-white text-blue-600';
                                                    const chevronClass = 'text-white';

                                                    return (
                                                        <div key={block.id} className="bg-white/70 backdrop-blur-sm rounded-3xl shadow-sm border border-white/50 mb-3 overflow-hidden">
                                                            <div
                                                                className={`px-4 py-3 rounded-3xl flex justify-between items-center cursor-pointer select-none transition-colors ${blockClass}`}
                                                                onClick={() => setExpandedBlocks(prev => ({...prev, [block.id]: !prev[block.id]}))}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`font-bold text-base ${textClass}`}>{block.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeClass}`}>{blockPatients.length} bệnh nhân</span>
                                                                    {isBlockExpanded ? <ChevronUp size={18} className={chevronClass}/> : <ChevronDown size={18} className={chevronClass}/>}
                                                                </div>
                                                            </div>

                                                            {expandedBlocks[block.id] && (
                                                                <div className="px-3 pb-3 pt-0">
{sortedBlockPatients.map(p => (
    <PatientCard
        key={p.id}
        patient={p}
        expanded={expandedPatientId === p.id}
        onToggleExpand={() => setExpandedPatientId(prev => prev === p.id ? null : p.id)}
        onAddOrder={() => { setSelectedPatientId(p.id); setIsOrderModalOpen(true); }}
        onRegisterSurgery={() => handleRegisterSurgery(p.id)}
        onCancelSurgery={() => handleCancelSurgery(p.id)}
        onTransfer={() => { setSelectedPatientId(p.id); setTransferMode('TRANSFER'); setIsTransferModalOpen(true); }}
        onDischarge={() => { setSelectedPatientId(p.id); setTransferMode('DISCHARGE'); setIsTransferModalOpen(true); }}
        onEdit={() => { setSelectedPatientId(p.id); setIsEditModalOpen(true); }}
        onCompleteOrder={handleToggleCompleteOrder}
        onQuickSevereToggle={(id) => handleUpdatePatient(id, { isSevere: !p.isSevere })}
    />
))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )
                                                })}
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
                <div className="bg-white/90 backdrop-blur-2xl rounded-full flex justify-around items-center h-[72px] mx-4 px-4 shadow-2xl ring-1 ring-black/5 max-w-2xl xl:max-w-[1100px] 2xl:max-w-[1400px] w-full transition-all">
                    {[ { id: AppView.WARD_ROUND, icon: LayoutDashboard, label: 'Đi buồng', color: 'medical' }, { id: AppView.SEVERE_CASES, icon: AlertCircle, label: 'Nặng', color: 'red', count: severeCount }, { id: AppView.SURGERY_SCHEDULE, icon: Calendar, label: 'Lịch mổ', color: 'blue', count: surgeryCount }, { id: AppView.DISCHARGE_LIST, icon: LogOut, label: 'Ra viện', color: 'green', count: dischargeTodayCount } ].map(item => (
                        <button key={item.id} onClick={() => setCurrentView(item.id)} className={`group flex flex-col items-center gap-1.5 w-full h-full justify-center active:scale-95 transition-all ${currentView === item.id ? `text-${item.color}-600` : 'text-slate-500 hover:text-slate-700'}`}>
                            <div className={`p-1 rounded-xl relative ${currentView === item.id ? `bg-${item.color}-50` : ''}`}>
                                <item.icon size={24} strokeWidth={currentView === item.id ? 2.5 : 2} />
                                {item.count > 0 && <div className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-${item.color}-500 rounded-full animate-pulse shadow-lg flex items-center justify-center px-1`}><span className="text-white text-[10px] font-extrabold">{item.count}</span></div>}
                            </div>
                            <span className="text-[10px] font-bold tracking-wide">{item.label}</span>
                        </button>
                    ))}
                </div>
            </nav>

            <AddPatientModal isOpen={isAddPatientModalOpen} onClose={() => setIsAddPatientModalOpen(false)} doctors={doctors} onAddPatients={handleAddPatients} rooms={rooms} />
            <OrderModal isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)} onAddOrder={handleAddOrder} patientName={selectedPatientName} doctors={doctors} />
            <TransferModal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} mode={transferMode} patientName={selectedPatientName} rooms={rooms} currentRoomId={selectedRoomBlockId} onConfirm={handleTransferConfirm} />
            <PatientEditModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                patient={selectedPatient}
                onSave={handleUpdatePatient}
                onDelete={handleDeletePatientRecord}
                doctors={doctors}
                operatingRooms={operatingRooms}
                anesthesiaMethods={anesthesiaMethods}
                surgeryClassifications={surgeryClassifications}
                surgeryRequirements={surgeryRequirements}
            />
            <SurgerySchedulerModal 
                isOpen={isSurgerySchedulerModalOpen}
                onClose={() => setIsSurgerySchedulerModalOpen(false)}
                patients={unscheduledPatients}
                suggestedSchedule={suggestedSchedule}
                isLoading={isScheduling}
                onConfirm={handleConfirmSchedule}
                doctors={doctors}
            />
        </div>
    );
};

export default App;
