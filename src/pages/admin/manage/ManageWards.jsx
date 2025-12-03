import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Edit, Trash2, Save, X } from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ConfirmModal from '../../../components/ConfirmModal';

export default function ManageWards() {
    const [panchayats, setPanchayats] = useState([]);
    const [selectedPanchayat, setSelectedPanchayat] = useState('');
    const [wards, setWards] = useState([]);
    const [loading, setLoading] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editWardNo, setEditWardNo] = useState('');

    const [deleteId, setDeleteId] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        fetchPanchayats();
    }, []);

    useEffect(() => {
        if (selectedPanchayat) {
            fetchWards(selectedPanchayat);
        } else {
            setWards([]);
        }
    }, [selectedPanchayat]);

    async function fetchPanchayats() {
        const { data } = await supabase.from('panchayats').select('*').order('name');
        setPanchayats(data || []);
    }

    async function fetchWards(panchayatId) {
        setLoading(true);
        const { data } = await supabase.from('wards').select('*').eq('panchayat_id', panchayatId).order('ward_no');
        setWards(data || []);
        setLoading(false);
    }

    function confirmDelete(id) {
        setDeleteId(id);
        setIsDeleteModalOpen(true);
    }

    async function handleDelete() {
        if (!deleteId) return;

        const { error } = await supabase.from('wards').delete().eq('id', deleteId);
        if (error) {
            alert('പിശക്: ' + error.message);
        } else {
            setWards(wards.filter(w => w.id !== deleteId));
        }
        setDeleteId(null);
    }

    function startEdit(ward) {
        setEditingId(ward.id);
        setEditName(ward.name);
        setEditWardNo(ward.ward_no);
    }

    async function saveEdit(id) {
        const { error } = await supabase.from('wards').update({
            name: editName,
            ward_no: parseInt(editWardNo)
        }).eq('id', id);

        if (error) {
            alert('പിശക്: ' + error.message);
        } else {
            setWards(wards.map(w => w.id === id ? { ...w, name: editName, ward_no: parseInt(editWardNo) } : w));
            setEditingId(null);
        }
    }

    return (
        <div className="container">
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>വാർഡുകൾ നിയന്ത്രിക്കുക</h2>

            <div className="form-group" style={{ maxWidth: '400px', marginBottom: '2rem' }}>
                <label className="label">പഞ്ചായത്ത് തിരഞ്ഞെടുക്കുക</label>
                <select
                    className="input"
                    value={selectedPanchayat}
                    onChange={e => setSelectedPanchayat(e.target.value)}
                >
                    <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                    {panchayats.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            {loading ? <LoadingSpinner /> : (
                <div className="grid">
                    {wards.map((ward) => (
                        <div key={ward.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            {editingId === ward.id ? (
                                <div style={{ display: 'flex', gap: '1rem', flex: 1, flexWrap: 'wrap' }}>
                                    <input
                                        className="input"
                                        type="number"
                                        style={{ width: '80px' }}
                                        value={editWardNo}
                                        onChange={e => setEditWardNo(e.target.value)}
                                    />
                                    <input
                                        className="input"
                                        style={{ flex: 1 }}
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                    />
                                    <button onClick={() => saveEdit(ward.id)} className="btn btn-primary" style={{ padding: '0.5rem' }}>
                                        <Save size={20} />
                                    </button>
                                    <button onClick={() => setEditingId(null)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                                        <X size={20} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{ background: 'var(--primary)', color: 'white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                            {ward.ward_no}
                                        </div>
                                        <span style={{ fontWeight: '700', fontSize: '1.2rem' }}>{ward.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={() => startEdit(ward)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                                            <Edit size={20} color="var(--primary)" />
                                        </button>
                                        <button onClick={() => confirmDelete(ward.id)} className="btn btn-secondary" style={{ padding: '0.5rem', borderColor: 'var(--danger)' }}>
                                            <Trash2 size={20} color="var(--danger)" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    {selectedPanchayat && wards.length === 0 && (
                        <div style={{ color: 'var(--text-light)' }}>വാർഡുകളൊന്നും കണ്ടെത്തിയില്ല.</div>
                    )}
                </div>
            )}

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="വാർഡ് ഡിലീറ്റ് ചെയ്യണോ?"
                message="ഈ വാർഡ് ഡിലീറ്റ് ചെയ്താൽ ഇതിലുള്ള എല്ലാ ബൂത്തുകളും വോട്ടർമാരും നഷ്ടപ്പെടും!"
            />
        </div>
    );
}
