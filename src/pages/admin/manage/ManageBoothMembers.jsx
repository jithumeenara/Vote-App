import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { Plus, Trash2, User, Save, X, Edit, Power } from 'lucide-react';
import { useToast } from '../../../context/ToastContext';

export default function ManageBoothMembers() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { addToast } = useToast();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [selectedConstituency, setSelectedConstituency] = useState('');
    const [selectedBooth, setSelectedBooth] = useState('');
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [districts, setDistricts] = useState([]);
    const [constituencies, setConstituencies] = useState([]);
    const [booths, setBooths] = useState([]);

    useEffect(() => {
        fetchMembers();
        fetchDistricts();
    }, []);

    useEffect(() => {
        if (selectedDistrict) fetchConstituencies(selectedDistrict);
        else setConstituencies([]);
    }, [selectedDistrict]);

    useEffect(() => {
        if (selectedConstituency) fetchBooths(selectedConstituency);
        else setBooths([]);
    }, [selectedConstituency]);

    async function fetchMembers() {
        try {
            const { data, error } = await supabase
                .from('booth_users')
                .select(`
                    *,
                    booths (
                        id, booth_no, name,
                        constituencies (
                            id, name, constituency_no,
                            districts ( id, name )
                        )
                    )
                `)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setMembers(data || []);
        } catch (err) {
            addToast('ലോഡ് ചെയ്യുന്നതിൽ പരാജയം: ' + err.message, 'error');
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

    async function fetchBooths(constituencyId) {
        const { data } = await supabase.from('booths').select('*').eq('constituency_id', constituencyId).order('booth_no');
        setBooths(data || []);
    }

    function resetForm() {
        setUsername(''); setPassword('');
        setSelectedDistrict(''); setSelectedConstituency(''); setSelectedBooth('');
        setEditingId(null);
    }

    function openCreateModal() {
        resetForm();
        setIsModalOpen(true);
    }

    function openEditModal(member) {
        setEditingId(member.id);
        setUsername(member.username);
        setPassword('');
        const booth = member.booths;
        if (booth) {
            const constituency = booth.constituencies;
            if (constituency) {
                setSelectedDistrict(constituency.districts?.id || '');
                setSelectedConstituency(constituency.id);
            }
            setSelectedBooth(booth.id);
        }
        setIsModalOpen(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (!selectedBooth) { addToast('ബൂത്ത് തിരഞ്ഞെടുക്കുക', 'error'); return; }
        setCreating(true);
        try {
            if (editingId) {
                const { error } = await supabase.from('booth_users').update({ booth_id: selectedBooth }).eq('id', editingId);
                if (error) throw error;
                if (password) {
                    const { error: pwErr } = await supabase.rpc('update_booth_user_password', { user_id_input: editingId, new_password: password });
                    if (pwErr) throw pwErr;
                }
                addToast('യൂസർ വിവരങ്ങൾ പുതുക്കി!', 'success');
            } else {
                const { error } = await supabase.rpc('create_booth_user', {
                    username_input: username,
                    password_input: password,
                    booth_id_input: selectedBooth
                });
                if (error) throw error;
                addToast('ബൂത്ത് യൂസറെ ചേർത്തു!', 'success');
            }
            setIsModalOpen(false);
            resetForm();
            fetchMembers();
        } catch (err) {
            addToast('പരാജയം: ' + err.message, 'error');
        } finally {
            setCreating(false);
        }
    }

    async function handleToggleStatus(member) {
        try {
            const { error } = await supabase.from('booth_users').update({ is_active: !member.is_active }).eq('id', member.id);
            if (error) throw error;
            addToast(`യൂസർ ${!member.is_active ? 'സജീവമാക്കി' : 'നിർജ്ജീവമാക്കി'}`, 'success');
            setMembers(members.map(m => m.id === member.id ? { ...m, is_active: !m.is_active } : m));
        } catch (err) {
            addToast('പരാജയം: ' + err.message, 'error');
        }
    }

    async function handleDelete(id) {
        if (!window.confirm('ഈ ബൂത്ത് യൂസറെ ഡിലീറ്റ് ചെയ്യണോ?')) return;
        try {
            const { error } = await supabase.from('booth_users').delete().eq('id', id);
            if (error) throw error;
            addToast('ഡിലീറ്റ് ചെയ്തു', 'success');
            setMembers(members.filter(m => m.id !== id));
        } catch (err) {
            addToast('ഡിലീറ്റ് പരാജയം: ' + err.message, 'error');
        }
    }

    if (loading) return <LoadingSpinner />;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ color: 'var(--primary-bg)', margin: 0 }}>ബൂത്ത് മെമ്പർമാർ</h2>
                <button onClick={openCreateModal} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Plus size={18} /> പുതിയ ബൂത്ത് യൂസർ
                </button>
            </div>

            {members.length === 0 ? (
                <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                    <User size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <p>ഇതുവരെ ബൂത്ത് യൂസർമാർ ഇല്ല</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {members.map(member => {
                        const booth = member.booths;
                        const con = booth?.constituencies;
                        const dist = con?.districts;
                        return (
                            <div key={member.id} className="card" style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', opacity: member.is_active ? 1 : 0.6 }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                        <User size={16} color="var(--primary)" />
                                        <strong style={{ fontSize: '1.05rem' }}>{member.username}</strong>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600',
                                            background: member.is_active ? '#dcfce7' : '#fee2e2',
                                            color: member.is_active ? '#166534' : '#991b1b'
                                        }}>
                                            {member.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                                        {dist?.name} &gt; {con?.constituency_no} - {con?.name} &gt; <strong>{booth?.booth_no} - {booth?.name}</strong>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button onClick={() => openEditModal(member)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer' }} title="Edit">
                                        <Edit size={16} color="#374151" />
                                    </button>
                                    <button onClick={() => handleToggleStatus(member)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: member.is_active ? '#fee2e2' : '#dcfce7', cursor: 'pointer' }} title={member.is_active ? 'Deactivate' : 'Activate'}>
                                        <Power size={16} color={member.is_active ? '#991b1b' : '#166534'} />
                                    </button>
                                    <button onClick={() => handleDelete(member.id)} style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fee2e2', cursor: 'pointer' }} title="Delete">
                                        <Trash2 size={16} color="#991b1b" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000, padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, color: 'var(--primary-bg)' }}>{editingId ? 'ബൂത്ത് യൂസർ എഡിറ്റ്' : 'പുതിയ ബൂത്ത് യൂസർ'}</h3>
                            <button onClick={() => { setIsModalOpen(false); resetForm(); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="label">യൂസർനെയിം</label>
                                <input className="input" value={username} onChange={e => setUsername(e.target.value)} required={!editingId} disabled={!!editingId} placeholder="booth_user_01" />
                            </div>
                            <div className="form-group">
                                <label className="label">പാസ്‌വേഡ് {editingId && <span style={{ color: '#9ca3af', fontWeight: 'normal' }}>(ഒഴിവാക്കിയാൽ മാറില്ല)</span>}</label>
                                <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required={!editingId} placeholder="••••••••" />
                            </div>
                            <div className="form-group">
                                <label className="label">ജില്ല</label>
                                <select className="input" value={selectedDistrict} onChange={e => { setSelectedDistrict(e.target.value); setSelectedConstituency(''); setSelectedBooth(''); }} required>
                                    <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                                    {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="label">നിയോജക മണ്ഡലം</label>
                                <select className="input" value={selectedConstituency} onChange={e => { setSelectedConstituency(e.target.value); setSelectedBooth(''); }} required disabled={!selectedDistrict}>
                                    <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                                    {constituencies.map(c => <option key={c.id} value={c.id}>{c.constituency_no} - {c.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="label">ബൂത്ത്</label>
                                <select className="input" value={selectedBooth} onChange={e => setSelectedBooth(e.target.value)} required disabled={!selectedConstituency}>
                                    <option value="">-- തിരഞ്ഞെടുക്കുക --</option>
                                    {booths.map(b => <option key={b.id} value={b.id}>{b.booth_no} - {b.name}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="button" onClick={() => { setIsModalOpen(false); resetForm(); }} className="btn" style={{ flex: 1 }}>റദ്ദാക്കുക</button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} disabled={creating}>
                                    <Save size={16} />
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
