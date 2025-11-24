
import React, { useState, useEffect, useMemo } from 'react';
import { RoomBlock, Patient, AppView, MedicalOrder, PatientStatus, OrderStatus, OrderType } from './types';
import { formatForGoogleSheet } from './services/geminiService';
import { fetchPatients, fetchOrders, savePatient, saveOrder, confirmDischarge, fetchSettings, saveSettings } from './services/api';
import { buildRoomBlocksFromConfig, WardConfig, SettingsPayload } from './services/sheetMapping';
import PatientCard from './components/PatientCard';
import OrderModal from './components/OrderModal';
import TransferModal from './components/TransferModal';
import PatientEditModal from './components/PatientEditModal';
import AddPatientModal from './components/AddPatientModal';
import SettingsView from './components/SettingsView';
import StatisticsView from './components/StatisticsView';
import { Stethoscope, Calendar, LayoutDashboard, Plus, Loader2, Search, Settings as SettingsIcon, ExternalLink, AlertCircle, LogOut, Filter, ChevronDown, ChevronUp, Clock, PieChart, UserCheck, Building, List, CalendarCheck } from 'lucide-react';

// Helper to remove Vietnamese accents for search
const removeVietnameseTones = (str: string) => {
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

const App: React.FC = () => {
    // --- State with Persistence ---
    const STORAGE_KEY_PREFIX = 'smartround_v5_'; // Bump version to force clear old data

    // Load Doctors
    const [doctors, setDoctors] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}doctors`);
            return saved ? JSON.parse(saved) : ['BS. Trưởng', 'BS. Hùng', 'BS. Lan'];
        } catch { return ['BS. Trưởng', 'BS. Hùng', 'BS. Lan']; }
    });

    // Load Configs for Surgery
    const [operatingRooms, setOperatingRooms] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}operatingRooms`);
            return saved ? JSON.parse(saved) : ['Phòng 1', 'Phòng 2', 'Phòng 3', 'Phòng 4', 'Phòng 5', 'Phòng 6', 'Phòng 7', 'Phòng 8', 'Phòng 9'];
        } catch { return ['Phòng 1', 'Phòng 2', 'Phòng 3', 'Phòng 4', 'Phòng 5', 'Phòng 6', 'Phòng 7', 'Phòng 8', 'Phòng 9']; }
    });

    const [anesthesiaMethods, setAnesthesiaMethods] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}anesthesiaMethods`);
            return saved ? JSON.parse(saved) : ['Tê TS', 'Tê DRTK', 'Mê NKQ', 'Mê Mask', 'Tê tại chỗ'];
        } catch { return ['Tê TS', 'Tê DRTK', 'Mê NKQ', 'Mê Mask', 'Tê tại chỗ']; }
    });

    const [surgeryClassifications, setSurgeryClassifications] = useState<string[]>(() => {
        try {
            const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}surgeryClassifications`);
            return saved ? JSON.parse(saved) : ['Chấn thương', 'Bệnh lý', 'Dịch vụ', 'Cấp cứu'];
        } catch { return ['Chấn thương', 'Bệnh lý', 'Dịch vụ', 'Cấp cứu']; }
    });
    
    const [surgeryRequirements, setSurgeryRequirements] = useState<string[]>(() => {
         try {
            const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}surgeryRequirements`);
            return saved ? JSON.parse(saved) : ['Săng trung', 'Săng đại'];
        } catch { return ['Săng trung', 'Săng đại']; }
    });


    // Load Rooms & Patients
    const [rooms, setRooms] = useState<RoomBlock[]>(() => {
        try {
            const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}rooms`);
            if (saved) return JSON.parse(saved);
        } catch {}
        
        // Default Data if empty
        return [
            { id: '1', name: 'Khu A', definedRooms: ['101', '102', '103'], patients: [] },
            { id: '2', name: 'Khu B', definedRooms: ['201', '202'], patients: [] },
        ];
    });

    // Load Google Sheet URL
    const [sheetUrl, setSheetUrl] = useState<string>(() => {
        return localStorage.getItem(`${STORAGE_KEY_PREFIX}sheet_url`) || '';
    });

    const [wardConfigs, setWardConfigs] = useState<WardConfig[]>([]);
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    const [configDirty, setConfigDirty] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    const markConfigDirty = () => setConfigDirty(true);

    const [currentView, setCurrentView] = useState<AppView>(AppView.WARD_ROUND);
    const [isLoadingPatients, setIsLoadingPatients] = useState(true);
    const [apiError, setApiError] = useState<string | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    
    // Filtering States
    const [selectedRoomBlockId, setSelectedRoomBlockId] = useState<string>(''); // Filter by "Khu" (Empty = All)
    const [selectedRoomNumber, setSelectedRoomNumber] = useState<string>(''); // Filter by "Phòng" inside Khu
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferMode, setTransferMode] = useState<'TRANSFER' | 'DISCHARGE'>('TRANSFER');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [expandedBlocks, setExpandedBlocks] = useState<{[key: string]: boolean}>({});

    // UI States for Surgery
    const [surgeryTab, setSurgeryTab] = useState<'WAITING' | 'SCHEDULED'>('WAITING');
    const [expandedSurgeryGroups, setExpandedSurgeryGroups] = useState<{[key: string]: boolean}>({
        'today': true, 'tomorrow': true, 'upcoming': true
    });

    // --- Effects for Persistence ---
    useEffect(() => { localStorage.setItem(`${STORAGE_KEY_PREFIX}doctors`, JSON.stringify(doctors)); }, [doctors]);
    useEffect(() => { localStorage.setItem(`${STORAGE_KEY_PREFIX}operatingRooms`, JSON.stringify(operatingRooms)); }, [operatingRooms]);
    useEffect(() => { localStorage.setItem(`${STORAGE_KEY_PREFIX}anesthesiaMethods`, JSON.stringify(anesthesiaMethods)); }, [anesthesiaMethods]);
    useEffect(() => { localStorage.setItem(`${STORAGE_KEY_PREFIX}surgeryClassifications`, JSON.stringify(surgeryClassifications)); }, [surgeryClassifications]);
    useEffect(() => { localStorage.setItem(`${STORAGE_KEY_PREFIX}surgeryRequirements`, JSON.stringify(surgeryRequirements)); }, [surgeryRequirements]);
    useEffect(() => { localStorage.setItem(`${STORAGE_KEY_PREFIX}rooms`, JSON.stringify(rooms)); }, [rooms]);
    useEffect(() => { localStorage.setItem(`${STORAGE_KEY_PREFIX}sheet_url`, sheetUrl); }, [sheetUrl]);

    // --- Init Logic ---
    useEffect(() => {
        // Default expand all blocks initially
        const initialExpanded: {[key: string]: boolean} = {};
        rooms.forEach(r => initialExpanded[r.id] = true);
        setExpandedBlocks(initialExpanded);
    }, []);

    useEffect(() => {
        let isActive = true;
        const loadFromApi = async () => {
            setIsLoadingPatients(true);
            try {
                const settings = await fetchSettings();
                if (!isActive) return;
                setDoctors(settings.doctors);
                setOperatingRooms(settings.operatingRooms);
                setAnesthesiaMethods(settings.anesthesiaMethods);
                setSurgeryClassifications(settings.surgeryClassifications);
                setSurgeryRequirements(settings.surgeryRequirements);
                setWardConfigs(settings.wards);
                setRooms(buildRoomBlocksFromConfig([], settings.wards));
                setSettingsLoaded(true);
                setConfigDirty(false);

                const patients = await fetchPatients();
                const enriched = await Promise.all(patients.map(async (patient) => {
                    try {
                        const orders = await fetchOrders(patient.id);
                        return { ...patient, orders };
                    } catch (error) {
                        console.error('Không lấy được y lệnh cho bệnh nhân', patient.id, error);
                        return { ...patient, orders: [] };
                    }
                }));
                if (!isActive) return;
                setRooms(buildRoomBlocksFromConfig(enriched, settings.wards));
                setApiError(null);
                setNotification({ message: 'Đã đồng bộ dữ liệu từ Google Sheet', type: 'success' });
            } catch (error) {
                console.error('Lỗi khi tải dữ liệu từ API:', error);
                if (isActive) {
                    setApiError((error as Error)?.message || 'Không tải được dữ liệu từ Google Sheet');
                }
            } finally {
                if (isActive) setIsLoadingPatients(false);
            }
        };
        loadFromApi();
        return () => {
            isActive = false;
        };
    }, []);

    // --- Derived Data ---
    const selectedPatient = useMemo(() => {
        for (const block of rooms) {
            const p = block.patients.find(p => p.id === selectedPatientId);
            if (p) return p;
        }
        return null;
    }, [rooms, selectedPatientId]);

    const selectedPatientName = selectedPatient?.fullName || '';
    const currentBlock = rooms.find(r => r.id === selectedRoomBlockId);
    
    // Calculate available rooms in current block for filter
    const availableRoomsInBlock = useMemo(() => {
        if (!currentBlock) return [];
        // Combine defined rooms and rooms currently having patients
        const patientRooms = Array.from(new Set(currentBlock.patients.map(p => p.roomNumber)));
        const defined = currentBlock.definedRooms || [];
        return Array.from(new Set([...defined, ...patientRooms])).sort();
    }, [currentBlock]);

    useEffect(() => {
        if (!notification) return;
        const timeout = setTimeout(() => setNotification(null), 4000);
        return () => clearTimeout(timeout);
    }, [notification]);

    const deriveWardConfigsFromRooms = (): WardConfig[] => rooms.map(block => ({
        id: block.id,
        name: block.name,
        rooms: block.definedRooms || [],
    }));

    useEffect(() => {
        if (!settingsLoaded || !configDirty || isSavingSettings) return;
        const payload: SettingsPayload = {
            doctors,
            operatingRooms,
            anesthesiaMethods,
            surgeryClassifications,
            surgeryRequirements,
            wards: deriveWardConfigsFromRooms(),
        };
        setIsSavingSettings(true);
        saveSettings(payload)
            .then(() => {
                setConfigDirty(false);
                setNotification({ message: 'Cấu hình đã được đồng bộ', type: 'success' });
            })
            .catch((error) => {
                console.error('Lưu cấu hình thất bại', error);
                setApiError((error as Error)?.message || 'Lưu cấu hình thất bại');
                setNotification({ message: 'Lưu cấu hình thất bại', type: 'error' });
            })
            .finally(() => setIsSavingSettings(false));
    }, [configDirty, settingsLoaded, doctors, operatingRooms, anesthesiaMethods, surgeryClassifications, surgeryRequirements, rooms, isSavingSettings]);
    

    // --- Logic Handlers ---

    const replacePatientInState = (patient: Patient) => {
        setRooms(prev => prev.map(block => ({
            ...block,
            patients: block.patients.map(p => p.id === patient.id ? patient : p)
        })));
    };

    const replaceOrderInState = (patientId: string, order: MedicalOrder) => {
        setRooms(prev => prev.map(block => ({
            ...block,
            patients: block.patients.map(p => {
                if (p.id !== patientId) return p;
                return {
                    ...p,
                    orders: p.orders.map(o => o.id === order.id ? order : o)
                };
            })
        })));
    };

    const handleAddPatients = async (newPatients: Patient[], targetBlockId?: string) => {
        const blockId = targetBlockId || selectedRoomBlockId || rooms[0]?.id;
        if (!blockId) return;

        const targetBlock = rooms.find(block => block.id === blockId);
        const blockName = targetBlock?.name || newPatients[0]?.ward || 'Chưa xác định';
        const normalizedPatients = newPatients.map(patient => ({
            ...patient,
            ward: patient.ward || blockName
        }));

        setRooms(prev => {
            let blockExists = false;
            const updated = prev.map(block => {
                if (block.id === blockId) {
                    blockExists = true;
                    return {
                        ...block,
                        patients: [...block.patients, ...normalizedPatients]
                    };
                }
                return block;
            });
            if (!blockExists) {
                updated.push({
                    id: blockId,
                    name: blockName,
                    definedRooms: Array.from(new Set(normalizedPatients.map(p => p.roomNumber).filter(Boolean))),
                    patients: [...normalizedPatients]
                });
            }
            return updated;
        });
        setIsAddPatientModalOpen(false);

        try {
            const saved = await Promise.all(normalizedPatients.map(patient => savePatient(patient)));
            saved.forEach(replacePatientInState);
            setNotification({ message: 'Đã lưu bệnh nhân mới thành công', type: 'success' });
        } catch (error) {
            console.error('Lỗi khi lưu bệnh nhân mới:', error);
            setNotification({ message: 'Lưu bệnh nhân mới thất bại', type: 'error' });
        }
    };

    const handleUpdatePatient = (id: string, updates: Partial<Patient>) => {
        let updatedPatient: Patient | null = null;
        const updatedRooms = rooms.map(block => ({
            ...block,
            patients: block.patients.map(p => {
                if (p.id === id) {
                    updatedPatient = { ...p, ...updates };
                    return updatedPatient;
                }
                return p;
            })
        }));
        setRooms(updatedRooms);
        if (updatedPatient) {
            savePatient(updatedPatient).catch(error => {
                console.error('Lưu thông tin bệnh nhân thất bại', error);
            });
        }
    };

    const handleAddOrder = async (orderData: Omit<MedicalOrder, 'id'>, isDischargeOrder?: boolean, dischargeDate?: string) => {
        if (!selectedPatientId) return;
        
        const newOrder: MedicalOrder = {
            ...orderData,
            id: Math.random().toString(36).substr(2, 9)
        };
        let updatedPatient: Patient | null = null;
        const updatedRooms = rooms.map(block => ({
            ...block,
            patients: block.patients.map(p => {
                if (p.id === selectedPatientId) {
                    const updates: Partial<Patient> = { orders: [newOrder, ...p.orders] };
                    if (isDischargeOrder && dischargeDate) {
                        updates.dischargeDate = dischargeDate;
                    }
                    updatedPatient = { ...p, ...updates };
                    return updatedPatient;
                }
                return p;
            })
        }));
        setRooms(updatedRooms);

        if (updatedPatient) {
            savePatient(updatedPatient).catch(error => {
                console.error('Lưu bệnh nhân sau y lệnh thất bại', error);
            });
        }

        try {
            const savedOrder = await saveOrder(newOrder);
            replaceOrderInState(selectedPatientId, savedOrder);
            setNotification({ message: 'Y lệnh đã được lưu', type: 'success' });
        } catch (error) {
            console.error('Lưu y lệnh thất bại', error);
            setNotification({ message: 'Lưu y lệnh thất bại', type: 'error' });
        }
    };

    const handleToggleCompleteOrder = (patientId: string, orderId: string) => {
        let updatedOrder: MedicalOrder | null = null;
        const updatedRooms = rooms.map(block => ({
            ...block,
            patients: block.patients.map(p => {
                if (p.id === patientId) {
                    return {
                        ...p,
                        orders: p.orders.map(o => {
                            if (o.id === orderId) {
                                updatedOrder = {
                                    ...o,
                                    status: o.status === OrderStatus.COMPLETED ? OrderStatus.PENDING : OrderStatus.COMPLETED
                                };
                                return updatedOrder;
                            }
                            return o;
                        })
                    };
                }
                return p;
            })
        }));
        setRooms(updatedRooms);

        if (updatedOrder) {
            saveOrder(updatedOrder)
                .then(() => setNotification({ message: 'Cập nhật y lệnh hoàn tất', type: 'success' }))
                .catch(error => {
                    console.error('Cập nhật y lệnh thất bại', error);
                    setNotification({ message: 'Cập nhật y lệnh thất bại', type: 'error' });
                });
        }
    };

    const handleToggleSurgery = (id: string) => {
        const p = rooms.flatMap(r => r.patients).find(pat => pat.id === id);
        if (!p) return;
        const newStatus = !p.isScheduledForSurgery;
        handleUpdatePatient(id, { 
            isScheduledForSurgery: newStatus,
        });
    };

    const handleTransferConfirm = (targetRoomId?: string, targetRoomNumber?: string, notes?: string, date?: string) => {
        if (!selectedPatientId) return;

        if (transferMode === 'TRANSFER' && targetRoomId) {
            let pToMove: Patient | undefined;
            const targetBlock = rooms.find(b => b.id === targetRoomId);

            const step1 = rooms.map(b => {
                const found = b.patients.find(p => p.id === selectedPatientId);
                if (found) {
                    pToMove = found;
                    return { ...b, patients: b.patients.filter(p => p.id !== selectedPatientId) };
                }
                return b;
            });

            if (pToMove) {
                const movedPatient = {
                    ...pToMove,
                    roomEntryDate: new Date().toISOString().split('T')[0],
                    roomNumber: targetRoomNumber || pToMove.roomNumber,
                    ward: targetBlock?.name || pToMove.ward
                };
                const step2 = step1.map(b => {
                    if (b.id === targetRoomId) {
                        return { ...b, patients: [...b.patients, movedPatient] };
                    }
                    return b;
                });
                setRooms(step2);
            savePatient(movedPatient)
                .then(() => setNotification({ message: 'Chuyển phòng đã được lưu', type: 'success' }))
                .catch(error => {
                    console.error('Lưu bệnh nhân sau chuyển phòng thất bại', error);
                    setNotification({ message: 'Lưu chuyển phòng thất bại', type: 'error' });
                });
        }
    } else {
        handleUpdatePatient(selectedPatientId, { dischargeDate: date });
    }
    };

    // Actual final confirmation to archive patient
    const handleConfirmDischarge = (id: string) => {
        if (window.confirm('Xác nhận bệnh nhân đã hoàn tất thủ tục và rời khoa? Bệnh nhân sẽ được lưu hồ sơ.')) {
            const updatedRooms = rooms.map(block => ({
                ...block,
                patients: block.patients.map(p => p.id === id ? { ...p, status: PatientStatus.ARCHIVED } : p) // Change to ARCHIVED to hide
            }));
            setRooms(updatedRooms);
            const dischargeDate = new Date().toISOString().split('T')[0];
            confirmDischarge(id, dischargeDate)
                .then(() => setNotification({ message: 'Xác nhận ra viện thành công', type: 'success' }))
                .catch(error => {
                    console.error('Xác nhận ra viện thất bại', error);
                    setNotification({ message: 'Xác nhận ra viện thất bại', type: 'error' });
                });
        }
    }

    // --- Filtering Logic ---
    const filterPatient = (p: Patient) => {
        // 1. Filter by View Type
        if (currentView === AppView.WARD_ROUND) {
            if (p.status === PatientStatus.ARCHIVED) return false;
            // Show active, post-op, ready
            return true;
        } else if (currentView === AppView.SEVERE_CASES) {
            return p.isSevere && p.status !== PatientStatus.ARCHIVED;
        } else if (currentView === AppView.SURGERY_SCHEDULE) {
            return p.isScheduledForSurgery && p.status !== PatientStatus.ARCHIVED;
        } else if (currentView === AppView.DISCHARGE_LIST) {
            return !!p.dischargeDate && p.status !== PatientStatus.ARCHIVED;
        }
        return false;
    };

    // Global search filtering
    const passesGlobalFilters = (p: Patient) => {
        if (!filterPatient(p)) return false;
        
        // Room Number filter (NOW APPLIES TO ALL VIEWS INCLUDING SURGERY)
        if (selectedRoomNumber && p.roomNumber !== selectedRoomNumber) return false;

        // Text Search
        if (searchQuery) {
            const query = removeVietnameseTones(searchQuery.toLowerCase());
            return removeVietnameseTones(p.fullName.toLowerCase()).includes(query) || p.roomNumber.toLowerCase().includes(query);
        }
        return true;
    };

    // --- Special Filter Logic for RoomBlock when "Tất cả khu vực" is selected but Room filter is active ---
    // If a room number is selected (e.g. "101"), we only show blocks that contain this room
    // However, since room numbers might duplicate across blocks (rare but possible), we rely on RoomBlock filtering too.
    
    const filteredPatients = rooms.flatMap(r => {
        // If specific block selected, only take patients from that block
        if (selectedRoomBlockId && r.id !== selectedRoomBlockId) return [];
        return r.patients;
    }).filter(passesGlobalFilters);

    // Grouping for Surgery View
    const { surgeryGroups, unscheduledPatients } = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const tomorrowDate = new Date();
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrow = tomorrowDate.toISOString().split('T')[0];

        // Separating Scheduled vs Waiting
        // "Unscheduled" means isScheduledForSurgery = true BUT no surgeryDate set (or empty string)
        const waiting = filteredPatients.filter(p => !p.surgeryDate);
        const scheduled = filteredPatients.filter(p => !!p.surgeryDate);

        const groups = {
            today: scheduled.filter(p => p.surgeryDate === today).sort((a, b) => (a.surgeryTime || '').localeCompare(b.surgeryTime || '')),
            tomorrow: scheduled.filter(p => p.surgeryDate === tomorrow).sort((a, b) => (a.surgeryTime || '').localeCompare(b.surgeryTime || '')),
            upcoming: scheduled.filter(p => p.surgeryDate && p.surgeryDate > tomorrow).sort((a, b) => a.surgeryDate!.localeCompare(b.surgeryDate!)),
        };

        return { surgeryGroups: groups, unscheduledPatients: waiting };
    }, [filteredPatients]);

    // --- Render ---
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
            {/* Sticky Header with Glassmorphism */}
            <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-lg border-b border-gray-200/50 shadow-sm transition-all duration-300">
                <div className="px-4 py-3 max-w-2xl mx-auto">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <div className="bg-medical-500 text-white p-2 rounded-xl shadow-glow">
                                <Stethoscope size={20} />
                            </div>
                            <h1 className="font-bold text-slate-800 text-lg tracking-tight">SmartRound</h1>
                        </div>
                        
                        <button 
                            onClick={() => setIsAddPatientModalOpen(true)}
                            className="bg-medical-500 text-white p-2.5 rounded-full shadow-lg hover:bg-medical-600 active:scale-90 transition-all duration-200"
                        >
                            <Plus size={24} />
                        </button>
                    </div>

                    {/* Search & Filters */}
                    {currentView !== AppView.SETTINGS && currentView !== AppView.STATISTICS && (
                        <div className="space-y-2.5">
                            <div className="relative group">
                                <input 
                                    type="text" 
                                    placeholder="Tìm tên, số phòng (không dấu)..." 
                                    className="w-full bg-gray-100/50 border-none rounded-2xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-medical-500/50 focus:bg-white transition-all shadow-inner"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <Search className="absolute left-3.5 top-3 text-gray-400 group-focus-within:text-medical-500 transition-colors" size={18} />
                            </div>
                            
                            {/* Filter Bar - Enabled for Surgery View now as requested */}
                            <div className="flex gap-2">
                                {/* Dropdown Zone Filter */}
                                <div className="relative flex-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Filter size={14} className="text-gray-500"/>
                                    </div>
                                    <select 
                                        value={selectedRoomBlockId}
                                        onChange={(e) => {
                                            setSelectedRoomBlockId(e.target.value);
                                            setSelectedRoomNumber(''); // Reset room when block changes
                                        }}
                                        className="w-full bg-white border border-gray-200/80 text-gray-700 text-sm rounded-xl pl-9 pr-8 py-2.5 appearance-none focus:outline-none focus:border-medical-500 font-medium shadow-sm"
                                    >
                                        <option value="">Tất cả khu vực</option>
                                        {rooms.map(r => (
                                            <option key={r.id} value={r.id}>{r.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <ChevronDown size={16} className="text-gray-400"/>
                                    </div>
                                </div>

                                {/* Dropdown Room Filter */}
                                <div className="relative w-[35%]">
                                    <select 
                                        value={selectedRoomNumber}
                                        onChange={(e) => setSelectedRoomNumber(e.target.value)}
                                        disabled={!selectedRoomBlockId} // Disable if All Zones selected
                                        className={`w-full bg-white border border-gray-200/80 text-gray-700 text-sm rounded-xl px-3 py-2.5 appearance-none focus:outline-none focus:border-medical-500 font-medium shadow-sm transition-opacity ${!selectedRoomBlockId && 'opacity-60 bg-gray-50'}`}
                                    >
                                        <option value="">Tất cả</option>
                                        {availableRoomsInBlock.map(r => (
                                            <option key={r} value={r}>P.{r}</option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                        <ChevronDown size={16} className="text-gray-400"/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Contextual Toolbar */}
                {currentView === AppView.SURGERY_SCHEDULE && sheetUrl && (
                    <div className="bg-emerald-50/80 backdrop-blur-sm px-4 py-2 flex justify-end border-t border-emerald-100/50">
                        <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 transition-colors">
                            <ExternalLink size={14}/> Mở Lịch Mổ (Google Sheet)
                        </a>
                    </div>
                )}
            </header>

            {isLoadingPatients && (
                <div className="px-4 py-2 text-center text-xs text-medical-600">Đang đồng bộ dữ liệu từ Google Sheet...</div>
            )}
            {apiError && (
                <div className="px-4 py-1 text-center text-xs text-red-600">{apiError}</div>
            )}
            {notification && (
                <div className={`mx-4 my-2 px-4 py-2 text-xs font-semibold rounded-2xl border ${notification.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                    {notification.message}
                </div>
            )}

            {/* Main Content */}
            <main className="flex-1 px-4 pt-4 pb-28 overflow-y-auto max-w-2xl mx-auto w-full">
                
                {/* Settings View */}
                {currentView === AppView.SETTINGS && (
                <SettingsView 
                    doctors={doctors} 
                    onUpdateDoctors={setDoctors}
                    rooms={rooms}
                    onUpdateRooms={setRooms}
                    sheetUrl={sheetUrl}
                    onUpdateSheetUrl={setSheetUrl}
                    onConfigChange={markConfigDirty}
                    // New Props
                    operatingRooms={operatingRooms}
                    onUpdateOperatingRooms={setOperatingRooms}
                        anesthesiaMethods={anesthesiaMethods}
                        onUpdateAnesthesiaMethods={setAnesthesiaMethods}
                        surgeryClassifications={surgeryClassifications}
                        onUpdateSurgeryClassifications={setSurgeryClassifications}
                        surgeryRequirements={surgeryRequirements}
                        onUpdateSurgeryRequirements={setSurgeryRequirements}
                    />
                )}

                {/* Statistics View */}
                {currentView === AppView.STATISTICS && (
                    <StatisticsView rooms={rooms} />
                )}

                {/* Discharge List View */}
                {currentView === AppView.DISCHARGE_LIST && (
                     <div className="space-y-4">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 pl-1">
                            <LogOut className="text-slate-500"/> Danh Sách Ra Viện (Dự Kiến)
                        </h2>
                        {filteredPatients.length === 0 ? (
                            <div className="text-center py-16 text-gray-400 flex flex-col items-center gap-3">
                                <div className="p-4 bg-white rounded-full shadow-sm">
                                    <UserCheck size={32} className="opacity-50" />
                                </div>
                                <p>Chưa có bệnh nhân nào có lịch ra viện.</p>
                            </div>
                        ) : (
                            filteredPatients.map(p => (
                                <PatientCard 
                                    key={p.id} 
                                    patient={p}
                                    onAddOrder={() => { setSelectedPatientId(p.id); setIsOrderModalOpen(true); }}
                                    onToggleSurgery={() => handleToggleSurgery(p.id)}
                                    onTransfer={() => { setSelectedPatientId(p.id); setTransferMode('TRANSFER'); setIsTransferModalOpen(true); }}
                                    onDischarge={() => { setSelectedPatientId(p.id); setTransferMode('DISCHARGE'); setIsTransferModalOpen(true); }}
                                    onEdit={() => { setSelectedPatientId(p.id); setIsEditModalOpen(true); }}
                                    showDischargeConfirm={true}
                                    onConfirmDischarge={handleConfirmDischarge}
                                    onCompleteOrder={handleToggleCompleteOrder}
                                />
                            ))
                        )}
                     </div>
                )}

                {/* Surgery Schedule View */}
                {currentView === AppView.SURGERY_SCHEDULE && (
                    <div className="space-y-4">
                        {/* Tabs Segmented Control */}
                        <div className="bg-gray-200/50 p-1 rounded-xl flex font-bold text-sm mb-4">
                            <button 
                                onClick={() => setSurgeryTab('WAITING')}
                                className={`flex-1 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${surgeryTab === 'WAITING' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <List size={16}/> Chờ xếp lịch ({unscheduledPatients.length})
                            </button>
                            <button 
                                onClick={() => setSurgeryTab('SCHEDULED')}
                                className={`flex-1 py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${surgeryTab === 'SCHEDULED' ? 'bg-white text-orange-600 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                <CalendarCheck size={16}/> Đã lên lịch ({surgeryGroups.today.length + surgeryGroups.tomorrow.length + surgeryGroups.upcoming.length})
                            </button>
                        </div>

                        {/* TAB 1: WAITING LIST */}
                        {surgeryTab === 'WAITING' && (
                            <div className="space-y-3">
                                {unscheduledPatients.length === 0 ? (
                                    <div className="text-center py-12 text-gray-400">
                                        <p>Không có bệnh nhân chờ xếp lịch.</p>
                                    </div>
                                ) : (
                                    unscheduledPatients.map(p => (
                                        <div key={p.id} className="flex items-center gap-4 p-4 bg-white border border-blue-100 rounded-xl shadow-sm hover:shadow-md transition-shadow relative">
                                            <div className="flex-1">
                                                <div className="font-bold text-slate-800 text-lg">{p.fullName} <span className="font-normal text-sm text-gray-500">({p.age}t)</span></div>
                                                <div className="text-xs text-slate-500 font-bold bg-gray-100 inline-block px-2 py-0.5 rounded mr-2">P.{p.roomNumber}</div>
                                                <div className="text-sm text-slate-600 mt-1">{p.diagnosis}</div>
                                            </div>
                                            {/* Schedule Button */}
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedPatientId(p.id); setIsEditModalOpen(true); }}
                                                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                                            >
                                                <Calendar size={16} /> Xếp lịch
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* TAB 2: SCHEDULED LIST */}
                        {surgeryTab === 'SCHEDULED' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                {/* Today */}
                                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-orange-200 shadow-soft overflow-hidden">
                                    <div 
                                        className="bg-orange-50/50 p-4 flex justify-between items-center cursor-pointer active:bg-orange-100/50 transition-colors"
                                        onClick={() => setExpandedSurgeryGroups(prev => ({...prev, today: !prev.today}))}
                                    >
                                        <h3 className="font-bold text-orange-800 flex items-center gap-2"><Calendar size={20}/> Hôm nay ({surgeryGroups.today.length})</h3>
                                        {expandedSurgeryGroups.today ? <ChevronUp size={20} className="text-orange-400"/> : <ChevronDown size={20} className="text-orange-400"/>}
                                    </div>
                                    {expandedSurgeryGroups.today && (
                                        <div className="p-3 space-y-3">
                                            {surgeryGroups.today.length === 0 && <p className="text-sm text-gray-500 p-2 italic text-center">Không có ca mổ.</p>}
                                            {surgeryGroups.today.map(p => (
                                                <div key={p.id} className="flex items-center gap-4 p-4 bg-white border border-orange-100 rounded-xl shadow-sm hover:shadow-md transition-shadow relative group">
                                                    <div className="flex flex-col items-center min-w-[60px]">
                                                        <div className="font-bold text-2xl text-orange-500 tracking-tighter">{p.surgeryTime || '--:--'}</div>
                                                        {p.operatingRoom && <div className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded mt-1">{p.operatingRoom}</div>}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-slate-800 text-lg">{p.fullName} <span className="font-normal text-sm text-gray-500">({p.age}t)</span></div>
                                                        <div className="text-sm text-gray-600 font-medium mb-1">{p.surgeryMethod}</div>
                                                        {p.surgeonName && <div className="text-xs text-indigo-600 font-semibold">PTV: {p.surgeonName}</div>}
                                                    </div>
                                                    <div className="text-xs font-bold bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full absolute top-4 right-4">P.{p.roomNumber}</div>
                                                    
                                                     <button
                                                        onClick={(e) => { e.stopPropagation(); setSelectedPatientId(p.id); setIsEditModalOpen(true); }}
                                                        className="absolute bottom-4 right-4 bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1.5 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1"
                                                    >
                                                        <Calendar size={12} /> Sửa
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Tomorrow */}
                                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-blue-200 shadow-soft overflow-hidden">
                                    <div 
                                        className="bg-blue-50/50 p-4 flex justify-between items-center cursor-pointer active:bg-blue-100/50 transition-colors"
                                        onClick={() => setExpandedSurgeryGroups(prev => ({...prev, tomorrow: !prev.tomorrow}))}
                                    >
                                        <h3 className="font-bold text-blue-800 flex items-center gap-2"><Calendar size={20}/> Ngày mai ({surgeryGroups.tomorrow.length})</h3>
                                        {expandedSurgeryGroups.tomorrow ? <ChevronUp size={20} className="text-blue-400"/> : <ChevronDown size={20} className="text-blue-400"/>}
                                    </div>
                                    {expandedSurgeryGroups.tomorrow && (
                                        <div className="p-3 space-y-3">
                                            {surgeryGroups.tomorrow.length === 0 && <p className="text-sm text-gray-500 p-2 italic text-center">Không có ca mổ.</p>}
                                            {surgeryGroups.tomorrow.map(p => (
                                                <div key={p.id} className="flex items-center gap-4 p-4 bg-white border border-blue-100 rounded-xl shadow-sm hover:shadow-md transition-shadow relative group">
                                                    <div className="flex flex-col items-center min-w-[60px]">
                                                        <div className="font-bold text-2xl text-blue-500 tracking-tighter">{p.surgeryTime || '--:--'}</div>
                                                        {p.operatingRoom && <div className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded mt-1">{p.operatingRoom}</div>}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-slate-800 text-lg">{p.fullName} <span className="font-normal text-sm text-gray-500">({p.age}t)</span></div>
                                                        <div className="text-sm text-gray-600 font-medium mb-1">{p.diagnosis}</div>
                                                        {p.surgeonName && <div className="text-xs text-indigo-600 font-semibold">PTV: {p.surgeonName}</div>}
                                                    </div>
                                                    <div className="text-xs font-bold bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full absolute top-4 right-4">P.{p.roomNumber}</div>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setSelectedPatientId(p.id); setIsEditModalOpen(true); }}
                                                        className="absolute bottom-4 right-4 bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-lg text-xs font-bold opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1"
                                                    >
                                                        <Calendar size={12} /> Sửa
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Upcoming */}
                                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200 shadow-soft overflow-hidden">
                                    <div 
                                        className="bg-gray-50/50 p-4 flex justify-between items-center cursor-pointer active:bg-gray-100/50 transition-colors"
                                        onClick={() => setExpandedSurgeryGroups(prev => ({...prev, upcoming: !prev.upcoming}))}
                                    >
                                        <h3 className="font-bold text-gray-700 flex items-center gap-2"><Calendar size={20}/> Sắp tới ({surgeryGroups.upcoming.length})</h3>
                                        {expandedSurgeryGroups.upcoming ? <ChevronUp size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}
                                    </div>
                                    {expandedSurgeryGroups.upcoming && (
                                        <div className="p-3 space-y-3">
                                            {surgeryGroups.upcoming.length === 0 && <p className="text-sm text-gray-500 p-2 italic text-center">Không có ca mổ sắp tới.</p>}
                                            {surgeryGroups.upcoming.map(p => (
                                                <div key={p.id} className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow relative">
                                                    <div className="text-sm font-bold text-gray-500 w-16 text-center">{p.surgeryDate?.split('-').reverse().slice(0,2).join('/')}</div>
                                                    <div className="flex-1">
                                                        <div className="font-bold text-slate-800">{p.fullName}</div>
                                                        <div className="text-xs text-gray-500">{p.diagnosis}</div>
                                                    </div>
                                                    {/* Edit Schedule Button - Styled exactly like 'Xếp lịch' but Orange */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setSelectedPatientId(p.id); setIsEditModalOpen(true); }}
                                                        className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md active:scale-95 transition-all flex items-center gap-1.5 shrink-0"
                                                    >
                                                        <Calendar size={16} /> Sửa lịch
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Ward Round & Severe Cases View */}
                {(currentView === AppView.WARD_ROUND || currentView === AppView.SEVERE_CASES) && (
                    <div className="space-y-4">
                        {filteredPatients.length === 0 ? (
                            <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                                <div className="bg-white p-5 rounded-full shadow-sm mb-4">
                                    <UserCheck size={40} className="text-gray-300" />
                                </div>
                                <p className="font-medium text-lg">Không tìm thấy bệnh nhân.</p>
                                <p className="text-sm opacity-70">Thử thay đổi bộ lọc hoặc tìm kiếm.</p>
                            </div>
                        ) : (
                            <>
                                {selectedRoomBlockId ? (
                                    filteredPatients.map(patient => (
                                        <PatientCard 
                                            key={patient.id} 
                                            patient={patient}
                                            onAddOrder={() => { setSelectedPatientId(patient.id); setIsOrderModalOpen(true); }}
                                            onToggleSurgery={() => handleToggleSurgery(patient.id)}
                                            onTransfer={() => { setSelectedPatientId(patient.id); setTransferMode('TRANSFER'); setIsTransferModalOpen(true); }}
                                            onDischarge={() => { setSelectedPatientId(patient.id); setTransferMode('DISCHARGE'); setIsTransferModalOpen(true); }}
                                            onEdit={() => { setSelectedPatientId(patient.id); setIsEditModalOpen(true); }}
                                            onCompleteOrder={handleToggleCompleteOrder}
                                            onQuickSevereToggle={(id) => {
                                                const p = rooms.flatMap(r => r.patients).find(pat => pat.id === id);
                                                if(p) handleUpdatePatient(id, { isSevere: !p.isSevere });
                                            }}
                                        />
                                    ))
                                ) : (
                                    // Group By Block Accordion
                                    rooms.map(block => {
                                        const blockPatients = block.patients.filter(passesGlobalFilters);
                                        if (blockPatients.length === 0) return null;

                                        return (
                                            <div key={block.id} className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-soft border border-white/50 mb-4 overflow-visible">
                                                <div 
                                                    className="px-5 py-4 flex justify-between items-center cursor-pointer active:bg-gray-50/50 rounded-2xl transition-colors"
                                                    onClick={() => setExpandedBlocks(prev => ({...prev, [block.id]: !prev[block.id]}))}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                                                            <Building size={20} />
                                                        </div>
                                                        <span className="font-bold text-slate-800 text-lg">{block.name}</span>
                                                        <span className="bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full text-xs font-bold border border-gray-200">
                                                            {blockPatients.length}
                                                        </span>
                                                    </div>
                                                    {expandedBlocks[block.id] ? <ChevronUp size={20} className="text-gray-400"/> : <ChevronDown size={20} className="text-gray-400"/>}
                                                </div>
                                                
                                                {expandedBlocks[block.id] && (
                                                    <div className="px-3 pb-3 pt-0 overflow-visible">
                                                        {blockPatients.map(patient => (
                                                            <PatientCard 
                                                                key={patient.id} 
                                                                patient={patient}
                                                                onAddOrder={() => { setSelectedPatientId(patient.id); setIsOrderModalOpen(true); }}
                                                                onToggleSurgery={() => handleToggleSurgery(patient.id)}
                                                                onTransfer={() => { setSelectedPatientId(patient.id); setTransferMode('TRANSFER'); setIsTransferModalOpen(true); }}
                                                                onDischarge={() => { setSelectedPatientId(patient.id); setTransferMode('DISCHARGE'); setIsTransferModalOpen(true); }}
                                                                onEdit={() => { setSelectedPatientId(patient.id); setIsEditModalOpen(true); }}
                                                                onCompleteOrder={handleToggleCompleteOrder}
                                                                onQuickSevereToggle={(id) => {
                                                                    const p = rooms.flatMap(r => r.patients).find(pat => pat.id === id);
                                                                    if(p) handleUpdatePatient(id, { isSevere: !p.isSevere });
                                                                }}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </>
                        )}
                    </div>
                )}
            </main>

            {/* Bottom Navigation with Glassmorphism */}
            <nav className="fixed bottom-0 inset-x-0 bg-white/80 backdrop-blur-xl border-t border-gray-200/50 flex justify-around items-center h-[88px] z-40 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
                <button 
                    onClick={() => setCurrentView(AppView.WARD_ROUND)}
                    className={`flex flex-col items-center gap-1.5 w-full h-full justify-center active:scale-95 transition-all ${currentView === AppView.WARD_ROUND ? 'text-medical-600' : 'text-gray-400 hover:text-gray-500'}`}
                >
                    <div className={`p-1 rounded-xl transition-colors ${currentView === AppView.WARD_ROUND ? 'bg-medical-50' : ''}`}>
                         <LayoutDashboard size={24} strokeWidth={currentView === AppView.WARD_ROUND ? 2.5 : 2} />
                    </div>
                    <span className="text-[10px] font-semibold tracking-wide">Đi buồng</span>
                </button>
                <button 
                    onClick={() => setCurrentView(AppView.SEVERE_CASES)}
                    className={`flex flex-col items-center gap-1.5 w-full h-full justify-center active:scale-95 transition-all ${currentView === AppView.SEVERE_CASES ? 'text-red-500' : 'text-gray-400 hover:text-gray-500'}`}
                >
                    <div className={`p-1 rounded-xl transition-colors ${currentView === AppView.SEVERE_CASES ? 'bg-red-50' : ''}`}>
                        <AlertCircle size={24} strokeWidth={currentView === AppView.SEVERE_CASES ? 2.5 : 2} />
                    </div>
                    <span className="text-[10px] font-semibold tracking-wide">Nặng</span>
                </button>
                <button 
                    onClick={() => setCurrentView(AppView.SURGERY_SCHEDULE)}
                    className={`flex flex-col items-center gap-1.5 w-full h-full justify-center active:scale-95 transition-all ${currentView === AppView.SURGERY_SCHEDULE ? 'text-orange-500' : 'text-gray-400 hover:text-gray-500'}`}
                >
                    <div className={`p-1 rounded-xl transition-colors ${currentView === AppView.SURGERY_SCHEDULE ? 'bg-orange-50' : ''}`}>
                        <Calendar size={24} strokeWidth={currentView === AppView.SURGERY_SCHEDULE ? 2.5 : 2} />
                    </div>
                    <span className="text-[10px] font-semibold tracking-wide">Lịch mổ</span>
                </button>
                <button 
                    onClick={() => setCurrentView(AppView.DISCHARGE_LIST)}
                    className={`flex flex-col items-center gap-1.5 w-full h-full justify-center active:scale-95 transition-all ${currentView === AppView.DISCHARGE_LIST ? 'text-green-600' : 'text-gray-400 hover:text-gray-500'}`}
                >
                    <div className={`p-1 rounded-xl transition-colors ${currentView === AppView.DISCHARGE_LIST ? 'bg-green-50' : ''}`}>
                        <LogOut size={24} strokeWidth={currentView === AppView.DISCHARGE_LIST ? 2.5 : 2} />
                    </div>
                    <span className="text-[10px] font-semibold tracking-wide">Ra viện</span>
                </button>
                 <button 
                    onClick={() => setCurrentView(AppView.STATISTICS)}
                    className={`flex flex-col items-center gap-1.5 w-full h-full justify-center active:scale-95 transition-all ${currentView === AppView.STATISTICS ? 'text-purple-600' : 'text-gray-400 hover:text-gray-500'}`}
                >
                    <div className={`p-1 rounded-xl transition-colors ${currentView === AppView.STATISTICS ? 'bg-purple-50' : ''}`}>
                        <PieChart size={24} strokeWidth={currentView === AppView.STATISTICS ? 2.5 : 2} />
                    </div>
                    <span className="text-[10px] font-semibold tracking-wide">Thống kê</span>
                </button>
                <button 
                    onClick={() => setCurrentView(AppView.SETTINGS)}
                    className={`flex flex-col items-center gap-1.5 w-full h-full justify-center active:scale-95 transition-all ${currentView === AppView.SETTINGS ? 'text-slate-800' : 'text-gray-400 hover:text-gray-500'}`}
                >
                    <div className={`p-1 rounded-xl transition-colors ${currentView === AppView.SETTINGS ? 'bg-slate-100' : ''}`}>
                         <SettingsIcon size={24} strokeWidth={currentView === AppView.SETTINGS ? 2.5 : 2} />
                    </div>
                    <span className="text-[10px] font-semibold tracking-wide">Cài đặt</span>
                </button>
            </nav>

            {/* Modals */}
            <AddPatientModal 
                isOpen={isAddPatientModalOpen}
                onClose={() => setIsAddPatientModalOpen(false)}
                onAddPatients={handleAddPatients}
                rooms={rooms}
            />

            <OrderModal 
                isOpen={isOrderModalOpen} 
                onClose={() => setIsOrderModalOpen(false)} 
                onAddOrder={handleAddOrder}
                patientName={selectedPatientName}
                doctors={doctors}
            />

            <TransferModal 
                isOpen={isTransferModalOpen} 
                onClose={() => setIsTransferModalOpen(false)} 
                mode={transferMode}
                patientName={selectedPatientName}
                rooms={rooms}
                currentRoomId={selectedRoomBlockId}
                onConfirm={handleTransferConfirm}
            />

            <PatientEditModal 
                isOpen={isEditModalOpen} 
                onClose={() => setIsEditModalOpen(false)} 
                patient={selectedPatient}
                onSave={handleUpdatePatient}
                // Config Props
                doctors={doctors}
                operatingRooms={operatingRooms}
                anesthesiaMethods={anesthesiaMethods}
                surgeryClassifications={surgeryClassifications}
                surgeryRequirements={surgeryRequirements}
            />
        </div>
    );
};

export default App;
