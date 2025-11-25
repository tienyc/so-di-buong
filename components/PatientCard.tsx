
import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Patient, OrderStatus, PatientStatus } from '../types';
import { Calendar, ClipboardList, MoreHorizontal, LogOut, ArrowRightLeft, Activity, Edit3, Syringe, Clock, Square, AlertTriangle, AlertCircle, Sparkles, ChevronDown, ChevronRight, Plus } from 'lucide-react';

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
    const [showDetails, setShowDetails] = useState(false); // Collapsible details state

    // Ref for menu trigger to handle blur/focus
    const triggerRef = useRef<HTMLButtonElement>(null);

    const todayStr = new Date().toISOString().split('T')[0];
    
    // Handle Click Outside to Close Menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            // If menu is not open, do nothing.
            // This check is important to prevent unnecessary logic when menu is already closed.
            if (!showMenu) return; 

            // Check if the click occurred outside the trigger button AND outside the menu portal itself.
            // This ensures that clicks inside the menu (on its buttons) are processed,
            // and clicks outside both the trigger and the menu will close the menu.
            // We need to check for the menuElement because the menu is rendered in a portal,
            // so its DOM position is not within the PatientCard's hierarchy.
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
    
    // Helper to format Date string to DD/MM/YYYY safe
    const formatDateVN = (isoDate: string) => {
        if (!isoDate) return '';
        const datePart = isoDate.split('T')[0]; 
        const [y, m, d] = datePart.split('-');
        return `${d}/${m}/${y}`;
    }

    // Filter pending orders
    const pendingOrders = patient.orders.filter(o => o.status === OrderStatus.PENDING);
    
    // Strict date filtering logic
    const todayOrders = pendingOrders.filter(o => {
        const orderDate = o.executionDate.split('T')[0];
        return orderDate === todayStr;
    });
    
    const upcomingOrders = pendingOrders.filter(o => {
        const orderDate = o.executionDate.split('T')[0];
        return orderDate > todayStr;
    });
    
    const hasPendingOrders = pendingOrders.length > 0;

    const getDiffDays = (dateStr: string) => {
        if (!dateStr) return 0;
        const start = new Date(dateStr);
        // Normalize to start of day to avoid hourly diff
        start.setHours(0,0,0,0);
        const now = new Date();
        now.setHours(0,0,0,0);
        const diffTime = now.getTime() - start.getTime(); 
        return Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
    };

    // --- Status Badge Logic (TP/HP) ---
    let rightSideBadge = null;
    let postOpDays = null;

    // Check strictly if scheduled for surgery AND has a date in the past/today
    if (patient.isScheduledForSurgery && patient.surgeryDate && new Date(patient.surgeryDate) <= new Date()) {
        // Hậu phẫu (Post-op)
        const days = Math.abs(getDiffDays(patient.surgeryDate));
        postOpDays = days;

        // ✅ Tag HP-ngày: Đỏ nếu ngày 0-1, xanh nếu > 1
        rightSideBadge = (
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border shadow-sm ${days <= 1 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                HP-{days}
            </div>
        );
    } else {
        // Tiền phẫu (Pre-op) - Add +1 to count current day as Day 1
        const days = Math.abs(getDiffDays(patient.admissionDate)) + 1;
        rightSideBadge = (
            <div className="bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap border border-amber-100 shadow-sm">
                TP-{days}
            </div>
        );
    }

    const hospitalDays = Math.abs(getDiffDays(patient.admissionDate)) + 1;

    // --- Card Color Logic ---
    // ✅ Chỉ dùng manual flag, KHÔNG tự động thêm viền đỏ cho hậu phẫu
    const isSevere = patient.isSevere;

    const isNewPatient = () => {
        if (!patient.roomEntryDate) {
            const adm = new Date(patient.admissionDate);
            const now = new Date();
            const diff = (now.getTime() - adm.getTime()) / (1000 * 3600 * 24);
            return diff <= 1.5; 
        }
        const entry = new Date(patient.roomEntryDate);
        const limitDate = new Date(entry);
        limitDate.setDate(limitDate.getDate() + 1);
        limitDate.setHours(23, 59, 59, 999);
        return new Date() <= limitDate;
    };
    const isNew = isNewPatient();

    const getCardStyle = () => {
        if (patient.status === PatientStatus.DISCHARGED) return 'bg-slate-50 border-slate-200 opacity-60';
        
        // Severe: White Background, Red Border, Red Glow Shadow
        if (isSevere) return 'bg-white border-2 border-red-500 shadow-[0_4px_20px_-4px_rgba(239,68,68,0.3)]';

        // New Patient: White Background, Green Border, Green Glow Shadow
        if (isNew) return 'bg-white border-2 border-emerald-500 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.3)]';
        
        // Standard style: White Background, Light Border, Soft Shadow
        return 'bg-white shadow-soft border border-slate-100'; 
    };

    const isDischarged = patient.status === PatientStatus.DISCHARGED;

    return (
        <div className={`relative rounded-3xl mb-4 transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] ${getCardStyle()}`}>
            
            {/* Header / Main Info */}
            <div className="p-5 flex items-start gap-4 cursor-pointer" onClick={() => !showMenu && setExpanded(!expanded)}>
                
                {/* Left Side: Status & Alert */}
                <div className="flex flex-col items-center gap-3 pt-1 w-6 shrink-0">
                    {/* Severe Icon (Static Indicator only) */}
                    {isSevere && (
                         <div className="text-red-500 animate-pulse drop-shadow-sm" title="Bệnh nặng">
                             <AlertTriangle size={24} className="fill-red-50"/>
                         </div>
                    )}

                    {isNew && !isSevere && (
                        <div className="text-emerald-500 drop-shadow-sm" title="Bệnh mới">
                            <Sparkles size={24} className="fill-emerald-50"/>
                        </div>
                    )}

                    {hasPendingOrders && !isDischarged && (
                        <div className="relative">
                             <div className="absolute -right-0.5 -top-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></div>
                             <ClipboardList size={22} className="text-slate-400"/>
                        </div>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2.5">
                            <h3 className="font-bold text-slate-800 truncate text-lg tracking-tight">
                                {patient.fullName} 
                            </h3>
                            <span className="text-xs font-bold text-slate-500 bg-white/60 px-2 py-0.5 rounded-md border border-slate-200/50">
                                {patient.age}t
                            </span>
                            {isNew && !isSevere && (
                                <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full shadow-sm">MỚI</span>
                            )}
                        </div>
                        
                        {/* Right Side Info (TP/HP) */}
                        <div className="flex flex-col items-end shrink-0 ml-2">
                            {rightSideBadge}
                        </div>
                    </div>
                    
                    <p className="text-base font-medium text-slate-600 line-clamp-1 mb-2 leading-relaxed">{patient.diagnosis}</p>
                    
                    {/* Summary Badges Row */}
                    <div className="flex flex-wrap gap-2">
                         {/* Surgery Info Line - Only if Scheduled is true */}
                        {patient.isScheduledForSurgery && (
                            <div className="flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100 shadow-sm font-bold">
                                <Calendar size={12} />
                                <span>
                                    {patient.surgeryDate ? formatDateVN(patient.surgeryDate) : 'Chờ lịch'}
                                </span>
                            </div>
                        )}
                        
                        {/* Discharge Plan Info - Only if Date exists */}
                        {patient.dischargeDate && !isDischarged && (
                            <div className="flex items-center gap-1.5 text-xs text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-100 shadow-sm font-bold">
                                <LogOut size={12} />
                                <span>Ra viện: <span>{formatDateVN(patient.dischargeDate)}</span></span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions Trigger */}
                <button
                    ref={triggerRef}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (triggerRef.current) {
                            const rect = triggerRef.current.getBoundingClientRect();
                            setMenuPosition({
                                top: rect.bottom + 8, // Position below the button
                                right: window.innerWidth - rect.right, // Align to the right edge
                            });
                        }
                        setShowMenu(prev => !prev);
                    }}
                    className="p-2 -mr-2 text-gray-400 hover:text-medical-600 active:bg-black/5 rounded-full transition-colors"
                >
                    <MoreHorizontal size={24} />
                </button>
            </div>

            {/* --- Menu Portal --- */}
            {showMenu && menuPosition && ReactDOM.createPortal(
                 <div
                    id={`menu-portal-${patient.id}`} // Add ID for click-outside check
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
                     
                     {/* Severe Toggle in Menu */}
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
                         const hasSurgeryDate = !!patient.surgeryDate && patient.surgeryDate.trim() !== '';
 
                         if (hasSurgeryDate) {
                             // Đã có ngày mổ -> Nút "Sửa lịch mổ"
                             return (
                                 <button onClick={() => { onEdit(patient.id); setShowMenu(false); }} className="w-full text-left px-4 py-3.5 text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-3 font-bold">
                                     <Syringe size={18} /> Sửa lịch mổ
                                 </button>
                             );
                         } else if (patient.isScheduledForSurgery) {
                             // Đã đăng ký nhưng chưa có ngày -> Nút "Hủy đăng ký"
                             return (
                                 <button onClick={() => { onCancelSurgery && onCancelSurgery(patient.id); setShowMenu(false); }} className="w-full text-left px-4 py-3.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 font-bold">
                                     <Syringe size={18} /> Hủy đăng ký mổ
                                 </button>
                             );
                         } else {
                             // Chưa đăng ký -> Nút "Đăng ký mổ"
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
            
            {/* REMOVED: Fixed backdrop div causing stack issues */}

            {/* Expanded Details */}
            {expanded && (
                <div className="border-t border-gray-100 p-5 animate-in slide-in-from-top-2 duration-300 rounded-b-3xl text-sm text-slate-800 relative z-0 bg-gray-50/50">
                    
                    {/* Collapsible Details Header */}
                    <div 
                        className="flex items-center gap-2 mb-4 cursor-pointer select-none text-slate-500 hover:text-medical-600 transition-colors group"
                        onClick={() => setShowDetails(!showDetails)}
                    >
                        <div className="p-1.5 rounded-full bg-white border border-gray-200 shadow-sm group-hover:border-medical-200 transition-colors">
                             {showDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </div>
                        <span className="font-bold text-xs uppercase tracking-wider">Thông tin chi tiết bệnh án</span>
                    </div>

                    {/* Detailed Info (Hidden by Default) */}
                    {showDetails && (
                        <div className="mb-6 animate-in fade-in slide-in-from-top-1 duration-200 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                            {/* Row 1: Admission & Diagnosis - Optimized for layout "Cùng 1 hàng" */}
                            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3 mb-4 pb-4 border-b border-gray-100 border-dashed">
                                <div className="flex items-baseline gap-2 whitespace-nowrap">
                                    <span className="text-slate-400 text-[11px] uppercase font-bold tracking-wide">Ngày vào:</span>
                                    <span className="font-bold text-slate-900 text-base">{formatDateVN(patient.admissionDate)}</span>
                                    <span className="text-[10px] text-medical-700 font-bold bg-medical-50 border border-medical-100 px-2 py-0.5 rounded-full ml-1">Ngày {hospitalDays}</span>
                                </div>
                                
                                <div className="flex items-baseline gap-2 flex-1 min-w-[200px]">
                                    <span className="text-slate-400 text-[11px] uppercase font-bold tracking-wide shrink-0">Chẩn đoán:</span>
                                    <span className="font-medium text-slate-900 leading-snug">{patient.diagnosis}</span>
                                </div>
                            </div>

                            {/* Row 2: Surgery Info - STRICTLY CONDITIONAL */}
                            {patient.isScheduledForSurgery && (
                                <div className="mb-4 pb-4 border-b border-gray-100 border-dashed bg-orange-50/50 rounded-xl p-3 border border-orange-100/50">
                                    <div className="flex items-center gap-2 mb-3 text-orange-800 font-bold text-xs uppercase tracking-wide">
                                        <Syringe size={14}/> Thông tin Phẫu Thuật
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-2">
                                        <div className="flex flex-col">
                                            <span className="text-orange-600/70 text-[10px] font-bold uppercase mb-0.5">Ngày mổ</span>
                                            <span className="font-bold text-slate-900">{patient.surgeryDate ? formatDateVN(patient.surgeryDate) : 'Chưa xếp'}</span>
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
                            
                            {/* Row 3: History Summary */}
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

                    {/* Row 4: Orders (Always Visible in Expanded) */}
                    {!isDischarged && (
                        <div className="space-y-4 mb-2">
                            {/* Today's Orders */}
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Y lệnh hôm nay ({todayOrders.length})</span>
                                </div>
                                {todayOrders.length === 0 ? (
                                    <div className="text-xs text-slate-400 italic pl-6 py-2 bg-white rounded-xl border border-dashed border-gray-200">Chưa có y lệnh hôm nay.</div>
                                ) : (
                                    <div className="space-y-3 pl-2 border-l-2 border-slate-200 ml-1.5">
                                        {todayOrders.map(order => (
                                            <div key={order.id} className="bg-white p-3.5 rounded-xl border border-gray-100 text-sm shadow-sm flex items-start gap-3 group hover:border-green-200 transition-colors">
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); onCompleteOrder && onCompleteOrder(patient.id, order.id); }}
                                                    className="mt-0.5 text-gray-300 hover:text-green-500 transition-colors shrink-0 p-1 hover:bg-green-50 rounded"
                                                >
                                                    <Square size={22} />
                                                </button>
                                                <div className="flex-1 pt-0.5">
                                                    <p className="text-slate-800 font-medium text-base leading-snug">{order.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Upcoming Orders */}
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
                                                    <p className="text-slate-600">{order.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {showDischargeConfirm && isDischarged ? (
                         <button 
                            onClick={() => onConfirmDischarge && onConfirmDischarge(patient.id)}
                            className="w-full bg-slate-800 text-white py-4 rounded-2xl text-sm font-bold hover:bg-slate-900 shadow-lg flex items-center justify-center gap-2 mt-6 active:scale-95 transition-all"
                        >
                            <LogOut size={20} /> Xác nhận Đã Ra Viện
                        </button>
                    ) : !isDischarged && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onAddOrder(patient.id); }}
                            className="w-full bg-medical-500 text-white py-4 rounded-2xl text-sm font-bold hover:bg-medical-600 shadow-lg shadow-medical-500/30 flex items-center justify-center gap-2 active:scale-95 transition-all mt-6"
                        >
                            <Plus size={22} /> Thêm Y Lệnh Mới
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default PatientCard;
