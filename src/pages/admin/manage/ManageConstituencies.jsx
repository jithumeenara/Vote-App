import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Edit, Trash2, Save, X } from 'lucide-react';
import LoadingSpinner from '../../../components/LoadingSpinner';
import ConfirmModal from '../../../components/ConfirmModal';

export default function ManageConstituencies() {
    const [districts, setDistricts] = useState([]);
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [constituencies, setConstituencies] = useState([]);
    const [loading, setLoading] = useState(false);

    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editConstituencyNo, setEditConstituencyNo] = useState('');

    const [deleteId, setDeleteId] = useState(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        fetchDistricts();
    }, []);

    useEffect(() => {
        if (selectedDistrict) {
            fetchConstituencies(selectedDistrict);
        } else {
            setConstituencies([]);
        }
    }, [selectedDistrict]);

    async function fetchDistricts() {
        const { data } = await supabase.from('districts').select('*').order('name');
        setDistricts(data || []);
    }

    async function fetchConstituencies(districtId) {
        setLoading(true);
        const { data } = await supabase.from('constituencies').select('*').eq('district_id', districtId).order('constituency_no');
        setConstituencies(data || []);
        setLoading(false);
    }

    function confirmDelete(id) {
        setDeleteId(id);
        setIsDeleteModalOpen(true);
    }

    async function handleDelete() {
        if (!deleteId) return;

        const { error } = await supabase.from('constituencies').delete().eq('id', deleteId);
        if (error) {
            alert('പിശക്: ' + error.message);
        } else {
            setConstituencies(constituencies.filter(c => c.id !== deleteId));
        }
        setDeleteId(null);
    }

    function startEdit(constituency) {
        setEditingId(constituency.id);
        setEditName(constituency.name);
        setEditConstituencyNo(constituency.constituency_no);
    }

    async function saveEdit(id) {
        const { error } = await supabase.from('constituencies').update({
            name: editName,
            constituency_no: parseInt(editConstituencyNo)
        }).eq('id', id);

        if (error) {
            alert('പിശക്: ' + error.message);
        } else {
            setConstituencies(constituencies.map(c => c.id === id ? { ...c, name: editName, constituency_no: parseInt(editConstituencyNo) } : c));
            setEditingId(null);
        }
    }

    return (
        <div className="container">
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>നിയോജക മണ്ഡലങ്ങൾ നിയന്ത്രിക്കുക</h2>

            <div className="form-group" style={{ maxWidth: '400px', marginBottom: '2rem' }}>
                <label className="label">ജില്ല തിരഞ്ഞെടുക്കുക</label>
                <select
                    className="input"
                    value={selectedDistrict}
                    onChange={e => setSelectedDistrict(e.target.value)}
                >
                    <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                    {districts.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                </select>
            </div>

            {loading ? <LoadingSpinner /> : (
                <div className="grid">
                    {constituencies.map((constituency) => (
                        <div key={constituency.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            {editingId === constituency.id ? (
                                <div style={{ display: 'flex', gap: '1rem', flex: 1, flexWrap: 'wrap' }}>
                                    <input
                                        className="input"
                                        type="number"
                                        style={{ width: '80px' }}
                                        value={editConstituencyNo}
                                        onChange={e => setEditConstituencyNo(e.target.value)}
                                    />
                                    <input
                                        className="input"
                                        style={{ flex: 1 }}
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                    />
                                    <button onClick={() => saveEdit(constituency.id)} className="btn btn-primary" style={{ padding: '0.5rem' }}>
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
                                            {constituency.constituency_no}
                                        </div>
                                        <span style={{ fontWeight: '700', fontSize: '1.2rem' }}>{constituency.name}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={() => startEdit(constituency)} className="btn btn-secondary" style={{ padding: '0.5rem' }}>
                                            <Edit size={20} color="var(--primary)" />
                                        </button>
                                        <button onClick={() => confirmDelete(constituency.id)} className="btn btn-secondary" style={{ padding: '0.5rem', borderColor: 'var(--danger)' }}>
                                            <Trash2 size={20} color="var(--danger)" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                    {selectedDistrict && constituencies.length === 0 && (
                        <div style={{ color: 'var(--text-light)' }}>നിയോജക മണ്ഡലങ്ങളൊന്നും കണ്ടെത്തിയില്ല.</div>
                    )}
                </div>
            )}

            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDelete}
                title="നിയോജക മണ്ഡലം ഡിലീറ്റ് ചെയ്യണോ?"
                message="ഈ നിയോജക മണ്ഡലം ഡിലീറ്റ് ചെയ്താൽ ഇതിലുള്ള എല്ലാ ബൂത്തുകളും വോട്ടർമാരും നഷ്ടപ്പെടും!"
            />
        </div>
    );
}
