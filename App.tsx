
import React, { useState, useEffect, useMemo } from 'react';
import { RoomBlock, Patient, AppView, MedicalOrder, PatientStatus, OrderStatus, OrderType } from './types';
import { formatForGoogleSheet } from './services/geminiService';
import { fetchPatients, fetchOrders, savePatient, saveOrder, confirmDischarge, fetchSettings, saveSettings } from './services/api';
import { buildRoomBlocksFromConfig, WardConfig, SettingsPayload } from './services/sheetMapping';
import { syncSurgeryToKhoa } from './services/surgerySync';
import PatientCard from './components/PatientCard';
import OrderModal from './components/OrderModal';
import TransferModal from './components/TransferModal';
import PatientEditModal from './components/PatientEditModal';
import AddPatientModal from './components/AddPatientModal';
import SettingsView from './components/SettingsView';
import StatisticsView from './components/StatisticsView';
import { Stethoscope, Calendar, LayoutDashboard, Plus, Search, Settings as SettingsIcon, ExternalLink, AlertCircle, LogOut, Filter, ChevronDown, ChevronUp, PieChart, UserCheck, Building, List, CalendarCheck, RefreshCw, Menu } from 'lucide-react';

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

/**
 * Normalizes a date string (potentially from Google Sheets) to 'YYYY-MM-DD' format.
 * This avoids timezone issues by only considering the date part.
 * Handles "2024-07-20T17:00:00.000Z" -> "2024-07-21" (if in GMT+7) is wrong.
 * It should be "2024-07-20T17:00:00.000Z" -> "2024-07-20".
 */
const normalizeDateString = (dateStr?: string): string => {
    if (!dateStr) return '';
    // Create a Date object. It will be in the browser's local timezone.
    // '2025-11-24T17:00:00.000Z' in GMT+7 becomes '2025-11-25 00:00:00'.
    const date = new Date(dateStr);
    // Check if the date is valid
    if (isNaN(date.getTime())) {
        // If not a valid ISO string, it might be 'YYYY-MM-DD' already.
        return dateStr.split('T')[0];
    }
    // Use local date parts to construct the YYYY-MM-DD string.
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
};

// Helper to format surgery time from Google Sheets
// Handles: "1899-12-30T01:53:30.000Z" → "01:53" or "08:30" → "08:30"
const formatSurgeryTime = (timeStr?: string): string => {
    if (!timeStr) return '';

    try {
        // If it's already in Vietnamese format "8h30", return as is
        if (timeStr.includes('h')) return timeStr;

        // If it's already HH:mm format, return as is
        if (timeStr.includes(':') && timeStr.length <= 5 && !timeStr.includes('T')) {
            return timeStr;
        }

        // If it's an ISO string (from Sheets or manual input), create a Date object.
        // This will correctly interpret the UTC time and allow us to get local time parts.
        const date = new Date(timeStr);
        if (isNaN(date.getTime())) {
            return timeStr; // Return original string if invalid
        }

        // Use local time parts to construct HH:mm string
        return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    } catch (error) {
        console.error('Error formatting time:', timeStr, error);
        return '';
    }
};

const App: React.FC = () => {
    // --- State with Persistence ---
    const STORAGE_KEY_PREFIX = 'smartround_v5_'; // Keep in sync with surgerySync.ts

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

    // Load Surgery Sheet URL (for department sync)
    const [surgerySheetUrl, setSurgerySheetUrl] = useState<string>(() => {
        return localStorage.getItem(`${STORAGE_KEY_PREFIX}surgery_sheet_url`) || '';
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
    const [admissionDateFilterDate, setAdmissionDateFilterDate] = useState<Date | null>(null); // Filter by specific admission date (null = all)
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferMode, setTransferMode] = useState<'TRANSFER' | 'DISCHARGE'>('TRANSFER');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [showHamburgerMenu, setShowHamburgerMenu] = useState(false);

    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [expandedBlocks, setExpandedBlocks] = useState<{[key: string]: boolean}>({});
    const [activeMenuBlockId, setActiveMenuBlockId] = useState<string | null>(null);

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
    useEffect(() => { localStorage.setItem(`${STORAGE_KEY_PREFIX}surgery_sheet_url`, surgerySheetUrl); }, [surgerySheetUrl]);

    // --- Data Loading Logic ---
    const loadDataFromSheet = async () => {
        setIsLoadingPatients(true);
        try {
            const settings = await fetchSettings();
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
            setRooms(buildRoomBlocksFromConfig(enriched, settings.wards));
            setApiError(null);
            setNotification({ message: 'Đã đồng bộ dữ liệu từ Google Sheet', type: 'success' });
        } catch (error) {
            console.error('Lỗi khi tải dữ liệu từ API:', error);
            setApiError((error as Error)?.message || 'Không tải được dữ liệu từ Google Sheet');
        } finally {
            setIsLoadingPatients(false);
        }
    };

    // --- Init Logic ---
    useEffect(() => {
        // Default expand all blocks initially
        const initialExpanded: {[key: string]: boolean} = {};
        rooms.forEach(r => initialExpanded[r.id] = true);
        setExpandedBlocks(initialExpanded);
    }, []);

    useEffect(() => {
        loadDataFromSheet();
    }, []);

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
            await Promise.all(normalizedPatients.map(patient => savePatient(patient)));
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
            if (!updatedPatient.isScheduledForSurgery && updates.surgeryDate) {
                updatedPatient.isScheduledForSurgery = true;
            }
            savePatient(updatedPatient).catch(error => {
                console.error('Lưu thông tin bệnh nhân thất bại', error);
            });

            // Auto-sync to surgery sheet if surgery info was updated
            const hasSurgeryUpdate =
                updates.surgeryDate !== undefined ||
                updates.surgeryTime !== undefined ||
                updates.surgeryMethod !== undefined ||
                updates.surgeonName !== undefined ||
                updates.operatingRoom !== undefined ||
                updates.anesthesiaMethod !== undefined ||
                updates.surgeryClassification !== undefined ||
                updates.surgeryRequirements !== undefined ||
                updates.surgeryNotes !== undefined;

            // ✅ Tự động đồng bộ khi có update lịch mổ VÀ có ngày mổ (không cần giờ)
            if (hasSurgeryUpdate && updatedPatient.surgeryDate) {
                syncSurgeryToKhoa(updatedPatient)
                    .then(result => {
                        if (result.success) {
                            setNotification({ message: result.message || 'Đã đồng bộ lịch mổ lên khoa', type: 'success' });
                        } else {
                            console.error('Sync surgery failed:', result.error);
                            // Don't show error notification to avoid interrupting workflow
                        }
                    })
                    .catch(error => {
                        console.error('Error syncing surgery:', error);
                    });
            }
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
            await saveOrder(newOrder);
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

    const handleRegisterSurgery = (id: string) => {
        const patient = rooms.flatMap(r => r.patients).find(p => p.id === id);
        if (!patient || patient.isScheduledForSurgery) return;
        handleUpdatePatient(id, { isScheduledForSurgery: true });
    };

    const handleCancelSurgery = (id: string) => {
        const patient = rooms.flatMap(r => r.patients).find(p => p.id === id);
        if (!patient) return;
        handleUpdatePatient(id, {
            isScheduledForSurgery: false,
            surgeryDate: '',
            surgeryTime: ''
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

    const handleConfirmDischarge = (id: string) => {
        if (window.confirm('Xác nhận bệnh nhân đã hoàn tất thủ tục và rời khoa? Bệnh nhân sẽ được lưu hồ sơ.')) {
            const updatedRooms = rooms.map(block => ({
                ...block,
                patients: block.patients.map(p => p.id === id ? { ...p, status: PatientStatus.ARCHIVED } : p)
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
            // [LOGIC CUỐI CÙNG & ĐÃ ĐƯỢC XÁC NHẬN]
            // Một bệnh nhân chỉ được vào tab Lịch mổ KHI VÀ CHỈ KHI `isScheduledForSurgery` là true.
            // `isScheduledForSurgery` đã được chuẩn hóa trong mapRawPatient để bao gồm cả trường hợp có surgeryDate.
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

        // ✅ Admission Date filter - filter by specific date
        if (admissionDateFilterDate && p.admissionDate) {
            // Convert filter date to 'YYYY-MM-DD' string to avoid timezone issues
            const filterDateString = admissionDateFilterDate.toISOString().split('T')[0];
            const admissionDateString = normalizeDateString(p.admissionDate);
            if (admissionDateString !== filterDateString) return false;
        }

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

        // ✅ Helper function to check if patient has valid surgery date (consistent with filter logic)
        const hasSurgeryDate = (p: Patient) => !!p.surgeryDate && p.surgeryDate.trim() !== '';

        // [LOGIC PHÂN NHÓM CUỐI CÙNG & ĐÃ ĐƯỢC XÁC NHẬN]
        // Phân loại bệnh nhân đã qua bộ lọc (những người có isScheduledForSurgery = true) vào 2 nhóm:
        // - waiting: Những người chưa có ngày mổ (nhưng đã đăng ký mổ).
        // - scheduled: Những người đã có ngày mổ.
        const waiting = filteredPatients.filter(p => !hasSurgeryDate(p));
        const scheduled = filteredPatients.filter(p => hasSurgeryDate(p));

        // 🐛 DEBUG: Log để kiểm tra
        console.log('DEBUG Surgery Groups:', {
            today,
            filteredPatientsCount: filteredPatients.length,
            scheduledCount: scheduled.length,
            waitingCount: waiting.length,
            sampleSurgeryDates: scheduled.slice(0, 3).map(p => ({ name: p.fullName, date: p.surgeryDate, time: p.surgeryTime }))
        });

        const groups = {
            today: scheduled.filter(p => {
                const dateOnly = normalizeDateString(p.surgeryDate); // ✅ Extract yyyy-MM-dd from ISO string
                return dateOnly === today;
            }).sort((a, b) => (a.surgeryTime || '').localeCompare(b.surgeryTime || '')),
            tomorrow: scheduled.filter(p => {
                const dateOnly = normalizeDateString(p.surgeryDate);
                return dateOnly === tomorrow;
            }).sort((a, b) => (a.surgeryTime || '').localeCompare(b.surgeryTime || '')),
            upcoming: scheduled.filter(p => {
                const dateOnly = normalizeDateString(p.surgeryDate);
                return dateOnly > tomorrow;
            }).sort((a, b) => a.surgeryDate!.localeCompare(b.surgeryDate!)),
        };

        return { surgeryGroups: groups, unscheduledPatients: waiting };
    }, [filteredPatients]);

    // Count patients for badge indicators
    const severeCount = useMemo(() => {
        return rooms.flatMap(r => r.patients).filter(p =>
            p.isSevere && p.status !== PatientStatus.ARCHIVED
        ).length;
    }, [rooms]);

    // ✅ Badge chỉ đếm bệnh CHỜ XẾP LỊCH (chưa có ngày mổ)
    const surgeryCount = useMemo(() => {
        return rooms.flatMap(r => r.patients).filter(p => {
            const hasSurgeryDate = !!p.surgeryDate && p.surgeryDate.trim() !== '';
            // Chỉ đếm bệnh nhân đã đăng ký mổ NHƯNG chưa có ngày mổ
            return p.isScheduledForSurgery && !hasSurgeryDate && p.status !== PatientStatus.ARCHIVED;
        }).length;
    }, [rooms]);

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
                            <h1 className="font-bold text-slate-800 text-lg tracking-tight">Ngoại CT- Bỏng</h1>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={loadDataFromSheet}
                                disabled={isLoadingPatients}
                                className="bg-blue-500 text-white p-2.5 rounded-full shadow-lg hover:bg-blue-600 active:scale-90 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Làm mới dữ liệu từ Google Sheet"
                            >
                                <RefreshCw size={20} className={isLoadingPatients ? 'animate-spin' : ''} />
                            </button>
                            <button
                                onClick={() => setIsAddPatientModalOpen(true)}
                                className="bg-medical-500 text-white p-2.5 rounded-full shadow-lg hover:bg-medical-600 active:scale-90 transition-all duration-200"
                            >
                                <Plus size={24} />
                            </button>
                            <div className="relative">
                                <button
                                    onClick={() => setShowHamburgerMenu(!showHamburgerMenu)}
                                    className="bg-gray-100 text-gray-700 p-2.5 rounded-full shadow-md hover:bg-gray-200 active:scale-90 transition-all duration-200"
                                    title="Menu"
                                >
                                    <Menu size={20} />
                                </button>
                                {showHamburgerMenu && (
                                    <div className="absolute top-12 right-0 bg-white shadow-2xl border border-gray-100 rounded-2xl py-2 w-48 z-50 animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                                        <button
                                            onClick={() => {
                                                setCurrentView(AppView.STATISTICS);
                                                setShowHamburgerMenu(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-gray-50 flex items-center gap-3 font-medium"
                                        >
                                            <PieChart size={18} className="text-purple-500" />
                                            Thống kê
                                        </button>
                                        <button
                                            onClick={() => {
                                                setCurrentView(AppView.SETTINGS);
                                                setShowHamburgerMenu(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-gray-50 flex items-center gap-3 font-medium"
                                        >
                                            <SettingsIcon size={18} className="text-slate-500" />
                                            Cài đặt
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
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

                                {/* Date Picker with +/- buttons */}
                                <div className="flex items-center gap-1 bg-white border border-gray-200/80 rounded-xl px-2 py-1.5 shadow-sm">
                                    <button
                                        onClick={() => {
                                            if (!admissionDateFilterDate) {
                                                // If no date selected, start with today
                                                setAdmissionDateFilterDate(new Date());
                                            } else {
                                                // Decrease date by 1 day
                                                const newDate = new Date(admissionDateFilterDate);
                                                newDate.setDate(newDate.getDate() - 1);
                                                setAdmissionDateFilterDate(newDate);
                                            }
                                        }}
                                        className="text-gray-600 hover:text-medical-500 hover:bg-medical-50 rounded-lg p-1 transition-colors active:scale-95"
                                    >
                                        <ChevronDown size={16} className="rotate-90" />
                                    </button>
                                    <input
                                        type="date"
                                        value={admissionDateFilterDate ? admissionDateFilterDate.toISOString().split('T')[0] : ''}
                                        onChange={(e) => setAdmissionDateFilterDate(e.target.value ? new Date(e.target.value) : null)}
                                        className="text-xs font-medium text-gray-700 border-none bg-transparent focus:outline-none focus:ring-0 w-[100px] text-center"
                                        placeholder="Chọn ngày"
                                    />
                                    <button
                                        onClick={() => {
                                            if (!admissionDateFilterDate) {
                                                // If no date selected, start with today
                                                setAdmissionDateFilterDate(new Date());
                                            } else {
                                                // Increase date by 1 day
                                                const newDate = new Date(admissionDateFilterDate);
                                                newDate.setDate(newDate.getDate() + 1);
                                                setAdmissionDateFilterDate(newDate);
                                            }
                                        }}
                                        className="text-gray-600 hover:text-medical-500 hover:bg-medical-50 rounded-lg p-1 transition-colors active:scale-95"
                                    >
                                        <ChevronDown size={16} className="-rotate-90" />
                                    </button>
                                    {admissionDateFilterDate && (
                                        <button
                                            onClick={() => setAdmissionDateFilterDate(null)}
                                            className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg p-1 transition-colors ml-1"
                                            title="Xóa bộ lọc"
                                        >
                                            <span className="text-xs font-bold">×</span>
                                        </button>
                                    )}
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
                        surgerySheetUrl={surgerySheetUrl}
                        onUpdateSurgerySheetUrl={setSurgerySheetUrl}
                        onConfigChange={markConfigDirty}
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
                                    onRegisterSurgery={() => handleRegisterSurgery(p.id)}
                                    onCancelSurgery={() => handleCancelSurgery(p.id)}
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
                        {/* Tabs Segmented Control + Sync Button */}
                        <div className="flex gap-3 items-center">
                            <div className="bg-gray-200/50 p-1 rounded-xl flex font-bold text-sm flex-1">
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
                                                        <div className="font-bold text-2xl text-orange-500 tracking-tighter">{formatSurgeryTime(p.surgeryTime) || '--:--'}</div>
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
                                                        <div className="font-bold text-2xl text-blue-500 tracking-tighter">{formatSurgeryTime(p.surgeryTime) || '--:--'}</div>
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
                                        {surgeryGroups.upcoming.sort((a, b) => (a.surgeryDate || '').localeCompare(b.surgeryDate || '')).map(p => (
                                                <div key={p.id} className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow relative">
                                                    <div className="text-sm font-bold text-gray-500 w-16 text-center">{p.surgeryDate?.split('T')[0].split('-').reverse().slice(0,2).join('/')}</div>
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
                                            onRegisterSurgery={() => handleRegisterSurgery(patient.id)}
                                            onCancelSurgery={() => handleCancelSurgery(patient.id)}
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
                                            <div key={block.id} className={`bg-white/70 backdrop-blur-sm rounded-2xl shadow-soft border border-white/50 mb-4 overflow-visible relative transition-shadow ${activeMenuBlockId === block.id ? 'z-10 shadow-2xl' : 'z-0'}`}>
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
                                                                onRegisterSurgery={() => handleRegisterSurgery(patient.id)}
                                                                onCancelSurgery={() => handleCancelSurgery(patient.id)}
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

            {/* Bottom Navigation with Pill Shape */}
            <nav className="fixed bottom-0 inset-x-0 flex justify-center z-40 pb-6">
                <div className="bg-gray-200 backdrop-blur-xl rounded-full flex justify-around items-center h-[72px] mx-4 px-4 shadow-lg max-w-2xl w-full">
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
                    <div className={`p-1 rounded-xl transition-colors relative ${currentView === AppView.SEVERE_CASES ? 'bg-red-50' : ''}`}>
                        <AlertCircle size={24} strokeWidth={currentView === AppView.SEVERE_CASES ? 2.5 : 2} />
                        {severeCount > 0 && (
                            <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full animate-pulse shadow-lg flex items-center justify-center px-1">
                                <span className="text-white text-[10px] font-bold">{severeCount}</span>
                            </div>
                        )}
                    </div>
                    <span className="text-[10px] font-semibold tracking-wide">Nặng</span>
                </button>
                <button
                    onClick={() => setCurrentView(AppView.SURGERY_SCHEDULE)}
                    className={`flex flex-col items-center gap-1.5 w-full h-full justify-center active:scale-95 transition-all ${currentView === AppView.SURGERY_SCHEDULE ? 'text-blue-500' : 'text-gray-400 hover:text-gray-500'}`}
                >
                    <div className={`p-1 rounded-xl transition-colors relative ${currentView === AppView.SURGERY_SCHEDULE ? 'bg-blue-50' : ''}`}>
                        <Calendar size={24} strokeWidth={currentView === AppView.SURGERY_SCHEDULE ? 2.5 : 2} />
                        {surgeryCount > 0 && (
                            <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-blue-500 rounded-full animate-pulse shadow-lg flex items-center justify-center px-1">
                                <span className="text-white text-[10px] font-bold">{surgeryCount}</span>
                            </div>
                        )}
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
                </div>
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
