import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Patient, OrderStatus, PatientStatus, OrderType } from '../types';
import { Calendar, ClipboardList, MoreHorizontal, LogOut, ArrowRightLeft, Activity, Edit3, Syringe, Clock, Square, AlertTriangle, AlertCircle, ChevronDown, ChevronRight, Plus } from 'lucide-react';

interface PatientCardProps {
    patient: Patient;
    onAddOrder: (patientId: string) => void;
    onRegisterSurgery?: (patientId: string) => void;
    onCancelSurgery?: (patientId: string) => void;
    onTransfer: (patientId: string) => void;
    onDischarge: (patientId: string) => void;
    onEdit: (patientId: string) => void;
    showDischargeConfirm?: boolean;
    onConfirmDischarge?: (patientId: string) => void;
    onCompleteOrder?: (patientId: string, orderId: string) => void;
    onQuickSevereToggle?: (patientId: string) => void;
}

const PatientCard: React.FC<PatientCardProps> = ({ patient, onAddOrder, onRegisterSurgery, onCancelSurgery, onTransfer, onDischarge, onEdit, showDischargeConfirm, onConfirmDischarge, onCompleteOrder, onQuickSevereToggle }) => {
    const [expanded, setExpanded] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ top: number, right: number } | null>(null);
    const [showDetails, setShowDetails] = useState(false); 
    const [showAllOrders, setShowAllOrders] = useState(false);

    const triggerRef = useRef<HTMLButtonElement>(null);

    const todayStr = useMemo(() => {
        const today = new Date();
        return today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    }, []);

    // Normalize date string to YYYY-MM-DD format (remove time component)
    const normalizeDateString = (dateStr: string): string => {
        if (!dateStr) return '';
        // If already in YYYY-MM-DD format, return as-is
        if (dateStr.length === 10 && !dateStr.includes('T')) return dateStr;
        // Extract date part from ISO string
        return dateStr.split('T')[0];
    };
    
    // --- SAFE DATA HELPERS (Vệ sĩ dữ liệu) ---
    // Hàm này đảm bảo giá trị luôn là chuỗi, tránh lỗi .split() is not a function
    const safeString = (val: any): string => {
        if (!val) return '';
        if (typeof val === 'string') return val;
        // Nếu là Object có toDate (Firebase Timestamp)
        if (typeof val === 'object' && val.toDate && typeof val.toDate === 'function') {
            try { return val.toDate().toISOString(); } catch { return ''; }
        }
        return String(val); // Fallback về chuỗi
    };

    const formatDateVN = (isoDate?: any) => {
        const str = safeString(isoDate);
        if (!str) return '';
        try {
            const datePart = str.includes('T') ? str.split('T')[0] : str;
            const parts = datePart.split('-');
            if (parts.length === 3) {
                const [y, m, d] = parts;
                return `${d}/${m}/${y}`;
            }
            return str;
        } catch (e) { return ''; }
    }

    const formatDateShort = (isoDate?: any) => {
        const str = safeString(isoDate);
        if (!str) return '';
        try {
            const datePart = str.includes('T') ? str.split('T')[0] : str;
            const parts = datePart.split('-');
            if (parts.length === 3) {
                const [, m, d] = parts;
                return `${d}/${m}`;
            }
            return str;
        } catch (e) { return ''; }
    }
    // ------------------------------------------

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!showMenu) return; 
            const menuElement = document.getElementById(`menu-portal-${patient.id}`);
            if (triggerRef.current && !triggerRef.current.contains(event.target as Node) &&
                menuElement && !menuElement.contains(event.target as Node)) {
                    setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMenu, patient.id]);
    
    // Logic Lọc Y lệnh an toàn
    const ordersSafe = Array.isArray(patient.orders) ? patient.orders : [];
    // Filter out DISCHARGE orders - they're already shown on the card
    const pendingOrders = ordersSafe.filter(o => o.status === OrderStatus.PENDING && o.type !== OrderType.DISCHARGE);
    
    const todayOrders = pendingOrders.filter(o => {
        const d = normalizeDateString(safeString(o.executionDate));
        return d === todayStr;
    });

    const upcomingOrders = pendingOrders.filter(o => {
        const d = normalizeDateString(safeString(o.executionDate));
        return d > todayStr; // Only dates AFTER today
    }).sort((a, b) => {
        // Sort by execution date ascending (closest dates first)
        const dateA = normalizeDateString(safeString(a.executionDate));
        const dateB = normalizeDateString(safeString(b.executionDate));
        return dateA.localeCompare(dateB);
    });

    const overdueOrders = pendingOrders.filter(o => {
        const d = normalizeDateString(safeString(o.executionDate));
        return d < todayStr; // Dates BEFORE today (overdue)
    }).sort((a, b) => {
        // Sort by execution date descending (most recent first)
        const dateA = normalizeDateString(safeString(a.executionDate));
        const dateB = normalizeDateString(safeString(b.executionDate));
        return dateB.localeCompare(dateA);
    });

    const hasPendingOrders = pendingOrders.length > 0;
    const isDischarged = patient.status === PatientStatus.DISCHARGED;

    // Logic Khẩn cấp an toàn (Sửa lỗi crash tại đây)
    const getUrgentInfo = () => {
        const surgeryDateSafe = safeString(patient.surgeryDate);
        const dischargeDateSafe = safeString(patient.dischargeDate);

        // Chỉ split nếu chuỗi có chứa 'T' hoặc '-'
        const sDate = surgeryDateSafe.includes('T') ? surgeryDateSafe.split('T')[0] : surgeryDateSafe;
        const dDate = dischargeDateSafe.includes('T') ? dischargeDateSafe.split('T')[0] : dischargeDateSafe;

        const hasSurgeryToday = patient.isScheduledForSurgery && !!sDate && sDate === todayStr;
        const hasDischargeToday = !!dDate && dDate === todayStr && patient.dischargeConfirmed !== true;

        let isDischargeOverdue = false;
        if (dDate && !isDischarged) {
            isDischargeOverdue = dDate < todayStr;
        }

        return { hasSurgeryToday, hasDischargeToday, isDischargeOverdue };
    };

    const urgentInfo = getUrgentInfo();

    const getDiffDays = (val?: any) => {
        const dateStr = safeString(val);
        if (!dateStr) return 0;
        const start = new Date(dateStr);
        if (isNaN(start.getTime())) return 0;
        
        start.setHours(0,0,0,0);
        const now = new Date();
        now.setHours(0,0,0,0);
        const diffTime = now.getTime() - start.getTime(); 
        return Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
    };

    // --- Status Badge Logic ---
    let rightSideBadge = null;
    let postOpDays = null;
    
    const surgeryDateStr = safeString(patient.surgeryDate);
    const admissionDateStr = safeString(patient.admissionDate);

    if (patient.isScheduledForSurgery && surgeryDateStr && new Date(surgeryDateStr) <= new Date()) {
        const days = Math.abs(getDiffDays(surgeryDateStr));
        postOpDays = days;
        rightSideBadge = (
            <div className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border shadow-sm ${days <= 1 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                HP-{days}
            </div>
        );
    } else {
        const days = Math.abs(getDiffDays(admissionDateStr)) + 1;
        rightSideBadge = (
            <div className="bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border border-amber-100 shadow-sm">
                TP-{days}
            </div>
        );
    }

    const hospitalDays = Math.abs(getDiffDays(admissionDateStr)) + 1;
    const isSevere = patient.isSevere;

    const isNewPatient = () => {
        if (!admissionDateStr) return false;
        const entryStr = safeString(patient.roomEntryDate);

        if (!entryStr) {
            const adm = new Date(admissionDateStr);
            const now = new Date();
            const diff = (now.getTime() - adm.getTime()) / (1000 * 3600 * 24);
            return diff <= 1.5; 
        }
        const entry = new Date(entryStr);
        if (isNaN(entry.getTime())) return false;

        const limitDate = new Date(entry);
        limitDate.setDate(limitDate.getDate() + 1);
        limitDate.setHours(23, 59, 59, 999);
        return new Date() <= limitDate;
    };
    const isNew = isNewPatient();

    const getRoomTag = () => {
        const roomRaw = safeString(patient.roomNumber).trim();
        const wardRaw = safeString(patient.ward).trim();
        const source = roomRaw || wardRaw;
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
        if (words.length === 0) return source.slice(0,4).toUpperCase();
        if (words.length === 1) return words[0].slice(0,6).toUpperCase();
        return words.slice(0,2).map(w => (w[0] || '').toUpperCase()).join('');
    };
    const roomTag = getRoomTag();

    const getCardStyle = () => {
        if (patient.status === PatientStatus.DISCHARGED) return 'bg-slate-50 opacity-60 shadow-sm';
        if (isSevere) return 'bg-white [box-shadow:0_0_8px_rgba(239,68,68,0.4),0_1px_3px_0_rgba(0,0,0,0.1)]';
        if (isNew) return 'bg-white shadow-sm';
        return 'bg-white shadow-sm';
    };

    const getStatusLineClass = () => {
        if (patient.status === PatientStatus.DISCHARGED) return 'bg-slate-300';
        if (isSevere) return 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.35)]';
        if (isNew) return 'bg-emerald-500';
        return 'bg-blue-500';
    };

    return (
        <div className={`relative rounded-2xl mb-3 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] ${getCardStyle()}`}>
            <span
                className={`absolute left-2 top-2 bottom-2 w-1.5 rounded-full ${getStatusLineClass()}`}
                aria-hidden="true"
            />
            
            <div className="p-3 pl-8 flex items-start gap-3 cursor-pointer" onClick={() => !showMenu && setExpanded(!expanded)}>
                <div className="flex flex-col items-center gap-2 pt-0.5 w-5 shrink-0">
                    {isSevere && (
                         <div className="text-red-500 animate-pulse drop-shadow-sm" title="Bệnh nặng">
                             <AlertTriangle size={20} className="fill-red-50"/>
                         </div>
                    )}
                    {hasPendingOrders && !isDischarged && (
                        <div className="relative">
                             <div className="absolute -right-0.5 -top-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white"></div>
                             <ClipboardList size={18} className="text-slate-400"/>
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1.5">
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800 truncate text-base tracking-tight">
                                {patient.fullName}
                            </h3>
                            <span className="text-[11px] font-bold text-slate-500 bg-white/60 px-1.5 py-0.5 rounded-md border border-slate-200/50">
                                {patient.age}t
                            </span>
                        </div>
                        <div className="flex flex-col items-end shrink-0 ml-2 text-right">
                            <div className="flex items-center gap-1">
                                {roomTag && (
                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100/70 px-2 py-0.5 rounded-full border border-slate-200/70">
                                        {roomTag}
                                    </span>
                                )}
                                {rightSideBadge}
                            </div>
                        </div>
                    </div>

                    <p className="text-sm font-medium text-slate-600 line-clamp-1 mb-1.5 leading-relaxed">{patient.diagnosis}</p>

                    <div className="flex flex-wrap gap-1.5">
                        {patient.isScheduledForSurgery && (!surgeryDateStr || surgeryDateStr >= todayStr) && (
                            <div className="flex items-center gap-1 text-[10px] text-[#f97316] bg-[#fff7ed] px-2 py-0.5 rounded-full border border-[#fed7aa] font-bold">
                                {urgentInfo.hasSurgeryToday && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#f97316] animate-pulse"></div>
                                )}
                                <Calendar size={10} />
                                <span>PT: {surgeryDateStr ? formatDateShort(surgeryDateStr) : 'Chờ lịch'}</span>
                            </div>
                        )}

                        {patient.dischargeDate && patient.dischargeConfirmed !== true && (
                            <div className="flex items-center gap-1 text-[10px] text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200 font-bold">
                                {urgentInfo.hasDischargeToday && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></div>
                                )}
                                {urgentInfo.isDischargeOverdue && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse"></div>
                                )}
                                <LogOut size={10} />
                                <span>Rv: {formatDateShort(patient.dischargeDate)}</span>
                            </div>
                        )}
                    </div>
                </div>

                <button
                    ref={triggerRef}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (triggerRef.current) {
                            const rect = triggerRef.current.getBoundingClientRect();
                            setMenuPosition({
                                top: rect.bottom + 8,
                                right: window.innerWidth - rect.right,
                            });
                        }
                        setShowMenu(prev => !prev);
                    }}
                    className="p-2 -mr-2 text-gray-400 hover:text-medical-600 active:bg-black/5 rounded-full transition-colors"
                >
                    <MoreHorizontal size={24} />
                </button>
            </div>

            {showMenu && menuPosition && ReactDOM.createPortal(
                 <div
                    id={`menu-portal-${patient.id}`}
                    style={{
                        position: 'fixed',
                        top: `${menuPosition.top}px`,
                        right: `${menuPosition.right}px`,
                    }}
                    className="bg-white/95 backdrop-blur-2xl shadow-2xl border border-gray-100 rounded-2xl py-2 w-60 animate-in fade-in zoom-in-95 duration-200 origin-top-right ring-1 ring-black/5 z-[100]"
                 >
                     <button onClick={() => { onEdit(patient.id); setShowMenu(false); }} className="w-full text-left px-4 py-3.5 text-sm text-slate-700 hover:bg-gray-50 flex items-center gap-3 font-medium">
                         <Edit3 size={18} className="text-slate-400" /> Sửa chi tiết
                     </button>
                     <button onClick={() => { onTransfer(patient.id); setShowMenu(false); }} className="w-full text-left px-4 py-3.5 text-sm text-slate-700 hover:bg-gray-50 flex items-center gap-3 font-medium">
                         <ArrowRightLeft size={18} className="text-slate-400" /> Chuyển phòng
                     </button>
                     <button 
                          onClick={(e) => { e.stopPropagation(); onQuickSevereToggle && onQuickSevereToggle(patient.id); setShowMenu(false); }}
                          className="w-full text-left px-4 py-3.5 text-sm hover:bg-gray-50 flex items-center gap-3 font-bold"
                     >
                         <AlertCircle size={18} className={patient.isSevere ? 'text-gray-400' : 'text-red-500'} /> 
                         <span className={patient.isSevere ? 'text-slate-600' : 'text-red-600'}>
                             {patient.isSevere ? 'Hủy Bệnh nặng' : 'Đánh dấu Bệnh nặng'}
                         </span>
                     </button>
 
                     <div className="border-t border-gray-100 my-1"></div>
                     
                     {(() => {
                         const hasSurgeryDate = !!surgeryDateStr && surgeryDateStr.trim() !== '';
 
                         if (hasSurgeryDate) {
                             return (
                                 <button onClick={() => { onEdit(patient.id); setShowMenu(false); }} className="w-full text-left px-4 py-3.5 text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-3 font-bold">
                                     <Syringe size={18} /> Sửa lịch mổ
                                 </button>
                             );
                         } else if (patient.isScheduledForSurgery) {
                             return (
                                 <button onClick={() => { onCancelSurgery && onCancelSurgery(patient.id); setShowMenu(false); }} className="w-full text-left px-4 py-3.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 font-bold">
                                     <Syringe size={18} /> Hủy đăng ký mổ
                                 </button>
                             );
                         } else {
                             return (
                                 <button onClick={() => { onRegisterSurgery && onRegisterSurgery(patient.id); setShowMenu(false); }} className="w-full text-left px-4 py-3.5 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-3 font-bold">
                                     <Syringe size={18} /> Đăng ký mổ
                                 </button>
                             );
                         }
                     })()}
                 </div>,
                 document.body
            )}

            {expanded && (
                <div className="border-t border-gray-100 p-4 animate-in slide-in-from-top-2 duration-300 rounded-b-2xl text-sm text-slate-800 relative z-0 bg-gray-50/50">
                    <div 
                        className="flex items-center gap-2 mb-4 cursor-pointer select-none text-slate-500 hover:text-medical-600 transition-colors group"
                        onClick={() => setShowDetails(!showDetails)}
                    >
                        <div className="p-1.5 rounded-full bg-white border border-gray-200 shadow-sm group-hover:border-medical-200 transition-colors">
                             {showDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </div>
                        <span className="font-bold text-xs uppercase tracking-wider">Thông tin chi tiết bệnh án</span>
                    </div>

                    {showDetails && (
                        <div className="mb-6 animate-in fade-in slide-in-from-top-1 duration-200 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3 mb-4 pb-4 border-b border-gray-100 border-dashed">
                                <div className="flex items-baseline gap-2 whitespace-nowrap">
                                    <span className="text-slate-400 text-[11px] uppercase font-bold tracking-wide">Ngày vào:</span>
                                    <span className="font-bold text-slate-900 text-base">{formatDateVN(admissionDateStr)}</span>
                                    <span className="text-[10px] text-medical-700 font-bold bg-medical-50 border border-medical-100 px-2 py-0.5 rounded-full ml-1">Ngày {hospitalDays}</span>
                                </div>
                                <div className="flex items-baseline gap-2 flex-1 min-w-[200px]">
                                    <span className="text-slate-400 text-[11px] uppercase font-bold tracking-wide shrink-0">Chẩn đoán:</span>
                                    <span className="font-medium text-slate-900 leading-snug">{patient.diagnosis}</span>
                                </div>
                            </div>

                            {patient.isScheduledForSurgery && (
                                <div className="mb-4 pb-4 border-b border-gray-100 border-dashed bg-orange-50/50 rounded-xl p-3 border border-orange-100/50">
                                    <div className="flex items-center gap-2 mb-3 text-orange-800 font-bold text-xs uppercase tracking-wide">
                                        <Syringe size={14}/> Thông tin Phẫu Thuật
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-2">
                                        <div className="flex flex-col">
                                            <span className="text-orange-600/70 text-[10px] font-bold uppercase mb-0.5">Ngày mổ</span>
                                            <span className="font-bold text-slate-900">{surgeryDateStr ? formatDateVN(surgeryDateStr) : 'Chưa xếp'}</span>
                                        </div>
                                        {postOpDays !== null && (
                                            <div className="flex flex-col">
                                                <span className="text-orange-600/70 text-[10px] font-bold uppercase mb-0.5">Hậu phẫu</span>
                                                <span className="font-bold text-orange-600">Ngày thứ {postOpDays}</span>
                                            </div>
                                        )}
                                        {patient.surgeryMethod && (
                                            <div className="col-span-2 mt-1">
                                                <span className="text-orange-600/70 text-[10px] font-bold uppercase mb-0.5 block">Phương pháp</span>
                                                <span className="font-medium text-slate-900 bg-white/80 px-2 py-1 rounded-lg block border border-orange-100 shadow-sm">{patient.surgeryMethod}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            <div>
                                <span className="font-bold flex items-center gap-1.5 text-slate-400 text-[11px] uppercase mb-2 tracking-wide">
                                    <Activity size={14}/> Tình trạng / Diễn biến
                                </span>
                                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-slate-700 leading-relaxed whitespace-pre-line">
                                    {patient.historySummary}
                                </div>
                            </div>
                        </div>
                    )}

                    {!isDischarged && (
                        <div className="space-y-4 mb-2">
                            {/* Overdue Orders - Shown FIRST with red warning */}
                            {overdueOrders.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.6)]"></div>
                                        <span className="text-xs font-bold text-red-600 uppercase tracking-wide">Quá hạn ({overdueOrders.length})</span>
                                    </div>
                                    <div className="space-y-2 pl-2 border-l-2 border-red-300 ml-1.5">
                                        {overdueOrders.map(order => (
                                            <div key={order.id} className="bg-red-50 p-3 rounded-xl border border-red-200 text-sm shadow-sm flex items-start gap-2.5 group hover:border-red-300 transition-colors">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onCompleteOrder && onCompleteOrder(patient.id, order.id); }}
                                                    className="mt-0.5 text-gray-300 hover:text-green-500 transition-colors shrink-0 p-1 hover:bg-green-50 rounded"
                                                >
                                                    <Square size={22} />
                                                </button>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <Clock size={12} className="text-red-500"/>
                                                        <span className="font-bold text-red-600 text-xs bg-red-100 px-1.5 py-0.5 rounded">{formatDateVN(order.executionDate)}</span>
                                                    </div>
                                                    <p className="text-slate-800 font-medium text-sm">{order.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Y lệnh hôm nay ({todayOrders.length})</span>
                                </div>
                                {todayOrders.length === 0 ? (
                                    <div className="text-xs text-slate-400 italic pl-6 py-2 bg-white rounded-xl border border-dashed border-gray-200">Chưa có y lệnh hôm nay.</div>
                                ) : (
                                    <div className="space-y-2 pl-2 border-l-2 border-slate-200 ml-1.5">
                                        {(showAllOrders ? todayOrders : todayOrders.slice(0, 4)).map(order => (
                                            <div key={order.id} className="bg-white p-3 rounded-xl border border-gray-100 text-sm shadow-sm flex items-start gap-2.5 group hover:border-green-200 transition-colors">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onCompleteOrder && onCompleteOrder(patient.id, order.id); }}
                                                    className="mt-0.5 text-gray-300 hover:text-green-500 transition-colors shrink-0 p-1 hover:bg-green-50 rounded"
                                                >
                                                    <Square size={22} />
                                                </button>
                                                <div className="flex-1 pt-0.5">
                                                    <p className="text-slate-800 font-medium text-sm leading-snug">{order.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {!showAllOrders && todayOrders.length > 4 && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setShowAllOrders(true); }}
                                                className="w-full text-center py-2.5 text-sm font-bold text-medical-600 hover:text-medical-700 bg-medical-50 hover:bg-medical-100 rounded-xl border border-medical-200 transition-colors"
                                            >
                                                Xem thêm {todayOrders.length - 4} y lệnh...
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {upcomingOrders.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3 mt-5">
                                        <div className="w-2.5 h-2.5 rounded-full bg-blue-400"></div>
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Sắp tới ({upcomingOrders.length})</span>
                                    </div>
                                    <div className="space-y-2 pl-2 border-l-2 border-dashed border-slate-200 ml-1.5 opacity-75 hover:opacity-100 transition-opacity">
                                        {upcomingOrders.map(order => (
                                            <div key={order.id} className="bg-white/50 p-3 rounded-xl border border-gray-200 text-sm flex items-start gap-3">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onCompleteOrder && onCompleteOrder(patient.id, order.id); }}
                                                    className="mt-0.5 text-gray-300 hover:text-green-500 transition-colors shrink-0"
                                                >
                                                    <Square size={18} />
                                                </button>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-1.5 mb-1">
                                                        <Clock size={12} className="text-blue-500"/>
                                                        <span className="font-bold text-blue-600 text-xs bg-blue-50 px-1.5 py-0.5 rounded">{formatDateVN(order.executionDate)}</span>
                                                    </div>
                                                    <p className="text-slate-600 text-sm">{order.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {!isDischarged && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onAddOrder(patient.id); }}
                            className="w-full bg-medical-500 text-white py-2.5 rounded-2xl text-xs font-bold hover:bg-medical-600 shadow-lg shadow-medical-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all mt-4"
                        >
                            <Plus size={18} /> Thêm Y Lệnh Mới
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default PatientCard;
