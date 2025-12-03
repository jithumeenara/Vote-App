import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import LoadingSpinner from '../../components/LoadingSpinner';
import { CheckCircle, XCircle, Search, Filter, RotateCcw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { sendTelegramAlert, TelegramAlerts } from '../../lib/telegram';

export default function MarkVotes() {
    const { user } = useAuth();
    const { addToast } = useToast();

    const [panchayats, setPanchayats] = useState([]);
    const [wards, setWards] = useState([]);
    const [booths, setBooths] = useState([]);

    const [selectedPanchayat, setSelectedPanchayat] = useState('');
    const [selectedWard, setSelectedWard] = useState('');
    const [selectedBooth, setSelectedBooth] = useState('');

    const [voters, setVoters] = useState([]);
    const [filteredVoters, setFilteredVoters] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'voted'
    const [confirmingVoter, setConfirmingVoter] = useState(null);

    const isWardMember = user?.role === 'ward_member';

    // Fetch Panchayats
    useEffect(() => {
        fetchPanchayats();
    }, []);

    const fetchPanchayats = async () => {
        try {
            const { data, error } = await supabase.from('panchayats').select('*').order('name');
            if (error) throw error;
            setPanchayats(data);
        } catch (error) {
            console.error('Error fetching panchayats:', error);
        }
    };

    // Fetch Wards
    useEffect(() => {
        if (selectedPanchayat) {
            fetchWards(selectedPanchayat);
        } else {
            setWards([]);
        }
    }, [selectedPanchayat]);

    const fetchWards = async (panchayatId) => {
        try {
            const { data, error } = await supabase
                .from('wards')
                .select('*')
                .eq('panchayat_id', panchayatId)
                .order('ward_no');
            if (error) throw error;
            setWards(data);
        } catch (error) {
            console.error('Error fetching wards:', error);
        }
    };

    // Fetch Booths
    useEffect(() => {
        if (selectedWard) {
            fetchBooths(selectedWard);
        } else {
            setBooths([]);
        }
    }, [selectedWard]);

    const fetchBooths = async (wardId) => {
        try {
            const { data, error } = await supabase
                .from('booths')
                .select('*')
                .eq('ward_id', wardId)
                .order('booth_no');
            if (error) throw error;
            setBooths(data);
        } catch (error) {
            console.error('Error fetching booths:', error);
        }
    };

    // Ward Member Pre-selection
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

    // Fetch Voters
    useEffect(() => {
        if (selectedBooth) {
            fetchVoters();
        } else {
            setVoters([]);
            setFilteredVoters([]);
        }
    }, [selectedBooth]);

    const fetchVoters = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('voters')
                .select('*')
                .eq('booth_id', selectedBooth)
                .order('sl_no');

            if (error) throw error;
            setVoters(data);
        } catch (error) {
            console.error('Error fetching voters:', error);
            addToast('Error fetching voters', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Filter Voters based on Tab and Search
    useEffect(() => {
        let result = voters;

        // Filter by Tab (has_voted)
        if (activeTab === 'pending') {
            result = result.filter(v => !v.has_voted);
        } else {
            result = result.filter(v => v.has_voted);
        }

        // Filter by Search
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(v =>
                v.name.toLowerCase().includes(lowerTerm) ||
                v.sl_no.toString().includes(lowerTerm) ||
                (v.guardian_name && v.guardian_name.toLowerCase().includes(lowerTerm)) ||
                (v.house_name && v.house_name.toLowerCase().includes(lowerTerm))
            );
        }

        setFilteredVoters(result);
    }, [voters, activeTab, searchTerm]);

    const handleVoteClick = (voter) => {
        setConfirmingVoter(voter);
    };

    const confirmVote = async () => {
        if (!confirmingVoter) return;

        try {
            const { error } = await supabase
                .from('voters')
                .update({ has_voted: true })
                .eq('id', confirmingVoter.id);

            if (error) throw error;

            // Update local state
            setVoters(prev => prev.map(v => v.id === confirmingVoter.id ? { ...v, has_voted: true } : v));
            addToast('Voted successfully', 'success');

            // Send Telegram Alert
            const ward = wards.find(w => w.id === selectedWard);
            const wardName = ward ? `${ward.ward_no} - ${ward.name}` : 'Unknown Ward';

            const panchayat = panchayats.find(p => p.id === selectedPanchayat);
            const panchayatName = panchayat ? panchayat.name : 'Unknown Panchayat';

            const booth = booths.find(b => b.id === selectedBooth);
            const boothName = booth ? `${booth.booth_no} - ${booth.name}` : 'Unknown Booth';

            sendTelegramAlert(TelegramAlerts.voteMarked(confirmingVoter.name, confirmingVoter.sl_no, panchayatName, wardName, boothName));

            setConfirmingVoter(null);
        } catch (error) {
            console.error('Error marking vote:', error);
            addToast('Failed to mark vote. Check if "has_voted" column exists.', 'error');
        }
    };

    const handleUndo = async (voterId) => {
        try {
            const { error } = await supabase
                .from('voters')
                .update({ has_voted: false })
                .eq('id', voterId);

            if (error) throw error;

            // Update local state
            setVoters(prev => prev.map(v => v.id === voterId ? { ...v, has_voted: false } : v));
            addToast('Vote undone successfully', 'success');
        } catch (error) {
            console.error('Error undoing vote:', error);
            addToast('Failed to undo vote', 'error');
        }
    };

    return (
        <div className="container">
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-bg)' }}>വോട്ടിംഗ് രേഖപ്പെടുത്തുക (Mark Votes)</h2>

            {/* Filters */}
            <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                <div className="responsive-grid">
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
                            <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
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
                            <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
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
                            <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                            {booths.map(b => (
                                <option key={b.id} value={b.id}>{b.booth_no} - {b.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {selectedBooth && (
                <>
                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '2px solid #eee' }}>
                        <button
                            className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                            onClick={() => setActiveTab('pending')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                border: 'none',
                                background: 'none',
                                borderBottom: activeTab === 'pending' ? '3px solid var(--primary)' : '3px solid transparent',
                                color: activeTab === 'pending' ? 'var(--primary)' : '#666',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            വോട്ട് ചെയ്യാത്തവർ (Pending)
                        </button>
                        <button
                            className={`tab-btn ${activeTab === 'voted' ? 'active' : ''}`}
                            onClick={() => setActiveTab('voted')}
                            style={{
                                padding: '0.75rem 1.5rem',
                                border: 'none',
                                background: 'none',
                                borderBottom: activeTab === 'voted' ? '3px solid var(--success)' : '3px solid transparent',
                                color: activeTab === 'voted' ? 'var(--success)' : '#666',
                                fontWeight: 'bold',
                                cursor: 'pointer'
                            }}
                        >
                            വോട്ട് ചെയ്തവർ (Voted)
                        </button>
                    </div>

                    {/* Stats Summary */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div className="card" style={{ padding: '1rem', textAlign: 'center', background: '#dcfce7', border: '1px solid #bbf7d0' }}>
                            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#166534' }}>
                                {voters.filter(v => v.has_voted).length}
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#166534', fontWeight: '600' }}>വോട്ട് ചെയ്തവർ</p>
                        </div>
                        <div className="card" style={{ padding: '1rem', textAlign: 'center', background: '#f3e8ff', border: '1px solid #d8b4fe' }}>
                            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#6b21a8' }}>
                                {voters.filter(v => !v.has_voted && v.status !== 'deleted' && v.status !== 'shifted').length}
                            </h3>
                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b21a8', fontWeight: '600' }}>വോട്ട് ചെയ്യാനുള്ളവർ</p>
                        </div>
                    </div>

                    {/* Search */}
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

                    {/* List */}
                    {loading ? (
                        <LoadingSpinner />
                    ) : (
                        <div className="card">
                            <div className="voter-list-container">
                                {/* Desktop Table View */}
                                <table className="table desktop-view">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '80px' }}>Sl.No</th>
                                            <th>പേര്</th>
                                            <th>രക്ഷിതാവ്</th>
                                            <th>വിലാസം</th>
                                            <th style={{ width: '120px', textAlign: 'center' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredVoters.length > 0 ? (
                                            filteredVoters.map(voter => (
                                                <tr key={voter.id} style={{ background: voter.status === 'shifted' || voter.status === 'delete' ? '#f3f4f6' : 'white' }}>
                                                    <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{voter.sl_no}</td>
                                                    <td>
                                                        <div style={{ fontWeight: 'bold' }}>{voter.name}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#666' }}>ID: {voter.id_card_no}</div>
                                                    </td>
                                                    <td>{voter.guardian_name}</td>
                                                    <td>
                                                        <div>{voter.house_name}</div>
                                                        <div style={{ fontSize: '0.8rem', color: '#666' }}>No: {voter.house_no}</div>
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {activeTab === 'pending' ? (
                                                            <button
                                                                onClick={() => handleVoteClick(voter)}
                                                                className="btn"
                                                                style={{
                                                                    background: '#dcfce7',
                                                                    color: '#166534',
                                                                    border: '1px solid #bbf7d0',
                                                                    padding: '0.5rem 1rem',
                                                                    borderRadius: '8px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.5rem',
                                                                    fontWeight: 'bold',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <CheckCircle size={18} />
                                                                Voted
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleUndo(voter.id)}
                                                                className="btn"
                                                                style={{
                                                                    background: '#fee2e2',
                                                                    color: '#991b1b',
                                                                    border: '1px solid #fecaca',
                                                                    padding: '0.5rem 1rem',
                                                                    borderRadius: '8px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '0.5rem',
                                                                    fontWeight: 'bold',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <RotateCcw size={18} />
                                                                Undo
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                                                    വോട്ടർമാരെ കണ്ടെത്തിയില്ല
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                {/* Mobile Tile View */}
                                <div className="mobile-view">
                                    {filteredVoters.length > 0 ? (
                                        filteredVoters.map(voter => (
                                            <div key={voter.id} className="voter-tile" style={{
                                                background: voter.status === 'shifted' || voter.status === 'delete' ? '#f3f4f6' : 'white',
                                                padding: '1rem',
                                                borderBottom: '1px solid #eee',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '0.5rem'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <span style={{
                                                                background: 'var(--primary)',
                                                                color: 'white',
                                                                padding: '2px 6px',
                                                                borderRadius: '4px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 'bold'
                                                            }}>
                                                                #{voter.sl_no}
                                                            </span>
                                                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1f2937' }}>{voter.name}</h3>
                                                        </div>
                                                        <div style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '2px' }}>ID: {voter.id_card_no}</div>
                                                    </div>
                                                    {activeTab === 'pending' ? (
                                                        <button
                                                            onClick={() => handleVoteClick(voter)}
                                                            style={{
                                                                background: '#dcfce7',
                                                                color: '#166534',
                                                                border: 'none',
                                                                padding: '0.5rem',
                                                                borderRadius: '50%',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            <CheckCircle size={24} />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleUndo(voter.id)}
                                                            style={{
                                                                background: '#fee2e2',
                                                                color: '#991b1b',
                                                                border: 'none',
                                                                padding: '0.5rem',
                                                                borderRadius: '50%',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                        >
                                                            <RotateCcw size={24} />
                                                        </button>
                                                    )}
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem', color: '#4b5563' }}>
                                                    <div>
                                                        <span style={{ fontWeight: '600', display: 'block', fontSize: '0.75rem', color: '#9ca3af' }}>GUARDIAN</span>
                                                        {voter.guardian_name}
                                                    </div>
                                                    <div>
                                                        <span style={{ fontWeight: '600', display: 'block', fontSize: '0.75rem', color: '#9ca3af' }}>HOUSE</span>
                                                        {voter.house_name} ({voter.house_no})
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                                            വോട്ടർമാരെ കണ്ടെത്തിയില്ല
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
            {/* Confirmation Modal */}
            {confirmingVoter && (
                <ConfirmationModal
                    voter={confirmingVoter}
                    onConfirm={confirmVote}
                    onCancel={() => setConfirmingVoter(null)}
                />
            )}
        </div>
    );
}

// Confirmation Modal
function ConfirmationModal({ voter, onConfirm, onCancel }) {
    if (!voter) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 2000
        }}>
            <div style={{
                background: 'white',
                padding: '2rem',
                borderRadius: '16px',
                width: '90%',
                maxWidth: '400px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                textAlign: 'center'
            }}>
                <div style={{
                    width: '60px',
                    height: '60px',
                    background: '#dcfce7',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto'
                }}>
                    <CheckCircle size={32} color="#166534" />
                </div>

                <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', color: '#1f2937' }}>വോട്ടിംഗ് സ്ഥിരീകരിക്കുക</h3>
                <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>
                    <strong>{voter.name}</strong> (Sl.No: {voter.sl_no}) വോട്ട് ചെയ്തു എന്ന് രേഖപ്പെടുത്തണോ?
                </p>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            borderRadius: '8px',
                            border: '1px solid #e5e7eb',
                            background: 'white',
                            color: '#374151',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        റദ്ദാക്കുക (Cancel)
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            flex: 1,
                            padding: '0.75rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#166534',
                            color: 'white',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        സ്ഥിരീകരിക്കുക (Confirm)
                    </button>
                </div>
            </div>
        </div>
    );
}
