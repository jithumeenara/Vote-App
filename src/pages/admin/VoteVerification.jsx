import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { Search, Save, Filter } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts';

export default function VoteVerification() {
    const { user } = useAuth();
    const { addToast } = useToast();

    const [activeTab, setActiveTab] = useState('trend'); // Default to 'trend'
    const [panchayats, setPanchayats] = useState([]);
    const [wards, setWards] = useState([]);
    const [booths, setBooths] = useState([]);
    const [fronts, setFronts] = useState([]);

    const [selectedPanchayat, setSelectedPanchayat] = useState('');
    const [selectedWard, setSelectedWard] = useState('');
    const [selectedBooth, setSelectedBooth] = useState('');

    const [voters, setVoters] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const isWardMember = user?.role === 'ward_member';

    useEffect(() => {
        fetchPanchayats();
        fetchFronts();
    }, []);

    const fetchFronts = async () => {
        const { data } = await supabase.from('fronts').select('*').order('name');
        setFronts(data || []);
    };

    const fetchPanchayats = async () => {
        const { data } = await supabase.from('panchayats').select('*').order('name');
        setPanchayats(data || []);
    };

    useEffect(() => {
        if (selectedPanchayat) {
            fetchWards(selectedPanchayat);
        } else {
            setWards([]);
        }
    }, [selectedPanchayat]);

    const fetchWards = async (panchayatId) => {
        const { data } = await supabase.from('wards').select('*').eq('panchayat_id', panchayatId).order('ward_no');
        setWards(data || []);
    };

    useEffect(() => {
        if (selectedWard) {
            fetchBooths(selectedWard);
        } else {
            setBooths([]);
        }
    }, [selectedWard]);

    const fetchBooths = async (wardId) => {
        const { data } = await supabase.from('booths').select('*').eq('ward_id', wardId).order('booth_no');
        setBooths(data || []);
    };

    useEffect(() => {
        if (isWardMember && user?.ward_id) {
            const fetchWardDetails = async () => {
                const { data } = await supabase.from('wards').select('*, panchayats(*)').eq('id', user.ward_id).single();
                if (data) {
                    setSelectedPanchayat(data.panchayat_id);
                    setSelectedWard(data.id);
                }
            };
            fetchWardDetails();
        }
    }, [isWardMember, user]);

    useEffect(() => {
        if (selectedBooth) {
            fetchVoters();
        } else {
            setVoters([]);
        }
        // Always fetch stats if at least a panchayat is selected, or if ward member
        if (selectedPanchayat || (isWardMember && user?.ward_id)) {
            fetchStats();
        }
    }, [selectedBooth, selectedWard, selectedPanchayat, activeTab]);

    const fetchVoters = async () => {
        if (!selectedBooth) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('voters')
                .select('*, fronts(name, color)')
                .eq('booth_id', selectedBooth)
                .order('sl_no');

            if (error) throw error;
            setVoters(data || []);
        } catch (error) {
            console.error('Error fetching voters:', error);
            addToast('Error fetching voters', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        if (activeTab !== 'trend') return;
        setLoading(true);
        try {
            let query = supabase.from('voters').select('supported_front_id, fronts(name, color)');

            if (selectedBooth) {
                query = query.eq('booth_id', selectedBooth);
            } else if (selectedWard) {
                const { data: bData } = await supabase.from('booths').select('id').eq('ward_id', selectedWard);
                const bIds = bData.map(b => b.id);
                if (bIds.length > 0) query = query.in('booth_id', bIds);
                else {
                    setStats({ total: 0, fronts: [], chartData: [] });
                    setLoading(false);
                    return;
                }
            } else if (selectedPanchayat) {
                if (!isWardMember && !selectedWard) {
                    const { data: wData } = await supabase.from('wards').select('id').eq('panchayat_id', selectedPanchayat);
                    const wIds = wData.map(w => w.id);
                    const { data: bData } = await supabase.from('booths').select('id').in('ward_id', wIds);
                    const bIds = bData.map(b => b.id);
                    if (bIds.length > 0) query = query.in('booth_id', bIds);
                    else {
                        setStats({ total: 0, fronts: [], chartData: [] });
                        setLoading(false);
                        return;
                    }
                }
            }

            const { data, error } = await query;
            if (error) throw error;

            const total = data.length;
            const frontCounts = {};
            let verifiedCount = 0;

            data.forEach(v => {
                if (v.supported_front_id) {
                    verifiedCount++;
                    const fname = v.fronts?.name || 'Unknown';
                    const fcolor = v.fronts?.color || '#666666';
                    if (!frontCounts[fname]) {
                        frontCounts[fname] = { count: 0, color: fcolor };
                    }
                    frontCounts[fname].count++;
                } else {
                    if (!frontCounts['Unverified']) {
                        frontCounts['Unverified'] = { count: 0, color: '#9ca3af' };
                    }
                    frontCounts['Unverified'].count++;
                }
            });

            // Prepare data for Recharts
            const chartData = Object.entries(frontCounts).map(([name, data]) => ({
                name,
                value: data.count,
                color: data.color
            }));

            setStats({
                total,
                verified: verifiedCount,
                unverified: total - verifiedCount,
                fronts: frontCounts,
                chartData
            });

        } catch (error) {
            console.error('Error fetching stats:', error);
            addToast('Error fetching trends', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleMarkVoted = async (voterId, hasVoted) => {
        const previousVoters = [...voters];
        setVoters(voters.map(v => v.id === voterId ? { ...v, has_voted: hasVoted } : v));

        try {
            const { error } = await supabase
                .from('voters')
                .update({ has_voted: hasVoted })
                .eq('id', voterId);

            if (error) throw error;
            addToast(hasVoted ? 'Marked as voted' : 'Marked as not voted', 'success');
        } catch (error) {
            console.error('Error updating vote status:', error);
            addToast('Failed to update: ' + error.message, 'error');
            setVoters(previousVoters);
        }
    };

    const handleFrontChange = async (voterId, frontId) => {
        const previousVoters = [...voters];
        setVoters(voters.map(v => v.id === voterId ? { ...v, supported_front_id: frontId } : v));

        try {
            const { error } = await supabase
                .from('voters')
                .update({ supported_front_id: frontId })
                .eq('id', voterId);

            if (error) throw error;
            addToast('Vote preference updated', 'success');
        } catch (error) {
            console.error('Error updating vote preference:', error);
            addToast('Failed to update: ' + error.message, 'error');
            setVoters(previousVoters);
        }
    };

    const filteredVoters = voters.filter(v => {
        const lowerTerm = searchTerm.toLowerCase();
        return (
            v.name.toLowerCase().includes(lowerTerm) ||
            v.sl_no.toString().includes(lowerTerm) ||
            (v.house_name && v.house_name.toLowerCase().includes(lowerTerm))
        );
    });

    return (
        <div className="container">
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-bg)' }}>വോട്ട് ഉറപ്പുവരുത്തുക (Vote Verification)</h2>

            {/* Filters */}
            <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                <div className="responsive-grid">
                    <div className="form-group">
                        <label className="label">പഞ്ചായത്ത്</label>
                        <select
                            className="input"
                            value={selectedPanchayat}
                            onChange={e => { setSelectedPanchayat(e.target.value); setSelectedWard(''); setSelectedBooth(''); }}
                            disabled={isWardMember}
                        >
                            <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                            {panchayats.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="label">വാർഡ്</label>
                        <select
                            className="input"
                            value={selectedWard}
                            onChange={e => { setSelectedWard(e.target.value); setSelectedBooth(''); }}
                            disabled={!selectedPanchayat || isWardMember}
                        >
                            <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                            {wards.map(w => <option key={w.id} value={w.id}>{w.ward_no} - {w.name}</option>)}
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
                            <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                            {booths.map(b => <option key={b.id} value={b.id}>{b.booth_no} - {b.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '2px solid #eee' }}>
                <button
                    className={`tab-btn ${activeTab === 'trend' ? 'active' : ''}`}
                    onClick={() => setActiveTab('trend')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        border: 'none',
                        background: 'none',
                        borderBottom: activeTab === 'trend' ? '3px solid var(--accent)' : '3px solid transparent',
                        color: activeTab === 'trend' ? 'var(--accent)' : '#666',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    Current Trend (Reports)
                </button>
                <button
                    className={`tab-btn ${activeTab === 'verification' ? 'active' : ''}`}
                    onClick={() => setActiveTab('verification')}
                    style={{
                        padding: '0.75rem 1.5rem',
                        border: 'none',
                        background: 'none',
                        borderBottom: activeTab === 'verification' ? '3px solid var(--primary)' : '3px solid transparent',
                        color: activeTab === 'verification' ? 'var(--primary)' : '#666',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                    }}
                >
                    Verification List
                </button>
            </div>

            {activeTab === 'verification' && selectedBooth && (
                <>
                    <div className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <Search size={20} color="#666" />
                        <input
                            type="text"
                            placeholder="പേര്, ക്രമനമ്പർ എന്നിവ തിരയുക..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ border: 'none', outline: 'none', flex: 1, fontSize: '1rem' }}
                        />
                    </div>

                    {loading ? <LoadingSpinner /> : (
                        <div className="grid">
                            {filteredVoters.map(voter => (
                                <div key={voter.id} className="card" style={{ padding: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ background: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                                    #{voter.sl_no}
                                                </span>
                                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{voter.name}</h3>
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                                                {voter.house_name} | Age: {voter.age}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="label" style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>പിന്തുണയ്ക്കുന്ന മുന്നണി:</label>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            {fronts.map(front => (
                                                <button
                                                    key={front.id}
                                                    onClick={() => handleFrontChange(voter.id, front.id)}
                                                    style={{
                                                        padding: '0.5rem 1rem',
                                                        borderRadius: '50px',
                                                        border: voter.supported_front_id === front.id ? `2px solid ${front.color || 'var(--primary)'}` : '1px solid #e2e8f0',
                                                        background: voter.supported_front_id === front.id ? (front.color ? `${front.color}20` : '#fdf2f4') : 'white',
                                                        color: voter.supported_front_id === front.id ? (front.color || 'var(--primary)') : 'var(--text)',
                                                        fontWeight: voter.supported_front_id === front.id ? 'bold' : 'normal',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {front.name}
                                                </button>
                                            ))}
                                            <button
                                                onClick={() => handleFrontChange(voter.id, null)}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    borderRadius: '50px',
                                                    border: '1px solid #e2e8f0',
                                                    background: !voter.supported_front_id ? '#f3f4f6' : 'white',
                                                    color: '#666',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                None
                                            </button>
                                        </div>
                                    </div>
                                    {voter.supported_front_id && (
                                        <div style={{ marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '0.5rem' }}>
                                            <button
                                                onClick={() => handleMarkVoted(voter.id, !voter.has_voted)}
                                                className={`btn ${voter.has_voted ? 'btn-success' : 'btn-secondary'}`}
                                                style={{
                                                    width: '100%',
                                                    padding: '0.5rem',
                                                    background: voter.has_voted ? '#10b981' : 'white',
                                                    color: voter.has_voted ? 'white' : 'var(--text)',
                                                    borderColor: voter.has_voted ? '#10b981' : '#e2e8f0'
                                                }}
                                            >
                                                {voter.has_voted ? 'വോട്ട് ചെയ്തു (Voted)' : 'വോട്ട് രേഖപ്പെടുത്തുക (Mark Voted)'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )
            }

            {
                activeTab === 'trend' && (
                    <div className="trend-section">
                        {loading ? <LoadingSpinner /> : stats ? (
                            <div className="grid grid-2">
                                {/* Summary Card */}
                                <div className="card" style={{ gridColumn: '1 / -1', background: 'linear-gradient(135deg, #371120 0%, #5b1d36 100%)', color: 'white' }}>
                                    <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '0.5rem' }}>
                                        ആകെ സ്ഥിതിവിവരക്കണക്കുകൾ (Total Statistics)
                                    </h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem', textAlign: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{stats.total}</div>
                                            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>ആകെ വോട്ടർമാർ</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#4ade80' }}>{stats.verified}</div>
                                            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>പരിശോധിച്ചവർ (Verified)</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fbbf24' }}>{stats.unverified}</div>
                                            <div style={{ fontSize: '0.9rem', opacity: 0.8 }}>ബാക്കിയുള്ളവർ (Pending)</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Chart Section */}
                                <div className="card" style={{ minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <h3 style={{ marginBottom: '1rem', color: 'var(--primary-bg)' }}>ഗ്രാഫ് (Graph)</h3>
                                    <div style={{ width: '100%', height: '300px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={stats.chartData}
                                                    cx="50%"
                                                    cy="50%"
                                                    labelLine={false}
                                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                    outerRadius={100}
                                                    fill="#8884d8"
                                                    dataKey="value"
                                                >
                                                    {stats.chartData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                                <RechartsTooltip />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Front Wise Breakdown */}
                                <div className="card">
                                    <h3 style={{ marginBottom: '1.5rem', color: 'var(--primary-bg)' }}>വിശദാംശങ്ങൾ (Details)</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {Object.entries(stats.fronts).map(([frontName, data]) => {
                                            const percentage = ((data.count / stats.total) * 100).toFixed(1);
                                            return (
                                                <div key={frontName} style={{ position: 'relative' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontWeight: '600' }}>
                                                        <span>{frontName}</span>
                                                        <span>{data.count} ({percentage}%)</span>
                                                    </div>
                                                    <div style={{ width: '100%', height: '12px', background: '#f3f4f6', borderRadius: '6px', overflow: 'hidden' }}>
                                                        <div style={{
                                                            width: `${percentage}%`,
                                                            height: '100%',
                                                            background: data.color,
                                                            borderRadius: '6px',
                                                            transition: 'width 0.5s ease-out'
                                                        }}></div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>
                                വിവരങ്ങൾ ലഭ്യമല്ല. ദയവായി ഒരു വാർഡ് അല്ലെങ്കിൽ ബൂത്ത് തിരഞ്ഞെടുക്കുക.
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    );
}
