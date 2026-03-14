import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { Plus, Trash2, User, Save, X, Edit, Power } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

export default function ManageWardMembers() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { addToast } = useToast();

    // Form State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedConstituency, setSelectedConstituency] = useState('');
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Dropdown Data
    const [districts, setDistricts] = useState([]);
    const [constituencies, setConstituencies] = useState([]);

    useEffect(() => {
        fetchMembers();
        fetchDistricts();
    }, []);

    useEffect(() => {
        if (selectedDistrict) {
            fetchConstituencies(selectedDistrict);
        } else {
            setConstituencies([]);
        }
    }, [selectedDistrict]);

    async function fetchMembers() {
        try {
            const { data, error } = await supabase
                .from('ward_users')
                .select(`
                    *,
                    constituencies (
                        id,
                        name,
                        constituency_no,
                        district_id,
                        districts (
                            id,
                            name
                        )
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setMembers(data || []);
        } catch (error) {
            console.error('Error fetching members:', error);
            addToast('യൂസർമാരെ ലോഡ് ചെയ്യുന്നതിൽ പരാജയപ്പെട്ടു', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function fetchDistricts() {
        const { data } = await supabase.from('districts').select('*').order('name');
        setDistricts(data || []);
    }

    async function fetchConstituencies(districtId) {
        const { data } = await supabase.from('constituencies').select('*').eq('district_id', districtId).order('constituency_no');
        setConstituencies(data || []);
    }

    function openCreateModal() {
        setEditingId(null);
        resetForm();
        setIsModalOpen(true);
    }

    function openEditModal(member) {
        setEditingId(member.id);
        setUsername(member.username);
        setPassword('');

        if (member.ward_id) {
            setSelectedDistrict(member.panchayat_id);
            setSelectedConstituency(member.ward_id);
        }

        setIsModalOpen(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setCreating(true);

        try {
            if (editingId) {
                // Update Existing Member
                const { error: updateError } = await supabase
                    .from('ward_users')
                    .update({
                        ward_id: selectedConstituency,
                        panchayat_id: selectedDistrict
                    })
                    .eq('id', editingId);

                if (updateError) throw updateError;

                if (password) {
                    const { error: pwError } = await supabase.rpc('update_ward_user_password', {
                        user_id_input: editingId,
                        new_password: password
                    });
                    if (pwError) throw pwError;
                }

                addToast('യൂസർ വിവരങ്ങൾ പുതുക്കി!', 'success');
            } else {
                // Create New Member
                const { data, error } = await supabase.rpc('create_custom_ward_user', {
                    username_input: username,
                    password_input: password,
                    panchayat_id_input: selectedDistrict,
                    ward_id_input: selectedConstituency
                });

                if (error) throw error;
                addToast('നിയോജക മണ്ഡലം യൂസറെ വിജയകരമായി ചേർത്തു!', 'success');
            }

            setIsModalOpen(false);
            resetForm();
            fetchMembers();

        } catch (error) {
            console.error('Error saving member:', error);
            addToast('പരാജയപ്പെട്ടു: ' + error.message, 'error');
        } finally {
            setCreating(false);
        }
    }

    async function handleToggleStatus(member) {
        try {
            const newStatus = !member.is_active;
            const { error } = await supabase
                .from('ward_users')
                .update({ is_active: newStatus })
                .eq('id', member.id);

            if (error) throw error;

            addToast(`യൂസർ ${newStatus ? 'സജീവമാക്കി' : 'നിർജ്ജീവമാക്കി'}`, 'success');

            setMembers(members.map(m =>
                m.id === member.id ? { ...m, is_active: newStatus } : m
            ));
        } catch (error) {
            console.error('Error updating status:', error);
            addToast('സ്റ്റാറ്റസ് മാറ്റുന്നതിൽ പരാജയപ്പെട്ടു', 'error');
        }
    }

    async function handleDeleteMember(id) {
        if (!window.confirm('ഈ യൂസറെ നീക്കം ചെയ്യുമെന്ന് ഉറപ്പാണോ?')) return;

        try {
            const { error } = await supabase.from('ward_users').delete().eq('id', id);
            if (error) throw error;

            addToast('യൂസറെ നീക്കം ചെയ്തു', 'success');
            fetchMembers();
        } catch (error) {
            console.error('Error deleting member:', error);
            addToast('നീക്കം ചെയ്യുന്നതിൽ പരാജയപ്പെട്ടു', 'error');
        }
    }

    function resetForm() {
        setUsername('');
        setPassword('');
        setSelectedDistrict('');
        setSelectedConstituency('');
    }

    if (loading) return <LoadingSpinner />;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ color: 'var(--primary-bg)', margin: 0 }}>നിയോജക മണ്ഡലം യൂസർമാരെ നിയന്ത്രിക്കുക</h2>
                <button
                    className="btn btn-primary"
                    onClick={openCreateModal}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <Plus size={20} />
                    പുതിയ യൂസർ ചേർക്കുക
                </button>
            </div>

            <div className="grid grid-3">
                {members.map(member => (
                    <div key={member.id} className="card" style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                background: member.is_active === false ? '#f1f5f9' : '#e0e7ff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: member.is_active === false ? 'var(--text-light)' : 'var(--primary)'
                            }}>
                                <User size={24} />
                            </div>
                            <div>
                                <h4 style={{ margin: '0 0 0.25rem 0', color: member.is_active === false ? 'var(--text-light)' : 'inherit' }}>
                                    {member.username}
                                    {member.is_active === false && <span style={{ fontSize: '0.7rem', background: '#fee2e2', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>Disabled</span>}
                                </h4>
                                <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.9rem' }}>
                                    {member.constituencies?.districts?.name}
                                </p>
                                <p style={{ margin: 0, color: 'var(--primary)', fontWeight: '600', fontSize: '0.9rem' }}>
                                    നിയോജക മണ്ഡലം: {member.constituencies?.constituency_no} - {member.constituencies?.name}
                                </p>
                            </div>
                        </div>

                        <div style={{ borderTop: '1px solid #eee', paddingTop: '1rem', marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                                className="btn btn-icon"
                                style={{
                                    color: member.is_active !== false ? 'var(--success)' : 'var(--text-light)',
                                    background: member.is_active !== false ? '#dcfce7' : '#f1f5f9'
                                }}
                                onClick={() => handleToggleStatus(member)}
                                title={member.is_active !== false ? "നിർജ്ജീവമാക്കുക" : "സജീവമാക്കുക"}
                            >
                                <Power size={18} />
                            </button>
                            <button
                                className="btn btn-icon"
                                style={{ color: 'var(--primary)' }}
                                onClick={() => openEditModal(member)}
                                title="എഡിറ്റ് ചെയ്യുക"
                            >
                                <Edit size={18} />
                            </button>
                            <button
                                className="btn btn-icon"
                                style={{ color: 'var(--danger)' }}
                                onClick={() => handleDeleteMember(member.id)}
                                title="നീക്കം ചെയ്യുക"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {members.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-light)' }}>
                    യൂസർമാരെയൊന്നും ചേർത്തിട്ടില്ല.
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <h3>{editingId ? 'യൂസറെ എഡിറ്റ് ചെയ്യുക' : 'പുതിയ നിയോജക മണ്ഡലം യൂസർ'}</h3>
                            <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="label">യൂസർനെയിം</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    required
                                    placeholder="ഉദാ: constituency1_user"
                                    disabled={!!editingId}
                                />
                                {!editingId && <small style={{ color: '#666' }}>ലോഗിൻ ചെയ്യാൻ ഈ യൂസർനെയിം ഉപയോഗിക്കാം</small>}
                            </div>

                            <div className="form-group">
                                <label className="label">{editingId ? 'പുതിയ പാസ്‌വേഡ് (ആവശ്യമെങ്കിൽ)' : 'പാസ്‌വേഡ്'}</label>
                                <input
                                    type="password"
                                    className="input"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required={!editingId}
                                    minLength={6}
                                    placeholder={editingId ? "മാറ്റമില്ലെങ്കിൽ ഒഴിച്ചിടുക" : ""}
                                />
                            </div>

                            <div className="form-group">
                                <label className="label">ജില്ല</label>
                                <select
                                    className="input"
                                    value={selectedDistrict}
                                    onChange={e => setSelectedDistrict(e.target.value)}
                                    required
                                >
                                    <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                                    {districts.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="label">നിയോജക മണ്ഡലം</label>
                                <select
                                    className="input"
                                    value={selectedConstituency}
                                    onChange={e => setSelectedConstituency(e.target.value)}
                                    required
                                    disabled={!selectedDistrict}
                                >
                                    <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                                    {constituencies.map(c => (
                                        <option key={c.id} value={c.id}>{c.constituency_no} - {c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                                    റദ്ദാക്കുക
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={creating}>
                                    {creating ? 'സേവ് ചെയ്യുന്നു...' : 'സേവ് ചെയ്യുക'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
