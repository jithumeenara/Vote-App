import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Edit, Trash2, Save, X } from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ConfirmModal from '../../../components/ConfirmModal';

export default function ManageDistricts() {
    const [districts, setDistricts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    const [deleteId, setDeleteId] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        fetchDistricts();
    }, []);

    async function fetchDistricts() {
        const { data, error } = await supabase.from('districts').select('*').order('name');
        if (error) console.error(error);
        else setDistricts(data || []);
        setLoading(false);
    }

    function confirmDelete(id) {
        setDeleteId(id);
        setIsDeleteModalOpen(true);
    }

    async function handleDelete() {
        if (!deleteId) return;

        const { error } = await supabase.from('districts').delete().eq('id', deleteId);
        if (error) {
            alert('പിശക്: ' + error.message);
        } else {
            setDistricts(districts.filter(d => d.id !== deleteId));
        }
        setDeleteId(null);
    }

    function startEdit(district) {
        setEditingId(district.id);
        setEditName(district.name);
    }

    async function saveEdit(id) {
        const { error } = await supabase.from('districts').update({ name: editName }).eq('id', id);
        if (error) {
            alert('പിശക്: ' + error.message);
        } else {
            setDistricts(districts.map(d => d.id === id ? { ...d, name: editName } : d));
            setEditingId(null);
        }
    }

    if (loading) return <LoadingSpinner />;

    return (
        <div className="container">
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>ജില്ലകൾ നിയന്ത്രിക്കുക</h2>

            <div className="grid">
                {districts.map((district) => (
                    <div key={district.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        {editingId === district.id ? (
                            <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
                                <input
                                    className="input"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                />
                                <button onClick={() => saveEdit(district.id)} className="btn btn-primary" style={{ padding: '0.5rem' }}>
                                    <Save size={20} />
                                </button>
                                <button onClick={() => setEditingId(null)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                                    <X size={20} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <span style={{ fontWeight: '700', fontSize: '1.2rem' }}>{district.name}</span>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => startEdit(district)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                                        <Edit size={20} color="var(--primary)" />
                                    </button>
                                    <button onClick={() => confirmDelete(district.id)} className="btn btn-secondary" style={{ padding: '0.5rem', borderColor: 'var(--danger)' }}>
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
                title="ജില്ല ഡിലീറ്റ് ചെയ്യണോ?"
                message="ഇതിലുള്ള എല്ലാ നിയോജക മണ്ഡലങ്ങളും ബൂത്തുകളും വോട്ടർമാരും നഷ്ടപ്പെടും! ഈ പ്രവൃത്തി തിരിച്ചെടുക്കാൻ കഴിയില്ല."
            />
        </div>
    );
}
