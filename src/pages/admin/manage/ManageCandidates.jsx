import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Edit, Trash2, Save, X, Upload } from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ConfirmModal from '../../../components/ConfirmModal';
import { useAuth } from '../../../context/AuthContext';

export default function ManageCandidates() {
    const [districts, setDistricts] = useState([]);
    const [constituencies, setConstituencies] = useState([]);
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedConstituency, setSelectedConstituency] = useState('');
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editFront, setEditFront] = useState('');
    const [editQuote, setEditQuote] = useState('');
    const [editPhoto, setEditPhoto] = useState(null); // File object
    const [editSymbol, setEditSymbol] = useState(null); // File object
    const [editPhotoPreview, setEditPhotoPreview] = useState('');
    const [editSymbolPreview, setEditSymbolPreview] = useState('');

    const [deleteId, setDeleteId] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const { user } = useAuth();
    const isWardMember = user?.role === 'ward_member';

    useEffect(() => {
        fetchDistricts();
        if (isWardMember && user?.ward_id) {
            fetchUserConstituencyDetails();
        }
    }, [user]);

    async function fetchUserConstituencyDetails() {
        const { data } = await supabase
            .from('constituencies')
            .select('id, district_id')
            .eq('id', user.ward_id)
            .single();

        if (data) {
            setSelectedDistrict(data.district_id);
            setSelectedConstituency(data.id);
        }
    }

    useEffect(() => {
        if (selectedDistrict) {
            fetchConstituencies(selectedDistrict);
        } else {
            setConstituencies([]);
            setCandidates([]);
        }
    }, [selectedDistrict]);

    useEffect(() => {
        if (selectedConstituency) {
            fetchCandidates(selectedConstituency);
        } else {
            setCandidates([]);
        }
    }, [selectedConstituency]);

    async function fetchDistricts() {
        const { data } = await supabase.from('districts').select('*').order('name');
        setDistricts(data || []);
    }

    async function fetchConstituencies(districtId) {
        const { data } = await supabase.from('constituencies').select('*').eq('district_id', districtId).order('constituency_no');
        setConstituencies(data || []);
    }

    async function fetchCandidates(constituencyId) {
        setLoading(true);
        const { data } = await supabase.from('candidates').select('*').eq('constituency_id', constituencyId);
        setCandidates(data || []);
        setLoading(false);
    }

    function confirmDelete(id) {
        setDeleteId(id);
        setIsDeleteModalOpen(true);
    }

    async function handleDelete() {
        if (!deleteId) return;

        const { error } = await supabase.from('candidates').delete().eq('id', deleteId);
        if (error) {
            alert('പിശക്: ' + error.message);
        } else {
            setCandidates(candidates.filter(c => c.id !== deleteId));
        }
        setDeleteId(null);
    }

    function startEdit(candidate) {
        setEditingId(candidate.id);
        setEditName(candidate.name);
        setEditFront(candidate.front);
        setEditQuote(candidate.quote || '');
        setEditPhotoPreview(candidate.photo_url);
        setEditSymbolPreview(candidate.symbol_url);
        setEditPhoto(null);
        setEditSymbol(null);
    }

    const convertToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    };

    async function handlePhotoChange(e) {
        const file = e.target.files[0];
        if (file) {
            setEditPhoto(file);
            const base64 = await convertToBase64(file);
            setEditPhotoPreview(base64);
        }
    }

    async function handleSymbolChange(e) {
        const file = e.target.files[0];
        if (file) {
            setEditSymbol(file);
            const base64 = await convertToBase64(file);
            setEditSymbolPreview(base64);
        }
    }

    async function saveEdit(id) {
        const updates = {
            name: editName,
            front: editFront,
            quote: editQuote,
            photo_url: editPhotoPreview,
            symbol_url: editSymbolPreview
        };

        const { error } = await supabase.from('candidates').update(updates).eq('id', id);

        if (error) {
            alert('പിശക്: ' + error.message);
        } else {
            setCandidates(candidates.map(c => c.id === id ? { ...c, ...updates } : c));
            setEditingId(null);
        }
    }

    return (
        <div className="container">
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>സ്ഥാനാർത്ഥികളെ നിയന്ത്രിക്കുക</h2>

            <div className="grid grid-2" style={{ marginBottom: '2rem' }}>
                <div className="form-group">
                    <label className="label">ജില്ല തിരഞ്ഞെടുക്കുക</label>
                    <select
                        className="input"
                        value={selectedDistrict}
                        onChange={e => setSelectedDistrict(e.target.value)}
                        disabled={isWardMember}
                    >
                        <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                        {districts.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label className="label">നിയോജക മണ്ഡലം തിരഞ്ഞെടുക്കുക</label>
                    <select
                        className="input"
                        value={selectedConstituency}
                        onChange={e => setSelectedConstituency(e.target.value)}
                        disabled={!selectedDistrict || isWardMember}
                    >
                        <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                        {constituencies.map(c => (
                            <option key={c.id} value={c.id}>{c.constituency_no} - {c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {loading ? <LoadingSpinner /> : (
                <div className="grid grid-2">
                    {candidates.map((candidate) => (
                        <div key={candidate.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {editingId === candidate.id ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {/* Photo Edit */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                                            <img
                                                src={editPhotoPreview || 'https://via.placeholder.com/150'}
                                                alt="Candidate"
                                                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                            />
                                            <label htmlFor={`photo-upload-${candidate.id}`} style={{
                                                position: 'absolute', bottom: 0, right: 0,
                                                background: 'var(--primary)', color: 'white',
                                                borderRadius: '50%', padding: '4px', cursor: 'pointer'
                                            }}>
                                                <Upload size={14} />
                                            </label>
                                            <input
                                                id={`photo-upload-${candidate.id}`}
                                                type="file"
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                                onChange={handlePhotoChange}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label className="label" style={{ fontSize: '0.8rem' }}>ഫോട്ടോ മാറ്റുക</label>
                                        </div>
                                    </div>

                                    {/* Symbol Edit */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ position: 'relative', width: '50px', height: '50px' }}>
                                            <img
                                                src={editSymbolPreview || 'https://via.placeholder.com/50'}
                                                alt="Symbol"
                                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                            />
                                            <label htmlFor={`symbol-upload-${candidate.id}`} style={{
                                                position: 'absolute', bottom: -5, right: -5,
                                                background: 'var(--secondary)', color: 'white',
                                                borderRadius: '50%', padding: '4px', cursor: 'pointer'
                                            }}>
                                                <Upload size={12} />
                                            </label>
                                            <input
                                                id={`symbol-upload-${candidate.id}`}
                                                type="file"
                                                accept="image/*"
                                                style={{ display: 'none' }}
                                                onChange={handleSymbolChange}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <label className="label" style={{ fontSize: '0.8rem' }}>ചിഹ്നം മാറ്റുക</label>
                                        </div>
                                    </div>

                                    <input
                                        className="input"
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        placeholder="പേര്"
                                    />
                                    <input
                                        className="input"
                                        value={editFront}
                                        onChange={e => setEditFront(e.target.value)}
                                        placeholder="മുന്നണി"
                                    />
                                    <input
                                        className="input"
                                        value={editQuote}
                                        onChange={e => setEditQuote(e.target.value)}
                                        placeholder="വാചകം (Quote)"
                                    />

                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                        <button onClick={() => saveEdit(candidate.id)} className="btn btn-primary" style={{ flex: 1, padding: '0.5rem' }}>
                                            <Save size={18} /> സേവ്
                                        </button>
                                        <button onClick={() => setEditingId(null)} className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem' }}>
                                            <X size={18} /> റദ്ദാക്കുക
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                        <img
                                            src={candidate.photo_url || 'https://via.placeholder.com/150'}
                                            alt={candidate.name}
                                            style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
                                        />
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ fontSize: '1.2rem', fontWeight: '700' }}>{candidate.name}</h4>
                                            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>{candidate.front}</p>
                                            {candidate.quote && (
                                                <p style={{ color: 'var(--primary)', fontSize: '0.8rem', fontStyle: 'italic', marginTop: '0.25rem' }}>
                                                    "{candidate.quote}"
                                                </p>
                                            )}
                                        </div>
                                        {candidate.symbol_url && (
                                            <img
                                                src={candidate.symbol_url}
                                                alt="Symbol"
                                                style={{ width: '40px', height: '40px', objectFit: 'contain' }}
                                            />
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                        <button onClick={() => startEdit(candidate)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                                            <Edit size={20} color="var(--primary)" />
                                        </button>
                                        <button onClick={() => confirmDelete(candidate.id)} className="btn btn-secondary" style={{ padding: '0.5rem', borderColor: 'var(--danger)' }}>
                                            <Trash2 size={20} color="var(--danger)" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    {selectedConstituency && candidates.length === 0 && (
                        <div style={{ color: 'var(--text-light)' }}>സ്ഥാനാർത്ഥികളെ കണ്ടെത്തിയില്ല.</div>
                    )}
                </div>
            )}

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="സ്ഥാനാർത്ഥിയെ ഡിലീറ്റ് ചെയ്യണോ?"
                message="ഈ പ്രവൃത്തി തിരിച്ചെടുക്കാൻ കഴിയില്ല."
            />
        </div>
    );
}
