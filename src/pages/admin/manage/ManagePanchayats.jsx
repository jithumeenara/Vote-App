import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Edit, Trash2, Save, X } from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ConfirmModal from '../../../components/ConfirmModal';

export default function ManagePanchayats() {
    const [panchayats, setPanchayats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    const [deleteId, setDeleteId] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        fetchPanchayats();
    }, []);

    async function fetchPanchayats() {
        const { data, error } = await supabase.from('panchayats').select('*').order('name');
        if (error) console.error(error);
        else setPanchayats(data || []);
        setLoading(false);
    }

    function confirmDelete(id) {
        setDeleteId(id);
        setIsDeleteModalOpen(true);
    }

    async function handleDelete() {
        if (!deleteId) return;

        const { error } = await supabase.from('panchayats').delete().eq('id', deleteId);
        if (error) {
            alert('പിശക്: ' + error.message);
        } else {
            setPanchayats(panchayats.filter(p => p.id !== deleteId));
        }
        setDeleteId(null);
    }

    function startEdit(panchayat) {
        setEditingId(panchayat.id);
        setEditName(panchayat.name);
    }

    async function saveEdit(id) {
        const { error } = await supabase.from('panchayats').update({ name: editName }).eq('id', id);
        if (error) {
            alert('പിശക്: ' + error.message);
        } else {
            setPanchayats(panchayats.map(p => p.id === id ? { ...p, name: editName } : p));
            setEditingId(null);
        }
    }

    if (loading) return <LoadingSpinner />;

    return (
        <div className="container">
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>പഞ്ചായത്തുകൾ നിയന്ത്രിക്കുക</h2>

            <div className="grid">
                {panchayats.map((panchayat) => (
                    <div key={panchayat.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {editingId === panchayat.id ? (
                            <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
                                <input
                                    className="input"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                />
                                <button onClick={() => saveEdit(panchayat.id)} className="btn btn-primary" style={{ padding: '0.5rem' }}>
                                    <Save size={20} />
                                </button>
                                <button onClick={() => setEditingId(null)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                                    <X size={20} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <span style={{ fontWeight: '700', fontSize: '1.2rem' }}>{panchayat.name}</span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => startEdit(panchayat)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                                        <Edit size={20} color="var(--primary)" />
                                    </button>
                                    <button onClick={() => confirmDelete(panchayat.id)} className="btn btn-secondary" style={{ padding: '0.5rem', borderColor: 'var(--danger)' }}>
                                        <Trash2 size={20} color="var(--danger)" />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="പഞ്ചായത്ത് ഡിലീറ്റ് ചെയ്യണോ?"
                message="ഇതിലുള്ള എല്ലാ വാർഡുകളും ബൂത്തുകളും വോട്ടർമാരും നഷ്ടപ്പെടും! ഈ പ്രവൃത്തി തിരിച്ചെടുക്കാൻ കഴിയില്ല."
            />
        </div>
    );
}
