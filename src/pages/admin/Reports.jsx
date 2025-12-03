import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useAuth } from '../../context/AuthContext';

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
        deleted: 0,
        shifted: 0
    });
    const [loading, setLoading] = useState(false);

    const isWardMember = user?.role === 'ward_member';

    useEffect(() => {
        fetchPanchayats();
        if (isWardMember && user?.ward_id) {
            fetchUserWardDetails();
        } else {
            fetchStats(); // Initial fetch for admin (all voters)
        }
    }, [user]);

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

            const [total, male, female, deleted, shifted] = await Promise.all([
                runCountQuery(),
                runCountQuery(q => q.or('gender.ilike.male,gender.eq.പുരുഷൻ,gender.eq.M')),
                runCountQuery(q => q.or('gender.ilike.female,gender.eq.സ്ത്രീ,gender.eq.F')),
                runCountQuery(q => q.eq('status', 'deleted')),
                runCountQuery(q => q.eq('status', 'shifted'))
            ]);

            setStats({
                total: total || 0,
                male: male || 0,
                female: female || 0,
                deleted: deleted || 0,
                shifted: shifted || 0
            });

        } catch (error) {
            console.error('Error fetching stats:', error.message);
        } finally {
            setLoading(false);
        }
    }

    return (
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
                <div className="grid grid-3">
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
                </div>
            )}
        </div>
    );
}
