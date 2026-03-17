import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Printer, CheckCircle, Key, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import { supabase } from '../../lib/supabase';

export default function BoothDashboard() {
    const { signOut, user } = useAuth();
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [stats, setStats] = useState({
        total: 0, male: 0, female: 0, deleted: 0, shifted: 0, voted: 0, pending: 0
    });

    const boothId = user?.booth_id;
    const boothLabel = user ? `ബൂത്ത് ${user.booth_no} - ${user.booth_name}` : '';

    useEffect(() => {
        if (boothId) fetchStats();
    }, [boothId]);

    async function fetchStats() {
        try {
            const base = () => supabase.from('voters').select('*', { count: 'exact', head: true }).eq('booth_id', boothId);

            const [total, male, female, deleted, shifted, voted, pending] = await Promise.all([
                base(),
                base().or('gender.ilike.male,gender.eq.പുരുഷൻ,gender.eq.M'),
                base().or('gender.ilike.female,gender.eq.സ്ത്രീ,gender.eq.F'),
                base().eq('status', 'deleted'),
                base().eq('status', 'shifted'),
                base().eq('has_voted', true),
                base().eq('has_voted', false).neq('status', 'deleted').neq('status', 'shifted'),
            ]);

            setStats({
                total: total.count || 0,
                male: male.count || 0,
                female: female.count || 0,
                deleted: deleted.count || 0,
                shifted: shifted.count || 0,
                voted: voted.count || 0,
                pending: pending.count || 0,
            });
        } catch (err) {
            console.error('Error fetching booth stats:', err.message);
        }
    }

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h1 style={{ color: 'var(--primary-bg)', margin: 0, fontSize: 'clamp(1.1rem, 3vw, 1.6rem)' }}>
                    {boothLabel}
                </h1>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={() => setIsPasswordModalOpen(true)}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem' }}
                        title="പാസ്‌വേഡ് മാറ്റുക"
                    >
                        <Key size={20} />
                        <span className="hide-on-mobile">പാസ്‌വേഡ് മാറ്റുക</span>
                    </button>
                    <button
                        onClick={signOut}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'var(--danger)', color: 'var(--danger)', padding: '0.5rem' }}
                        title="ലോഗൗട്ട്"
                    >
                        <LogOut size={20} />
                        <span className="hide-on-mobile">ലോഗൗട്ട്</span>
                    </button>
                </div>
            </div>

            <ChangePasswordModal isOpen={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} />

            {/* Stats Tiles */}
            <div className="stats-grid grid grid-3" style={{ marginBottom: '2rem' }}>
                <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>{stats.total}</h3>
                    <p style={{ color: 'var(--text-light)', fontWeight: '600' }}>ആകെ വോട്ടർമാർ</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '2.5rem', color: '#3b82f6', marginBottom: '0.5rem' }}>{stats.male}</h3>
                    <p style={{ color: 'var(--text-light)', fontWeight: '600' }}>പുരുഷന്മാർ</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '2.5rem', color: '#ec4899', marginBottom: '0.5rem' }}>{stats.female}</h3>
                    <p style={{ color: 'var(--text-light)', fontWeight: '600' }}>സ്ത്രീകൾ</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '2.5rem', color: '#ef4444', marginBottom: '0.5rem' }}>{stats.deleted}</h3>
                    <p style={{ color: 'var(--text-light)', fontWeight: '600' }}>നീക്കം ചെയ്തവർ</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '2.5rem', color: '#f59e0b', marginBottom: '0.5rem' }}>{stats.shifted}</h3>
                    <p style={{ color: 'var(--text-light)', fontWeight: '600' }}>സ്ഥലം മാറിയവർ</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '2.5rem', color: '#16a34a', marginBottom: '0.5rem' }}>{stats.voted}</h3>
                    <p style={{ color: 'var(--text-light)', fontWeight: '600' }}>വോട്ട് ചെയ്തവർ</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '2.5rem', color: '#9333ea', marginBottom: '0.5rem' }}>{stats.pending}</h3>
                    <p style={{ color: 'var(--text-light)', fontWeight: '600' }}>വോട്ട് ചെയ്യാനുള്ളവർ</p>
                </div>

                <Link to="/admin/reports" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: 'var(--primary-bg)', color: 'white' }}>
                    <FileText size={48} style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0 }}>റിപ്പോർട്ടുകൾ</h3>
                </Link>
                <Link to="/admin/voter-status-reports" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: '#64748b', color: 'white' }}>
                    <FileText size={48} style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0 }}>Status Reports</h3>
                </Link>
                <Link to="/admin/generate-slips" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: '#8b5cf6', color: 'white' }}>
                    <Printer size={48} style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0 }}>സ്ലിപ്പുകൾ</h3>
                </Link>
                <Link to="/admin/voter-verification" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: '#f59e0b', color: 'white' }}>
                    <CheckCircle size={48} style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0 }}>പരിശോധന</h3>
                </Link>
                <Link to="/admin/mark-votes" className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: '#10b981', color: 'white' }}>
                    <CheckCircle size={48} style={{ marginBottom: '0.5rem' }} />
                    <h3 style={{ margin: 0 }}>വോട്ടിംഗ്</h3>
                </Link>
            </div>
        </div>
    );
}
