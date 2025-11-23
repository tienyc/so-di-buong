
import React, { useMemo } from 'react';
import { RoomBlock, PatientStatus } from '../types';
import { Users, Activity, Calendar, AlertTriangle, PieChart } from 'lucide-react';

interface StatisticsViewProps {
    rooms: RoomBlock[];
}

const StatisticsView: React.FC<StatisticsViewProps> = ({ rooms }) => {
    
    const stats = useMemo(() => {
        const allPatients = rooms.flatMap(r => r.patients).filter(p => p.status !== PatientStatus.ARCHIVED);
        
        const totalPatients = allPatients.length;
        const totalSurgery = allPatients.filter(p => p.isScheduledForSurgery).length;
        const totalSevere = allPatients.filter(p => p.isSevere).length;

        // Calculate Average Length of Stay
        let totalDays = 0;
        const now = new Date();
        allPatients.forEach(p => {
            const adm = new Date(p.admissionDate);
            // Normalize to midnight
            adm.setHours(0,0,0,0);
            const nowMidnight = new Date();
            nowMidnight.setHours(0,0,0,0);
            
            const diff = Math.floor((nowMidnight.getTime() - adm.getTime()) / (1000 * 3600 * 24)) + 1;
            totalDays += (diff < 0 ? 0 : diff);
        });
        const avgStay = totalPatients > 0 ? (totalDays / totalPatients).toFixed(1) : 0;

        // Long Stay Patients (> 7 days)
        const longStayPatients = allPatients.filter(p => {
            const adm = new Date(p.admissionDate);
            adm.setHours(0,0,0,0);
            const nowMidnight = new Date();
            nowMidnight.setHours(0,0,0,0);
            const diff = Math.floor((nowMidnight.getTime() - adm.getTime()) / (1000 * 3600 * 24)) + 1;
            return diff > 7;
        }).sort((a, b) => new Date(a.admissionDate).getTime() - new Date(b.admissionDate).getTime());

        // Count per Block
        const blockCounts = rooms.map(r => ({
            name: r.name,
            count: r.patients.filter(p => p.status !== PatientStatus.ARCHIVED).length
        }));

        return {
            totalPatients,
            totalSurgery,
            totalSevere,
            avgStay,
            longStayPatients,
            blockCounts
        };
    }, [rooms]);

    const formatDateVN = (isoDate: string) => {
        if (!isoDate) return '';
        const [y, m, d] = isoDate.split('-');
        return `${d}/${m}/${y}`;
    }

    const getDays = (dateStr: string) => {
        const adm = new Date(dateStr);
        adm.setHours(0,0,0,0);
        const now = new Date();
        now.setHours(0,0,0,0);
        return Math.floor((now.getTime() - adm.getTime()) / (1000 * 3600 * 24)) + 1;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            <h2 className="text-3xl font-bold text-slate-800 mb-6 flex items-center gap-3 px-1">
                <PieChart className="text-purple-600" size={32}/> Thống Kê Tổng Hợp
            </h2>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-soft flex flex-col items-center justify-center text-center hover:scale-105 transition-transform">
                    <div className="bg-blue-50 p-3 rounded-xl mb-3 text-blue-600 shadow-inner">
                        <Users size={28} />
                    </div>
                    <div className="text-3xl font-bold text-slate-800">{stats.totalPatients}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold mt-1 tracking-wider">Tổng Bệnh Nhân</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-soft flex flex-col items-center justify-center text-center hover:scale-105 transition-transform">
                    <div className="bg-orange-50 p-3 rounded-xl mb-3 text-orange-600 shadow-inner">
                        <Activity size={28} />
                    </div>
                    <div className="text-3xl font-bold text-slate-800">{stats.totalSurgery}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold mt-1 tracking-wider">Ca Mổ / Chờ Mổ</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-soft flex flex-col items-center justify-center text-center hover:scale-105 transition-transform">
                    <div className="bg-purple-50 p-3 rounded-xl mb-3 text-purple-600 shadow-inner">
                        <Calendar size={28} />
                    </div>
                    <div className="text-3xl font-bold text-slate-800">{stats.avgStay}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold mt-1 tracking-wider">Ngày ĐT Trung Bình</div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-soft flex flex-col items-center justify-center text-center hover:scale-105 transition-transform">
                    <div className="bg-red-50 p-3 rounded-xl mb-3 text-red-600 shadow-inner">
                        <AlertTriangle size={28} />
                    </div>
                    <div className="text-3xl font-bold text-slate-800">{stats.totalSevere}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold mt-1 tracking-wider">Bệnh Nặng</div>
                </div>
            </div>

            {/* Block Distribution */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                <div className="bg-gray-50/50 px-5 py-4 border-b border-gray-100 font-bold text-slate-700 text-sm tracking-wide uppercase">
                    Phân Bố Theo Khu
                </div>
                <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-4">
                    {stats.blockCounts.map((block, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-white border border-gray-100 p-4 rounded-xl shadow-sm">
                            <span className="text-sm font-semibold text-slate-700">{block.name}</span>
                            <span className="text-lg font-bold text-medical-600 bg-medical-50 px-3 py-1 rounded-lg">{block.count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Long Stay Patients */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                <div className="bg-red-50/50 px-5 py-4 border-b border-red-100 font-bold text-red-700 text-sm flex items-center gap-2 tracking-wide uppercase">
                    <AlertTriangle size={16}/> Bệnh Nhân Nằm Lâu (&gt; 7 ngày)
                </div>
                <div className="divide-y divide-gray-100">
                    {stats.longStayPatients.length === 0 ? (
                        <p className="p-8 text-sm text-gray-400 italic text-center">Không có bệnh nhân nào nằm quá 7 ngày.</p>
                    ) : (
                        stats.longStayPatients.map(p => (
                            <div key={p.id} className="p-4 hover:bg-gray-50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-bold text-slate-800 text-lg">{p.fullName} <span className="font-normal text-slate-500 text-sm">({p.age}t)</span></div>
                                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-bold">P. {p.roomNumber}</span>
                                            <span>• Vào viện: {formatDateVN(p.admissionDate)}</span>
                                        </div>
                                        <div className="text-sm text-slate-700 mt-2 font-medium">{p.diagnosis}</div>
                                    </div>
                                    <div className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shadow-sm">
                                        {getDays(p.admissionDate)} ngày
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatisticsView;
