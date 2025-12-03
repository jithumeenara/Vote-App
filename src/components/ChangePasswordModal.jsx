import React, { useState } from 'react';
import { X, Key } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export default function ChangePasswordModal({ isOpen, onClose }) {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();
    const { user, signIn } = useAuth();

    if (!isOpen) return null;

    async function handleSubmit(e) {
        e.preventDefault();

        if (newPassword.length < 6) {
            addToast('പുതിയ പാസ്‌വേഡിൽ കുറഞ്ഞത് 6 അക്ഷരങ്ങൾ ഉണ്ടായിരിക്കണം', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            addToast('പാസ്‌വേഡുകൾ പൊരുത്തപ്പെടുന്നില്ല', 'error');
            return;
        }

        setLoading(true);

        try {
            if (user?.role === 'ward_member') {
                // Custom Ward User Password Change
                const { data, error } = await supabase.rpc('change_own_password', {
                    user_id_input: user.id,
                    current_password: oldPassword,
                    new_password: newPassword
                });

                if (error) throw new Error(error.message);
                if (!data) throw new Error('പാസ്‌വേഡ് മാറ്റുന്നതിൽ പരാജയപ്പെട്ടു');

            } else {
                // Admin (Supabase Auth) Password Change
                // 1. Verify old password by re-authenticating
                const { error: signInError } = await signIn({
                    email: user.email,
                    password: oldPassword
                });

                if (signInError) {
                    throw new Error('പഴയ പാസ്‌വേഡ് തെറ്റാണ്');
                }

                // 2. Update password
                const { error: updateError } = await supabase.auth.updateUser({
                    password: newPassword
                });

                if (updateError) throw updateError;
            }

            addToast('പാസ്‌വേഡ് വിജയകരമായി മാറ്റി!', 'success');
            onClose();
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            addToast(error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-light)'
                    }}
                >
                    <X size={24} />
                </button>

                <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-bg)' }}>
                    <Key size={24} /> പാസ്‌വേഡ് മാറ്റുക
                </h2>

                {user?.role === 'ward_member' && (
                    <div style={{ marginBottom: '1rem', padding: '0.5rem', background: '#f0f9ff', borderRadius: '4px', color: 'var(--primary)' }}>
                        <strong>യൂസർനെയിം:</strong> {user.username}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="label">പഴയ പാസ്‌വേഡ്</label>
                        <input
                            type="password"
                            className="input"
                            value={oldPassword}
                            onChange={e => setOldPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">പുതിയ പാസ്‌വേഡ് (min 6 chars)</label>
                        <input
                            type="password"
                            className="input"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    <div className="form-group">
                        <label className="label">പാസ്‌വേഡ് സ്ഥിരീകരിക്കുക</label>
                        <input
                            type="password"
                            className="input"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'മാറ്റുന്നു...' : 'പാസ്‌വേഡ് മാറ്റുക'}
                    </button>
                </form>
            </div>
        </div>
    );
}
