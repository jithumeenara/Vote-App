import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { sendTelegramAlert, TelegramAlerts } from '../lib/telegram';
import { Lock, Mail, Key, User } from 'lucide-react';

export default function Login() {
    const [loginType, setLoginType] = useState('ward'); // 'admin', 'ward', or 'booth'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn, wardLogin, boothLogin } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();
    const location = useLocation();

    const from = location.state?.from?.pathname || (loginType === 'booth' ? '/booth' : '/admin');

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);

        try {
            if (loginType === 'booth') {
                const user = await boothLogin(email, password);
                sendTelegramAlert(TelegramAlerts.login(email, `Booth Member (Booth ${user.booth_no} - ${user.booth_name})`));
                addToast('ലോഗിൻ വിജയിച്ചു!', 'success');
                navigate('/booth', { replace: true });
            } else if (loginType === 'ward') {
                const user = await wardLogin(email, password);
                sendTelegramAlert(TelegramAlerts.login(email, `Ward Member (Ward ${user.ward_id})`));
                addToast('ലോഗിൻ വിജയിച്ചു!', 'success');
                navigate(from, { replace: true });
            } else {
                const { error } = await signIn({ email, password });
                if (error) throw error;
                sendTelegramAlert(TelegramAlerts.login(email, 'Admin'));
                addToast('ലോഗിൻ വിജയിച്ചു!', 'success');
                navigate(from, { replace: true });
            }
        } catch (error) {
            console.error(error);
            addToast('ലോഗിൻ പരാജയപ്പെട്ടു: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{
            minHeight: '80vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        background: 'var(--primary-bg)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem auto'
                    }}>
                        <Lock color="white" size={30} />
                    </div>
                    <h2 style={{ color: 'var(--primary-bg)' }}>
                        {loginType === 'admin' ? 'അഡ്മിൻ ലോഗിൻ' : loginType === 'booth' ? 'ബൂത്ത് ലോഗിൻ' : 'നിയോജക മണ്ഡലം ലോഗിൻ'}
                    </h2>
                    <p style={{ color: 'var(--text-light)' }}>തുടരാൻ ദയവായി ലോഗിൻ ചെയ്യുക</p>
                </div>

                {/* Login Type Radio Buttons */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    {[
                        { value: 'ward', label: 'Constituency' },
                        { value: 'booth', label: 'Booth' },
                        { value: 'admin', label: 'Admin' },
                    ].map(({ value, label }) => (
                        <label key={value} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            cursor: 'pointer',
                            padding: '0.5rem 1rem',
                            borderRadius: '20px',
                            background: loginType === value ? 'var(--primary-bg)' : '#f0f0f0',
                            color: loginType === value ? 'white' : 'black',
                            transition: 'all 0.2s'
                        }}>
                            <input
                                type="radio"
                                name="loginType"
                                value={value}
                                checked={loginType === value}
                                onChange={() => setLoginType(value)}
                                style={{ display: 'none' }}
                            />
                            <span>{label}</span>
                        </label>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="label">
                            {loginType === 'admin' ? 'ഇമെയിൽ' : 'യൂസർനെയിം'}
                        </label>
                        <div style={{ position: 'relative' }}>
                            {loginType === 'admin' ? (
                                <Mail size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                            ) : (
                                <User size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                            )}
                            <input
                                type={loginType === 'admin' ? "email" : "text"}
                                className="input"
                                style={{ paddingLeft: '2.5rem' }}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder={loginType === 'admin' ? "admin@example.com" : "username"}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="label">പാസ്‌വേഡ്</label>
                        <div style={{ position: 'relative' }}>
                            <Key size={20} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }} />
                            <input
                                type="password"
                                className="input"
                                style={{ paddingLeft: '2.5rem' }}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'ലോഗിൻ ചെയ്യുന്നു...' : 'ലോഗിൻ'}
                    </button>
                </form>
            </div>
        </div>
    );
}
