import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { ArrowUp, ArrowDown, Users, UserCheck, UserX, UserMinus, AlertTriangle, Ban, HelpCircle, Copy } from 'lucide-react';

export default function Reports() {
    const { user } = useAuth();
    const [panchayats, setPanchayats] = useState([]);
    const [wards, setWards] = useState([]);
    const [booths, setBooths] = useState([]);

    const [selectedPanchayat, setSelectedPanchayat] = useState('');
    const [selectedWard, setSelectedWard] = useState('');
    const [selectedBooth, setSelectedBooth] = useState('');

    const [stats, setStats] = useState({
        total: 0,
        male: 0,
        female: 0,
        active: 0,
        deleted: 0,
        shifted: 0,
        death: 0,
        gulf: 0,
        out_of_place: 0,
        duplicate: 0
    });
    const [loading, setLoading] = useState(false);
    const [isAtTop, setIsAtTop] = useState(true);

    const isWardMember = user?.role === 'ward_member';

    useEffect(() => {
        fetchPanchayats();
        if (isWardMember && user?.ward_id) {
            fetchUserWardDetails();
        } else {
            fetchStats(); // Initial fetch for admin (all voters)
        }

        const handleScroll = () => {
            setIsAtTop(window.scrollY < 100);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [user]);

    const handleScrollAction = () => {
        if (isAtTop) {
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    async function fetchUserWardDetails() {
        const { data } = await supabase
            .from('wards')
            .select('id, panchayat_id')
            .eq('id', user.ward_id)
            .single();

        if (data) {
            setSelectedPanchayat(data.panchayat_id);
            setSelectedWard(data.id);
            // fetchStats will be triggered by the useEffect dependencies on selectedPanchayat/selectedWard
        }
    }

    useEffect(() => {
        if (selectedPanchayat) {
            fetchWards(selectedPanchayat);
        } else {
            setWards([]);
            setBooths([]);
        }
        // Only fetch stats if not ward member (to avoid double fetch on initial load) 
        // OR if we want to support filtering.
        // For ward member, selectedWard will be set shortly, triggering the next effect.
        if (!isWardMember) fetchStats();
    }, [selectedPanchayat]);

    useEffect(() => {
        if (selectedWard) {
            fetchBooths(selectedWard);
        } else {
            setBooths([]);
        }
        fetchStats();
    }, [selectedWard]);

    useEffect(() => {
        fetchStats();
    }, [selectedBooth]);

    async function fetchPanchayats() {
        const { data } = await supabase.from('panchayats').select('*').order('name');
        setPanchayats(data || []);
    }

    async function fetchWards(panchayatId) {
        const { data } = await supabase.from('wards').select('*').eq('panchayat_id', panchayatId).order('ward_no');
        setWards(data || []);
    }

    async function fetchBooths(wardId) {
        const { data } = await supabase.from('booths').select('*').eq('ward_id', wardId).order('booth_no');
        setBooths(data || []);
    }

    async function fetchStats() {
        setLoading(true);
        try {
            const applyFilters = (query) => {
                if (selectedBooth) {
                    return query.eq('booth_id', selectedBooth);
                } else if (selectedWard) {
                    return query.eq('booths.ward_id', selectedWard);
                } else if (selectedPanchayat) {
                    return query.eq('booths.wards.panchayat_id', selectedPanchayat);
                }
                return query;
            };

            const runCountQuery = async (filterFn) => {
                // We need to join tables if filtering by ward/panchayat
                // Note: We use !inner join to ensure we can filter by related tables
                let query = supabase.from('voters').select('booths!inner(ward_id, wards!inner(panchayat_id))', { count: 'exact', head: true });

                query = applyFilters(query);
                if (filterFn) query = filterFn(query);

                const { count, error } = await query;
                if (error) throw error;
                return count;
            };

            const [total, male, female, active, deleted, shifted, death, gulf, out_of_place, duplicate] = await Promise.all([
                runCountQuery(),
                runCountQuery(q => q.or('gender.ilike.male,gender.eq.പുരുഷൻ,gender.eq.M')),
                runCountQuery(q => q.or('gender.ilike.female,gender.eq.സ്ത്രീ,gender.eq.F')),
                runCountQuery(q => q.eq('status', 'active')),
                runCountQuery(q => q.eq('status', 'deleted')),
                runCountQuery(q => q.eq('status', 'shifted')),
                runCountQuery(q => q.eq('status', 'death')),
                runCountQuery(q => q.eq('status', 'gulf')),
                runCountQuery(q => q.eq('status', 'out_of_place')),
                runCountQuery(q => q.eq('status', 'duplicate'))
            ]);

            setStats({
                total: total || 0,
                male: male || 0,
                female: female || 0,
                active: active || 0,
                deleted: deleted || 0,
                shifted: shifted || 0,
                death: death || 0,
                gulf: gulf || 0,
                out_of_place: out_of_place || 0,
                duplicate: duplicate || 0
            });

        } catch (error) {
            console.error('Error fetching stats:', error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <div className="container">
                <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>റിപ്പോർട്ടുകൾ</h2>

                <div className="grid grid-3" style={{ marginBottom: '2rem' }}>
                    <div className="form-group">
                        <label className="label">പഞ്ചായത്ത്</label>
                        <select
                            className="input"
                            value={selectedPanchayat}
                            onChange={e => {
                                setSelectedPanchayat(e.target.value);
                                setSelectedWard('');
                                setSelectedBooth('');
                            }}
                            disabled={isWardMember}
                        >
                            <option value="">-- എല്ലാം --</option>
                            {panchayats.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="label">വാർഡ്</label>
                        <select
                            className="input"
                            value={selectedWard}
                            onChange={e => {
                                setSelectedWard(e.target.value);
                                setSelectedBooth('');
                            }}
                            disabled={!selectedPanchayat || isWardMember}
                        >
                            <option value="">-- എല്ലാം --</option>
                            {wards.map(w => (
                                <option key={w.id} value={w.id}>{w.ward_no} - {w.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="label">ബൂത്ത്</label>
                        <select
                            className="input"
                            value={selectedBooth}
                            onChange={e => setSelectedBooth(e.target.value)}
                            disabled={!selectedWard}
                        >
                            <option value="">-- എല്ലാം --</option>
                            {booths.map(b => (
                                <option key={b.id} value={b.id}>{b.booth_no} - {b.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? <LoadingSpinner /> : (
                    <div className="grid grid-4">
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--primary)' }}>
                            <div style={{ padding: '0.75rem', background: 'var(--primary-light)', borderRadius: '50%', color: 'var(--primary)' }}>
                                <Users size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Total Voters</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.total}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #3b82f6' }}>
                            <div style={{ padding: '0.75rem', background: '#dbeafe', borderRadius: '50%', color: '#3b82f6' }}>
                                <Users size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Male</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.male}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #ec4899' }}>
                            <div style={{ padding: '0.75rem', background: '#fce7f3', borderRadius: '50%', color: '#ec4899' }}>
                                <Users size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Female</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.female}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #10b981' }}>
                            <div style={{ padding: '0.75rem', background: '#d1fae5', borderRadius: '50%', color: '#10b981' }}>
                                <UserCheck size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Active</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.active}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #f59e0b' }}>
                            <div style={{ padding: '0.75rem', background: '#fef3c7', borderRadius: '50%', color: '#f59e0b' }}>
                                <UserMinus size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Shifted</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.shifted}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #ef4444' }}>
                            <div style={{ padding: '0.75rem', background: '#fee2e2', borderRadius: '50%', color: '#ef4444' }}>
                                <UserX size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Deleted</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.deleted}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #6366f1' }}>
                            <div style={{ padding: '0.75rem', background: '#e0e7ff', borderRadius: '50%', color: '#6366f1' }}>
                                <Ban size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Death</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.death}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #8b5cf6' }}>
                            <div style={{ padding: '0.75rem', background: '#ede9fe', borderRadius: '50%', color: '#8b5cf6' }}>
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Gulf</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.gulf}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #ec4899' }}>
                            <div style={{ padding: '0.75rem', background: '#fce7f3', borderRadius: '50%', color: '#ec4899' }}>
                                <HelpCircle size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Out of Place</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.out_of_place}</div>
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid #14b8a6' }}>
                            <div style={{ padding: '0.75rem', background: '#ccfbf1', borderRadius: '50%', color: '#14b8a6' }}>
                                <Copy size={24} />
                            </div>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#666' }}>Duplicate</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.duplicate}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <button
                onClick={handleScrollAction}
                style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: 100,
                    transition: 'transform 0.2s'
                }}
                title={isAtTop ? "Go to Bottom" : "Go to Top"}
            >
                {isAtTop ? <ArrowDown size={24} /> : <ArrowUp size={24} />}
            </button>
        </>
    );
}
