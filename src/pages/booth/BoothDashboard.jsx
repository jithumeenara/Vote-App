import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import Pagination from '../../components/Pagination';
import { CheckCircle, RotateCcw, Search, LogOut, User, BarChart2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { sendTelegramAlert, TelegramAlerts } from '../../lib/telegram';
import { useNavigate } from 'react-router-dom';

export default function BoothDashboard() {
    const { user, signOut } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    const boothId = user?.booth_id;
    const boothLabel = user ? `${user.booth_no} - ${user.booth_name}` : '';

    const [activeTab, setActiveTab] = useState('mark'); // 'mark' | 'verify' | 'stats'

    // Mark Votes state
    const [markSubTab, setMarkSubTab] = useState('pending');
    const [markVoters, setMarkVoters] = useState([]);
    const [markTotal, setMarkTotal] = useState(0);
    const [markPage, setMarkPage] = useState(1);
    const [markPageSize, setMarkPageSize] = useState(10);
    const [markSearch, setMarkSearch] = useState('');
    const [markLoading, setMarkLoading] = useState(false);
    const [confirmingVoter, setConfirmingVoter] = useState(null);

    // Verify state
    const [verifyVoters, setVerifyVoters] = useState([]);
    const [verifyTotal, setVerifyTotal] = useState(0);
    const [verifyPage, setVerifyPage] = useState(1);
    const [verifyPageSize, setVerifyPageSize] = useState(10);
    const [verifySearch, setVerifySearch] = useState('');
    const [verifyFilter, setVerifyFilter] = useState('all');
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [fronts, setFronts] = useState([]);
    const [savingFront, setSavingFront] = useState(null);

    // Stats state
    const [stats, setStats] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);

    useEffect(() => {
        if (!boothId) return;
        fetchFronts();
    }, [boothId]);

    useEffect(() => {
        if (!boothId || activeTab !== 'mark') return;
        setMarkPage(1);
        fetchMarkVoters(1, markPageSize);
    }, [boothId, activeTab, markSubTab, markSearch]);

    useEffect(() => {
        if (!boothId || activeTab !== 'verify') return;
        setVerifyPage(1);
        fetchVerifyVoters(1, verifyPageSize);
    }, [boothId, activeTab, verifySearch, verifyFilter]);

    useEffect(() => {
        if (!boothId || activeTab !== 'stats') return;
        fetchStats();
    }, [boothId, activeTab]);

    const fetchFronts = async () => {
        const { data } = await supabase.from('fronts').select('*').order('name');
        setFronts(data || []);
    };

    // ── Mark Votes ──────────────────────────────────────────────────────────────
    const fetchMarkVoters = async (page = markPage, size = markPageSize) => {
        setMarkLoading(true);
        try {
            const from = (page - 1) * size;
            const to = from + size - 1;

            let query = supabase
                .from('voters')
                .select('*', { count: 'exact' })
                .eq('booth_id', boothId)
                .eq('has_voted', markSubTab === 'voted')
                .order('sl_no');

            if (markSearch.trim()) {
                const term = markSearch.trim();
                const isNum = /^\d+$/.test(term);
                const orFilter = isNum
                    ? `name.ilike.%${term}%,id_card_no.ilike.%${term}%,sl_no.eq.${term}`
                    : `name.ilike.%${term}%,id_card_no.ilike.%${term}%`;
                query = query.or(orFilter);
            }

            const { data, error, count } = await query.range(from, to);
            if (error) throw error;
            setMarkVoters(data || []);
            setMarkTotal(count || 0);
        } catch (err) {
            addToast('Error loading voters: ' + err.message, 'error');
        } finally {
            setMarkLoading(false);
        }
    };

    const handleMarkPageChange = (p) => {
        setMarkPage(p);
        fetchMarkVoters(p, markPageSize);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleMarkPageSizeChange = (s) => {
        setMarkPageSize(s);
        setMarkPage(1);
        fetchMarkVoters(1, s);
    };

    const confirmVote = async () => {
        if (!confirmingVoter) return;
        const prev = [...markVoters];
        setMarkVoters(v => v.map(x => x.id === confirmingVoter.id ? { ...x, has_voted: true } : x));
        setConfirmingVoter(null);
        addToast('Voted successfully', 'success');
        try {
            const { error } = await supabase.from('voters').update({ has_voted: true }).eq('id', confirmingVoter.id);
            if (error) throw error;
            sendTelegramAlert(TelegramAlerts.voteMarked(confirmingVoter.name, confirmingVoter.sl_no, '', '', boothLabel));
            fetchMarkVoters(markPage);
        } catch (err) {
            addToast('Failed to mark vote', 'error');
            setMarkVoters(prev);
        }
    };

    const handleUndo = async (voterId) => {
        const prev = [...markVoters];
        setMarkVoters(v => v.map(x => x.id === voterId ? { ...x, has_voted: false } : x));
        addToast('Vote undone', 'success');
        try {
            const { error } = await supabase.from('voters').update({ has_voted: false }).eq('id', voterId);
            if (error) throw error;
        } catch (err) {
            addToast('Failed to undo vote', 'error');
            setMarkVoters(prev);
        }
    };

    // ── Voter Verification ───────────────────────────────────────────────────────
    const fetchVerifyVoters = async (page = verifyPage, size = verifyPageSize) => {
        setVerifyLoading(true);
        try {
            const from = (page - 1) * size;
            const to = from + size - 1;

            let query = supabase
                .from('voters')
                .select('*, fronts(name, color)', { count: 'exact' })
                .eq('booth_id', boothId)
                .order('sl_no');

            if (verifyFilter === 'verified') query = query.not('supported_front_id', 'is', null);
            else if (verifyFilter === 'not_verified') query = query.is('supported_front_id', null);

            if (verifySearch.trim()) {
                const term = verifySearch.trim();
                const isNum = /^\d+$/.test(term);
                const orFilter = isNum
                    ? `name.ilike.%${term}%,id_card_no.ilike.%${term}%,sl_no.eq.${term}`
                    : `name.ilike.%${term}%,id_card_no.ilike.%${term}%`;
                query = query.or(orFilter);
            }

            const { data, error, count } = await query.range(from, to);
            if (error) throw error;
            setVerifyVoters(data || []);
            setVerifyTotal(count || 0);
        } catch (err) {
            addToast('Error loading voters: ' + err.message, 'error');
        } finally {
            setVerifyLoading(false);
        }
    };

    const handleVerifyPageChange = (p) => {
        setVerifyPage(p);
        fetchVerifyVoters(p, verifyPageSize);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const handleVerifyPageSizeChange = (s) => {
        setVerifyPageSize(s);
        setVerifyPage(1);
        fetchVerifyVoters(1, s);
    };

    const assignFront = async (voterId, frontId) => {
        setSavingFront(voterId);
        try {
            const { error } = await supabase.rpc('update_voter_front', {
                p_voter_id: voterId,
                p_front_id: frontId || null
            });
            if (error) throw error;
            setVerifyVoters(v => v.map(x => {
                if (x.id !== voterId) return x;
                const front = fronts.find(f => f.id === frontId);
                return { ...x, supported_front_id: frontId || null, fronts: front || null };
            }));
            addToast('Front assigned', 'success');
        } catch (err) {
            addToast('Failed: ' + err.message, 'error');
        } finally {
            setSavingFront(null);
        }
    };

    // ── Stats ────────────────────────────────────────────────────────────────────
    const fetchStats = async () => {
        setStatsLoading(true);
        try {
            const base = supabase.from('voters').select('*', { count: 'exact', head: true }).eq('booth_id', boothId);
            const [total, voted, verified] = await Promise.all([
                base,
                supabase.from('voters').select('*', { count: 'exact', head: true }).eq('booth_id', boothId).eq('has_voted', true),
                supabase.from('voters').select('*', { count: 'exact', head: true }).eq('booth_id', boothId).not('supported_front_id', 'is', null),
            ]);
            const totalCount = total.count || 0;
            const votedCount = voted.count || 0;
            const verifiedCount = verified.count || 0;

            // Front-wise breakdown
            const frontStats = await Promise.all(fronts.map(async (f) => {
                const { count } = await supabase.from('voters').select('*', { count: 'exact', head: true }).eq('booth_id', boothId).eq('supported_front_id', f.id);
                return { ...f, count: count || 0 };
            }));

            setStats({ totalCount, votedCount, verifiedCount, frontStats });
        } catch (err) {
            addToast('Error loading stats: ' + err.message, 'error');
        } finally {
            setStatsLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    const tabStyle = (tab) => ({
        padding: '0.75rem 1.25rem',
        border: 'none',
        background: 'none',
        borderBottom: activeTab === tab ? '3px solid var(--primary)' : '3px solid transparent',
        color: activeTab === tab ? 'var(--primary)' : '#666',
        fontWeight: 'bold',
        cursor: 'pointer',
        fontSize: '0.95rem',
    });

    return (
        <div>
            {/* Header with booth info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ color: 'var(--primary-bg)', margin: 0 }}>ബൂത്ത് ഡാഷ്ബോർഡ്</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem', color: '#555', fontSize: '0.95rem' }}>
                        <User size={16} />
                        <span>{user?.username}</span>
                        <span style={{ color: '#ccc' }}>|</span>
                        <strong style={{ color: 'var(--primary)' }}>ബൂത്ത് {boothLabel}</strong>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', color: '#dc2626', cursor: 'pointer', fontWeight: '600' }}
                >
                    <LogOut size={16} />
                    ലോഗൗട്ട്
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid #eee', marginBottom: '1.5rem' }}>
                <button style={tabStyle('mark')} onClick={() => setActiveTab('mark')}>
                    ✅ വോട്ട് രേഖപ്പെടുത്തുക
                </button>
                <button style={tabStyle('verify')} onClick={() => setActiveTab('verify')}>
                    🔍 പിന്തുണ സ്ഥിരീകരിക്കുക
                </button>
                <button style={tabStyle('stats')} onClick={() => setActiveTab('stats')}>
                    <BarChart2 size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    റിപ്പോർട്ട്
                </button>
            </div>

            {/* ── Mark Votes Tab ── */}
            {activeTab === 'mark' && (
                <div>
                    {/* Sub-tabs */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                        {[['pending', 'വോട്ട് ചെയ്യാത്തവർ'], ['voted', 'വോട്ട് ചെയ്തവർ']].map(([val, label]) => (
                            <button key={val} onClick={() => setMarkSubTab(val)} style={{
                                padding: '0.5rem 1.25rem', borderRadius: '20px', border: 'none', cursor: 'pointer', fontWeight: '600',
                                background: markSubTab === val ? (val === 'pending' ? '#dcfce7' : '#fee2e2') : '#f3f4f6',
                                color: markSubTab === val ? (val === 'pending' ? '#166534' : '#991b1b') : '#374151',
                            }}>{label}</button>
                        ))}
                    </div>

                    {/* Search */}
                    <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Search size={18} color="#666" />
                        <input
                            type="text"
                            placeholder="പേര്, ക്രമനമ്പർ, ഐഡി കാർഡ് തിരയുക..."
                            value={markSearch}
                            onChange={e => setMarkSearch(e.target.value)}
                            style={{ border: 'none', outline: 'none', flex: 1, fontSize: '1rem' }}
                        />
                    </div>

                    {markLoading ? <LoadingSpinner /> : (
                        <div className="card">
                            {/* Mobile list */}
                            {markVoters.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>വോട്ടർമാരെ കണ്ടെത്തിയില്ല</div>
                            ) : (
                                markVoters.map(voter => (
                                    <div key={voter.id} style={{ padding: '1rem', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                <span style={{ background: 'var(--primary)', color: 'white', padding: '2px 7px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>#{voter.sl_no}</span>
                                                <span style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>{voter.name}</span>
                                            </div>
                                            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '3px' }}>
                                                ID: {voter.id_card_no} &nbsp;|&nbsp; {voter.guardian_name} &nbsp;|&nbsp; {voter.house_name}
                                            </div>
                                        </div>
                                        {markSubTab === 'pending' ? (
                                            <button onClick={() => setConfirmingVoter(voter)} style={{ background: '#dcfce7', color: '#166534', border: 'none', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <CheckCircle size={24} />
                                            </button>
                                        ) : (
                                            <button onClick={() => handleUndo(voter.id)} style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <RotateCcw size={24} />
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                            {markTotal > 0 && (
                                <Pagination
                                    currentPage={markPage}
                                    totalPages={Math.ceil(markTotal / markPageSize)}
                                    totalItems={markTotal}
                                    pageSize={markPageSize}
                                    onPageChange={handleMarkPageChange}
                                    onPageSizeChange={handleMarkPageSizeChange}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Voter Verification Tab ── */}
            {activeTab === 'verify' && (
                <div>
                    {/* Filter row */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div className="card" style={{ padding: '0.75rem 1rem', flex: 1, minWidth: '200px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Search size={18} color="#666" />
                            <input
                                type="text"
                                placeholder="പേര്, ക്രമനമ്പർ, ഐഡി കാർഡ് തിരയുക..."
                                value={verifySearch}
                                onChange={e => setVerifySearch(e.target.value)}
                                style={{ border: 'none', outline: 'none', flex: 1, fontSize: '1rem' }}
                            />
                        </div>
                        <select value={verifyFilter} onChange={e => setVerifyFilter(e.target.value)} className="input" style={{ width: 'auto', minWidth: '160px' }}>
                            <option value="all">എല്ലാം (All)</option>
                            <option value="verified">സ്ഥിരീകരിച്ചവർ</option>
                            <option value="not_verified">സ്ഥിരീകരിക്കാത്തവർ</option>
                        </select>
                    </div>

                    {verifyLoading ? <LoadingSpinner /> : (
                        <div className="card">
                            {verifyVoters.length === 0 ? (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>വോട്ടർമാരെ കണ്ടെത്തിയില്ല</div>
                            ) : (
                                verifyVoters.map(voter => (
                                    <div key={voter.id} style={{ padding: '1rem', borderBottom: '1px solid #f0f0f0' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                                    <span style={{ background: voter.fronts?.color || 'var(--primary)', color: 'white', padding: '2px 7px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>#{voter.sl_no}</span>
                                                    <span style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>{voter.name}</span>
                                                    {voter.fronts && (
                                                        <span style={{ background: voter.fronts.color, color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                            {voter.fronts.name}
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '3px' }}>ID: {voter.id_card_no} &nbsp;|&nbsp; {voter.guardian_name}</div>
                                            </div>
                                            <select
                                                value={voter.supported_front_id || ''}
                                                onChange={e => assignFront(voter.id, e.target.value || null)}
                                                disabled={savingFront === voter.id}
                                                className="input"
                                                style={{ width: 'auto', minWidth: '150px', fontSize: '0.9rem', borderColor: voter.fronts?.color || '#e5e7eb' }}
                                            >
                                                <option value="">-- ഫ്രണ്ട് --</option>
                                                {fronts.map(f => (
                                                    <option key={f.id} value={f.id}>{f.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ))
                            )}
                            {verifyTotal > 0 && (
                                <Pagination
                                    currentPage={verifyPage}
                                    totalPages={Math.ceil(verifyTotal / verifyPageSize)}
                                    totalItems={verifyTotal}
                                    pageSize={verifyPageSize}
                                    onPageChange={handleVerifyPageChange}
                                    onPageSizeChange={handleVerifyPageSizeChange}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ── Stats Tab ── */}
            {activeTab === 'stats' && (
                <div>
                    {statsLoading ? <LoadingSpinner /> : stats ? (
                        <div>
                            {/* Summary cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div className="card" style={{ padding: '1.25rem', textAlign: 'center', background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1d4ed8' }}>{stats.totalCount}</div>
                                    <div style={{ fontSize: '0.9rem', color: '#1d4ed8', fontWeight: '600' }}>മൊത്തം വോട്ടർമാർ</div>
                                </div>
                                <div className="card" style={{ padding: '1.25rem', textAlign: 'center', background: '#dcfce7', border: '1px solid #bbf7d0' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#166534' }}>{stats.votedCount}</div>
                                    <div style={{ fontSize: '0.9rem', color: '#166534', fontWeight: '600' }}>വോട്ട് ചെയ്തവർ</div>
                                </div>
                                <div className="card" style={{ padding: '1.25rem', textAlign: 'center', background: '#fef9c3', border: '1px solid #fde68a' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#92400e' }}>{stats.totalCount - stats.votedCount}</div>
                                    <div style={{ fontSize: '0.9rem', color: '#92400e', fontWeight: '600' }}>വോട്ട് ചെയ്യാത്തവർ</div>
                                </div>
                                <div className="card" style={{ padding: '1.25rem', textAlign: 'center', background: '#f3e8ff', border: '1px solid #d8b4fe' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6b21a8' }}>{stats.verifiedCount}</div>
                                    <div style={{ fontSize: '0.9rem', color: '#6b21a8', fontWeight: '600' }}>പിന്തുണ സ്ഥിരീകരിച്ചവർ</div>
                                </div>
                            </div>

                            {/* Front-wise breakdown */}
                            {stats.frontStats.length > 0 && (
                                <div className="card" style={{ padding: '1.5rem' }}>
                                    <h3 style={{ marginTop: 0, marginBottom: '1rem', color: '#374151' }}>ഫ്രണ്ട് തിരിച്ചുള്ള കണക്ക്</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {stats.frontStats.filter(f => f.count > 0).map(f => (
                                            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                                                <span style={{ flex: 1, fontWeight: '600' }}>{f.name}</span>
                                                <div style={{ flex: 2, background: '#f3f4f6', borderRadius: '6px', height: '20px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${stats.totalCount ? (f.count / stats.totalCount) * 100 : 0}%`, background: f.color, height: '100%', borderRadius: '6px', transition: 'width 0.5s ease' }} />
                                                </div>
                                                <span style={{ fontWeight: 'bold', minWidth: '40px', textAlign: 'right' }}>{f.count}</span>
                                            </div>
                                        ))}
                                        {stats.frontStats.every(f => f.count === 0) && (
                                            <p style={{ color: '#9ca3af', textAlign: 'center' }}>ഇതുവരെ ഫ്രണ്ട് ഡേറ്റ ഇല്ല</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>ഡേറ്റ ലോഡ് ചെയ്യുന്നില്ല</div>
                    )}
                </div>
            )}

            {/* Confirm Vote Modal */}
            {confirmingVoter && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
                    <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', width: '90%', maxWidth: '380px', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                        <div style={{ width: '60px', height: '60px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                            <CheckCircle size={32} color="#166534" />
                        </div>
                        <h3 style={{ marginBottom: '0.5rem' }}>വോട്ടിംഗ് സ്ഥിരീകരിക്കുക</h3>
                        <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>
                            <strong>{confirmingVoter.name}</strong> (Sl.No: {confirmingVoter.sl_no}) വോട്ട് ചെയ്തു എന്ന് രേഖപ്പെടുത്തണോ?
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button onClick={() => setConfirmingVoter(null)} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontWeight: '600' }}>
                                റദ്ദാക്കുക
                            </button>
                            <button onClick={confirmVote} style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', background: '#166534', color: 'white', cursor: 'pointer', fontWeight: '600' }}>
                                സ്ഥിരീകരിക്കുക
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
