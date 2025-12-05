import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Edit, Trash2, Save, X, Search, Bot } from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ConfirmModal from '../../../components/ConfirmModal';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { transliterateToMalayalam } from '../../../lib/ai';

export default function ManageVoters() {
    const { user } = useAuth();
    const { addToast } = useToast();
    const [panchayats, setPanchayats] = useState([]);
    const [wards, setWards] = useState([]);
    const [booths, setBooths] = useState([]);

    const [selectedPanchayat, setSelectedPanchayat] = useState('');
    const [selectedWard, setSelectedWard] = useState('');
    const [selectedBooth, setSelectedBooth] = useState('');

    const [voters, setVoters] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});

    const [deleteId, setDeleteId] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // AI Search State
    const [isAiEnabled, setIsAiEnabled] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiSearchTerms, setAiSearchTerms] = useState([]);

    const isWardMember = user?.role === 'ward_member';

    useEffect(() => {
        fetchPanchayats();
        if (isWardMember && user?.ward_id) {
            fetchUserWardDetails();
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
        }
    }

    useEffect(() => {
        if (selectedPanchayat) {
            fetchWards(selectedPanchayat);
        } else {
            setWards([]);
            setBooths([]);
            setVoters([]);
        }
    }, [selectedPanchayat]);

    useEffect(() => {
        if (selectedWard) {
            fetchBooths(selectedWard);
        } else {
            setBooths([]);
            setVoters([]);
        }
    }, [selectedWard]);

    useEffect(() => {
        if (selectedBooth) {
            fetchVoters(selectedBooth);
        } else {
            setVoters([]);
        }
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

    async function fetchVoters(boothId) {
        setLoading(true);
        try {
            if (isWardMember) {
                // Secure RPC for Ward User
                const { data, error } = await supabase.rpc('ward_get_voters', {
                    token: user.session_token,
                    booth_id_input: boothId
                });
                if (error) throw error;
                setVoters(data || []);
            } else {
                // Standard Select for Admin
                const { data, error } = await supabase.from('voters').select('*').eq('booth_id', boothId).order('sl_no');
                if (error) throw error;
                setVoters(data || []);
            }
        } catch (error) {
            console.error('Error fetching voters:', error);
        } finally {
            setLoading(false);
        }
    }

    function confirmDelete(id) {
        setDeleteId(id);
        setIsDeleteModalOpen(true);
    }

    async function handleDelete() {
        if (!deleteId) return;

        if (isWardMember) {
            addToast('വാർഡ് മെമ്പർക്ക് വോട്ടർമാരെ ഡിലീറ്റ് ചെയ്യാൻ അനുവാദമില്ല.', 'error');
            setIsDeleteModalOpen(false);
            return;
        }

        // Optimistic Update
        const previousVoters = [...voters];
        setVoters(voters.filter(v => v.id !== deleteId));
        setIsDeleteModalOpen(false);
        setDeleteId(null);
        addToast('വോട്ടറെ നീക്കം ചെയ്തു', 'success');

        try {
            const { error } = await supabase.from('voters').delete().eq('id', deleteId);
            if (error) throw error;
        } catch (error) {
            console.error('Error deleting voter:', error);
            addToast('നീക്കം ചെയ്യുന്നത് പരാജയപ്പെട്ടു: ' + error.message, 'error');
            setVoters(previousVoters); // Revert
        }
    }

    function startEdit(voter) {
        setEditingId(voter.id);
        setEditData({ ...voter });
    }

    async function saveEdit(id) {
        // if (isWardMember) {
        //     addToast('വാർഡ് മെമ്പർക്ക് വോട്ടർമാരെ എഡിറ്റ് ചെയ്യാൻ അനുവാദമില്ല.', 'error');
        //     return;
        // }

        // Optimistic Update
        const previousVoters = [...voters];
        const optimisticVoter = {
            ...editData,
            id,
            sl_no: parseInt(editData.sl_no),
            age: parseInt(editData.age)
        };

        setVoters(voters.map(v => v.id === id ? optimisticVoter : v));
        setEditingId(null);
        addToast('മാറ്റങ്ങൾ സേവ് ചെയ്തു', 'success');

        try {
            const { error } = await supabase.from('voters').update({
                name: editData.name,
                sl_no: parseInt(editData.sl_no),
                guardian_name: editData.guardian_name,
                house_name: editData.house_name,
                age: parseInt(editData.age),
                gender: editData.gender,
                id_card_no: editData.id_card_no,
                status: editData.status
            }).eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating voter:', error);
            addToast('അപ്‌ഡേറ്റ് പരാജയപ്പെട്ടു: ' + error.message, 'error');
            setVoters(previousVoters); // Revert
            setEditingId(id); // Re-open edit
        }
    }

    // AI Search Logic with Debounce
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (isAiEnabled && searchTerm.length > 2) {
                setAiLoading(true);
                try {
                    // Get multiple variations from AI
                    const malayalamTerms = await transliterateToMalayalam(searchTerm);
                    setAiSearchTerms(malayalamTerms);
                } catch (error) {
                    console.error("AI Search Error", error);
                } finally {
                    setAiLoading(false);
                }
            } else {
                setAiSearchTerms([]);
            }
        }, 600); // 600ms delay for better typing experience

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, isAiEnabled]);

    function handleSearchChange(e) {
        setSearchTerm(e.target.value);
    }

    const filteredVoters = voters.filter(v => {
        const searchLower = searchTerm.toLowerCase();
        const matchesNormal = v.name.toLowerCase().includes(searchLower) ||
            v.sl_no.toString().includes(searchLower) ||
            v.id_card_no?.toLowerCase().includes(searchLower);

        if (!isAiEnabled || aiSearchTerms.length === 0) return matchesNormal;

        // AI Match: Check if any of the AI generated Malayalam terms match the name
        const matchesAi = aiSearchTerms.some(term => v.name.includes(term));
        return matchesNormal || matchesAi;
    });

    return (
        <div className="container">
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>വോട്ടർമാരെ നിയന്ത്രിക്കുക</h2>

            <div className="grid grid-3" style={{ marginBottom: '2rem' }}>
                <div className="form-group">
                    <label className="label">പഞ്ചായത്ത്</label>
                    <select
                        className="input"
                        value={selectedPanchayat}
                        onChange={e => setSelectedPanchayat(e.target.value)}
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
                        onChange={e => setSelectedWard(e.target.value)}
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

            {selectedBooth && (
                <div className="search-bar" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Search className="search-icon" size={20} />
                            <input
                                type="text"
                                className="search-input"
                                placeholder={isAiEnabled ? "മംഗ്ലീഷിൽ ടൈപ്പ് ചെയ്യുക (ഉദാ: 'Raju')" : "പേര്, ക്രമനമ്പർ, ഐഡി കാർഡ് എന്നിവ തിരയുക..."}
                                value={searchTerm}
                                onChange={handleSearchChange}
                            />
                            {aiLoading && (
                                <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)' }}>
                                    <LoadingSpinner size="small" />
                                </div>
                            )}
                        </div>
                        <button
                            className={`btn ${isAiEnabled ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setIsAiEnabled(!isAiEnabled)}
                            title="AI മംഗ്ലീഷ് സെർച്ച്"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' }}
                        >
                            <Bot size={20} />
                            {isAiEnabled ? 'AI ON' : 'AI OFF'}
                        </button>
                    </div>
                    {isAiEnabled && aiSearchTerms.length > 0 && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--primary)', paddingLeft: '0.5rem' }}>
                            തിരയുന്നു: {aiSearchTerms.join(', ')}
                        </div>
                    )}
                </div>
            )}

            {loading ? <LoadingSpinner /> : (
                <div className="grid">
                    {filteredVoters.map((voter) => (
                        <div key={voter.id} className="card" style={{ padding: '1rem', position: 'relative', overflow: 'hidden' }}>
                            {voter.status !== 'active' && (
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    backgroundColor: 'rgba(255, 255, 255, 0.6)',
                                    zIndex: 10,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    pointerEvents: 'none'
                                }}>
                                    <div style={{
                                        backgroundColor: voter.status === 'deleted' ? '#ef4444' :
                                            voter.status === 'death' ? '#000000' :
                                                voter.status === 'duplicate' ? '#7c3aed' : '#f59e0b',
                                        color: 'white',
                                        padding: '0.25rem 1rem',
                                        fontSize: '1rem',
                                        fontWeight: 'bold',
                                        transform: 'rotate(-15deg)',
                                        border: '2px solid white',
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                                        textTransform: 'uppercase'
                                    }}>
                                        {voter.status.replace(/_/g, ' ')}
                                    </div>
                                </div>
                            )}
                            {editingId === voter.id ? (
                                <div className="grid grid-2" style={{ gap: '1rem' }}>
                                    <div className="form-group">
                                        <label className="label">ക്രമനമ്പർ</label>
                                        <input className="input" type="number" value={editData.sl_no} onChange={e => setEditData({ ...editData, sl_no: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">പേര്</label>
                                        <input className="input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">രക്ഷിതാവ്</label>
                                        <input className="input" value={editData.guardian_name} onChange={e => setEditData({ ...editData, guardian_name: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">വീട്ടുപേര്</label>
                                        <input className="input" value={editData.house_name} onChange={e => setEditData({ ...editData, house_name: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">ഐഡി കാർഡ്</label>
                                        <input className="input" value={editData.id_card_no} onChange={e => setEditData({ ...editData, id_card_no: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">വയസ്സ്</label>
                                        <input className="input" type="number" value={editData.age} onChange={e => setEditData({ ...editData, age: e.target.value })} />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">അവസ്ഥ (Status)</label>
                                        <select
                                            className="input"
                                            value={editData.status || 'active'}
                                            onChange={e => setEditData({ ...editData, status: e.target.value })}
                                        >
                                            <option value="active">Active</option>
                                            <option value="shifted">Shifted</option>
                                            <option value="deleted">Deleted</option>
                                            <option value="death">Death</option>
                                            <option value="gulf">Gulf</option>
                                            <option value="out_of_place">Out of Place</option>
                                            <option value="duplicate">Duplicate</option>
                                        </select>
                                    </div>

                                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                        <button onClick={() => saveEdit(voter.id)} className="btn btn-primary">സേവ്</button>
                                        <button onClick={() => setEditingId(null)} className="btn btn-secondary">റദ്ദാക്കുക</button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>SL NO: {voter.sl_no}</div>
                                        <div style={{ fontWeight: '700', fontSize: '1.1rem' }}>{voter.name}</div>
                                        <div style={{ fontSize: '0.9rem', color: 'var(--text-light)' }}>
                                            {voter.house_name} | ID: {voter.id_card_no}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={() => startEdit(voter)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                                            <Edit size={20} color="var(--primary)" />
                                        </button>
                                        <button onClick={() => confirmDelete(voter.id)} className="btn btn-secondary" style={{ padding: '0.5rem', borderColor: 'var(--danger)' }}>
                                            <Trash2 size={20} color="var(--danger)" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {selectedBooth && filteredVoters.length === 0 && (
                        <div style={{ color: 'var(--text-light)' }}>വോട്ടർമാരെ കണ്ടെത്തിയില്ല.</div>
                    )}
                </div>
            )}

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="വോട്ടറെ ഡിലീറ്റ് ചെയ്യണോ?"
                message="ഈ പ്രവൃത്തി തിരിച്ചെടുക്കാൻ കഴിയില്ല."
            />
        </div>
    );
}
