import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Upload, Map, Users, UserPlus, Settings, Edit, Trash2, LogOut, Key, FileText, Printer, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import { supabase } from '../../lib/supabase';
import AiAssistant from '../../components/AiAssistant';

export default function AdminDashboard() {
    const { signOut, user } = useAuth();
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [stats, setStats] = useState({
        total: 0,
        male: 0,
        female: 0,
        deleted: 0,
        shifted: 0,
        voted: 0,
        pending: 0
    });
    const [constituencyName, setConstituencyName] = useState('');

    const isWardMember = user?.role === 'ward_member';

    useEffect(() => {
        fetchStats();
        if (isWardMember && user?.ward_id) {
            fetchConstituencyName();
        }
    }, [user]);

    async function fetchConstituencyName() {
        const { data } = await supabase.from('constituencies').select('name, constituency_no').eq('id', user.ward_id).single();
        if (data) {
            setConstituencyName(`${data.constituency_no} - ${data.name}`);
        }
    }

    async function fetchStats() {
        try {
            let boothIds = [];

            // If ward member, fetch their booth IDs first
            if (isWardMember && user?.ward_id) {
                const { data: booths } = await supabase
                    .from('booths')
                    .select('id')
                    .eq('constituency_id', user.ward_id);

                if (booths) {
                    boothIds = booths.map(b => b.id);
                }

                // If no booths found for this ward, stats are 0
                if (boothIds.length === 0) {
                    setStats({ total: 0, male: 0, female: 0, deleted: 0, shifted: 0 });
                    return;
                }
            }

            // Helper to add filter
            const addFilter = (query) => {
                if (isWardMember && boothIds.length > 0) {
                    return query.in('booth_id', boothIds);
                }
                return query;
            };

            const { count: total } = await addFilter(supabase.from('voters').select('*', { count: 'exact', head: true }));

            const { count: male } = await addFilter(supabase.from('voters').select('*', { count: 'exact', head: true })
                .or('gender.ilike.male,gender.eq.പുരുഷൻ,gender.eq.M'));

            const { count: female } = await addFilter(supabase.from('voters').select('*', { count: 'exact', head: true })
                .or('gender.ilike.female,gender.eq.സ്ത്രീ,gender.eq.F'));

            const { count: deleted } = await addFilter(supabase.from('voters').select('*', { count: 'exact', head: true })
                .eq('status', 'deleted'));

            const { count: shifted } = await addFilter(supabase.from('voters').select('*', { count: 'exact', head: true })
                .eq('status', 'shifted'));

            const { count: voted } = await addFilter(supabase.from('voters').select('*', { count: 'exact', head: true })
                .eq('has_voted', true));

            const { count: pending } = await addFilter(supabase.from('voters').select('*', { count: 'exact', head: true })
                .eq('has_voted', false)
                .neq('status', 'deleted')
                .neq('status', 'shifted'));

            setStats({
                total: total || 0,
                male: male || 0,
                female: female || 0,
                deleted: deleted || 0,
                shifted: shifted || 0,
                voted: voted || 0,
                pending: pending || 0
            });
        } catch (error) {
            console.error('Error fetching stats:', error.message);
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ color: 'var(--primary-bg)', margin: 0 }}>
                    {isWardMember ? (constituencyName ? `നിയോജക മണ്ഡലം: ${constituencyName}` : 'നിയോജക മണ്ഡലം മെമ്പർ ഡാഷ്‌ബോർഡ്') : 'അഡ്മിൻ ഡാഷ്‌ബോർഡ്'}
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

            <h3 style={{ marginBottom: '1rem', color: 'var(--text-light)' }}>ഡാറ്റ ചേർക്കുക</h3>
            <div className="action-grid grid grid-2" style={{ marginBottom: '3rem' }}>
                {!isWardMember && (
                    <>
                        <Link to="/admin/add-district" className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ background: '#dbeafe', padding: '1rem', borderRadius: '50%', color: 'var(--primary)' }}>
                                <Map size={24} />
                            </div>
                            <div>
                                <h3 style={{ marginBottom: '0.25rem' }}>ജില്ല ചേർക്കുക</h3>
                                <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>പുതിയ ജില്ല സൃഷ്ടിക്കുക</p>
                            </div>
                        </Link>

                        <Link to="/admin/add-constituency" className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ background: '#dbeafe', padding: '1rem', borderRadius: '50%', color: 'var(--primary)' }}>
                                <PlusCircle size={24} />
                            </div>
                            <div>
                                <h3 style={{ marginBottom: '0.25rem' }}>നിയോജക മണ്ഡലം ചേർക്കുക</h3>
                                <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>ജില്ലകളിൽ നിയോജക മണ്ഡലങ്ങൾ ചേർക്കുക</p>
                            </div>
                        </Link>
                    </>
                )}

                <Link to="/admin/add-booth" className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: '#dbeafe', padding: '1rem', borderRadius: '50%', color: 'var(--primary)' }}>
                        <Users size={24} />
                    </div>
                    <div>
                        <h3 style={{ marginBottom: '0.25rem' }}>ബൂത്ത് ചേർക്കുക</h3>
                        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>നിയോജക മണ്ഡലങ്ങളിൽ ബൂത്തുകൾ സൃഷ്ടിക്കുക</p>
                    </div>
                </Link>

                <Link to="/admin/add-candidate" className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: '50%', color: 'var(--accent)' }}>
                        <UserPlus size={24} />
                    </div>
                    <div>
                        <h3 style={{ marginBottom: '0.25rem' }}>സ്ഥാനാർത്ഥിയെ ചേർക്കുക</h3>
                        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>നിയോജക മണ്ഡലങ്ങളിലേക്ക് സ്ഥാനാർത്ഥികളെ രജിസ്റ്റർ ചെയ്യുക</p>
                    </div>
                </Link>

                <Link to="/admin/upload-voters" className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: '#dcfce7', padding: '1rem', borderRadius: '50%', color: 'var(--success)' }}>
                        <Upload size={24} />
                    </div>
                    <div>
                        <h3 style={{ marginBottom: '0.25rem' }}>വോട്ടർമാരെ അപ്‌ലോഡ് ചെയ്യുക</h3>
                        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>വോട്ടർ പട്ടിക (CSV) അപ്‌ലോഡ് ചെയ്യുക</p>
                    </div>
                </Link>
            </div>

            <h3 style={{ marginBottom: '1rem', color: 'var(--text-light)' }}>ഡാറ്റ നിയന്ത്രിക്കുക (എഡിറ്റ് / ഡിലീറ്റ്)</h3>
            <div className="action-grid grid grid-2">
                {!isWardMember && (
                    <>
                        <Link to="/admin/manage/districts" className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--secondary)' }}>
                            <Settings size={24} color="var(--secondary)" />
                            <div>
                                <h3 style={{ marginBottom: '0.25rem' }}>ജില്ലകൾ</h3>
                                <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>ജില്ലകൾ എഡിറ്റ് / ഡിലീറ്റ് ചെയ്യുക</p>
                            </div>
                        </Link>

                        <Link to="/admin/manage/constituencies" className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--secondary)' }}>
                            <Settings size={24} color="var(--secondary)" />
                            <div>
                                <h3 style={{ marginBottom: '0.25rem' }}>നിയോജക മണ്ഡലങ്ങൾ</h3>
                                <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>നിയോജക മണ്ഡലങ്ങൾ എഡിറ്റ് / ഡിലീറ്റ് ചെയ്യുക</p>
                            </div>
                        </Link>
                    </>
                )}

                <Link to="/admin/manage/booths" className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--secondary)' }}>
                    <Settings size={24} color="var(--secondary)" />
                    <div>
                        <h3 style={{ marginBottom: '0.25rem' }}>ബൂത്തുകൾ</h3>
                        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>ബൂത്തുകൾ എഡിറ്റ് / ഡിലീറ്റ് ചെയ്യുക</p>
                    </div>
                </Link>

                <Link to="/admin/manage/candidates" className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--secondary)' }}>
                    <Settings size={24} color="var(--secondary)" />
                    <div>
                        <h3 style={{ marginBottom: '0.25rem' }}>സ്ഥാനാർത്ഥികൾ</h3>
                        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>സ്ഥാനാർത്ഥികളെ എഡിറ്റ് / ഡിലീറ്റ് ചെയ്യുക</p>
                    </div>
                </Link>

                <Link to="/admin/manage/voters" className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--secondary)' }}>
                    <Settings size={24} color="var(--secondary)" />
                    <div>
                        <h3 style={{ marginBottom: '0.25rem' }}>വോട്ടർമാർ</h3>
                        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>വോട്ടർമാരെ എഡിറ്റ് / ഡിലീറ്റ് ചെയ്യുക</p>
                    </div>
                </Link>

                <Link to="/admin/manage/fronts" className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--secondary)' }}>
                    <Settings size={24} color="var(--secondary)" />
                    <div>
                        <h3 style={{ marginBottom: '0.25rem' }}>മുന്നണികൾ</h3>
                        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>മുന്നണികളെ നിയന്ത്രിക്കുക</p>
                    </div>
                </Link>

                {!isWardMember && (
                    <>
                        <Link to="/admin/manage/members" className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--secondary)' }}>
                            <Users size={24} color="var(--secondary)" />
                            <div>
                                <h3 style={{ marginBottom: '0.25rem' }}>നിയോജക മണ്ഡലം യൂസർ</h3>
                                <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>യൂസർമാരെ ചേർക്കുക / നിയന്ത്രിക്കുക</p>
                            </div>
                        </Link>

                        <Link to="/admin/settings" className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #8b5cf6' }}>
                            <Settings size={24} color="#8b5cf6" />
                            <div>
                                <h3 style={{ marginBottom: '0.25rem' }}>ക്രമീകരണങ്ങൾ</h3>
                                <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>AI, API ക്രമീകരണങ്ങൾ</p>
                            </div>
                        </Link>
                    </>
                )}
            </div>
            <AiAssistant />
        </div>
    );
}
