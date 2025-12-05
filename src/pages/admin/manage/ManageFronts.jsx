import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Edit, Trash2, Plus, Save, X } from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { useToast } from '../../../context/ToastContext';
import ConfirmModal from '../../../components/ConfirmModal';

export default function ManageFronts() {
    const { addToast } = useToast();
    const [fronts, setFronts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newFront, setNewFront] = useState('');
    const [newColor, setNewColor] = useState('#666666');
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('#666666');
    const [deleteId, setDeleteId] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        fetchFronts();
    }, []);

    async function fetchFronts() {
        try {
            const { data, error } = await supabase.from('fronts').select('*').order('name');
            if (error) throw error;
            setFronts(data || []);
        } catch (error) {
            console.error('Error fetching fronts:', error);
            addToast('Error fetching fronts', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function handleAdd() {
        if (!newFront.trim()) return;
        try {
            const { data, error } = await supabase.from('fronts').insert([{ name: newFront.trim(), color: newColor }]).select();
            if (error) throw error;
            setFronts([...fronts, data[0]]);
            setNewFront('');
            setNewColor('#666666');
            addToast('Front added successfully', 'success');
        } catch (error) {
            console.error('Error adding front:', error);
            addToast('Error adding front: ' + error.message, 'error');
        }
    }

    async function handleUpdate(id) {
        if (!editName.trim()) return;
        try {
            const { error } = await supabase.from('fronts').update({ name: editName.trim(), color: editColor }).eq('id', id);
            if (error) throw error;
            setFronts(fronts.map(f => f.id === id ? { ...f, name: editName.trim(), color: editColor } : f));
            setEditingId(null);
            addToast('Front updated successfully', 'success');
        } catch (error) {
            console.error('Error updating front:', error);
            addToast('Error updating front: ' + error.message, 'error');
        }
    }

    async function handleDelete() {
        if (!deleteId) return;
        try {
            const { error } = await supabase.from('fronts').delete().eq('id', deleteId);
            if (error) throw error;
            setFronts(fronts.filter(f => f.id !== deleteId));
            setIsDeleteModalOpen(false);
            addToast('Front deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting front:', error);
            addToast('Error deleting front: ' + error.message, 'error');
        }
    }

    if (loading) return <LoadingSpinner />;

    return (
        <div className="container">
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>മുന്നണികൾ നിയന്ത്രിക്കുക (Manage Fronts)</h2>

            <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input
                    type="text"
                    className="input"
                    placeholder="പുതിയ മുന്നണി പേര് (Eg: LDF)"
                    value={newFront}
                    onChange={(e) => setNewFront(e.target.value)}
                    style={{ flex: 1 }}
                />
                <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    style={{ height: '45px', width: '60px', padding: '0', border: 'none', background: 'none', cursor: 'pointer' }}
                    title="Choose Color"
                />
                <button className="btn btn-primary" onClick={handleAdd}>
                    <Plus size={20} /> ചേർക്കുക
                </button>
            </div>

            <div className="grid">
                {fronts.map((front) => (
                    <div key={front.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {editingId === front.id ? (
                            <div style={{ display: 'flex', gap: '1rem', flex: 1, alignItems: 'center' }}>
                                <input
                                    className="input"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    style={{ flex: 1 }}
                                />
                                <input
                                    type="color"
                                    value={editColor}
                                    onChange={(e) => setEditColor(e.target.value)}
                                    style={{ height: '40px', width: '50px', padding: '0', border: 'none', background: 'none', cursor: 'pointer' }}
                                />
                                <button className="btn btn-primary" onClick={() => handleUpdate(front.id)}><Save size={20} /></button>
                                <button className="btn btn-secondary" onClick={() => setEditingId(null)}><X size={20} /></button>
                            </div>
                        ) : (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: front.color || '#666' }}></div>
                                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{front.name}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn btn-secondary" onClick={() => { setEditingId(front.id); setEditName(front.name); setEditColor(front.color || '#666666'); }}>
                                        <Edit size={18} />
                                    </button>
                                    <button className="btn btn-secondary" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => { setDeleteId(front.id); setIsDeleteModalOpen(true); }}>
                                        <Trash2 size={18} />
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
                title="മുന്നണി നീക്കം ചെയ്യണോ?"
                message="ഈ പ്രവൃത്തി തിരിച്ചെടുക്കാൻ കഴിയില്ല."
            />
        </div>
    );
}
