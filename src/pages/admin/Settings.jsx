import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Key, Bot, CheckCircle, AlertCircle, Loader, Send } from 'lucide-react';
import { validateApiKey } from '../../lib/ai';
import { sendTelegramAlert } from '../../lib/telegram';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function Settings() {
    const [apiKey, setApiKey] = useState('');
    const [telegramToken, setTelegramToken] = useState('');
    const [telegramChatId, setTelegramChatId] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [keyStatus, setKeyStatus] = useState('unknown'); // 'unknown', 'checking', 'valid', 'invalid'
    const [keyError, setKeyError] = useState(null);
    const { addToast } = useToast();

    useEffect(() => {
        fetchSettings();
    }, []);

    async function fetchSettings() {
        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('key, value')
                .in('key', ['openai_api_key', 'telegram_bot_token', 'telegram_chat_id']);

            if (error && error.code !== 'PGRST116') throw error;
            if (data) {
                const settings = data.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
                setApiKey(settings.openai_api_key || '');
                setTelegramToken(settings.telegram_bot_token || '');
                setTelegramChatId(settings.telegram_chat_id || '');

                checkKeyValidity(settings.openai_api_key);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
            // Don't show error toast on 404 (just means not set yet)
        } finally {
            setLoading(false);
        }
    }

    async function checkKeyValidity(key) {
        if (!key) {
            setKeyStatus('unknown');
            setKeyError(null);
            return;
        }
        setKeyStatus('checking');
        setKeyError(null);
        const { isValid, error } = await validateApiKey(key);
        setKeyStatus(isValid ? 'valid' : 'invalid');
        if (!isValid) setKeyError(error);
    }

    async function handleSave(e) {
        e.preventDefault();
        setSaving(true);

        try {
            const { error } = await supabase
                .from('system_settings')
                .upsert({
                    key: 'openai_api_key',
                    value: apiKey,
                    description: 'API Key for OpenAI (ChatGPT)',
                    updated_at: new Date()
                });

            await supabase.from('system_settings').upsert({
                key: 'telegram_bot_token',
                value: telegramToken,
                description: 'Telegram Bot Token',
                updated_at: new Date()
            });

            await supabase.from('system_settings').upsert({
                key: 'telegram_chat_id',
                value: telegramChatId,
                description: 'Telegram Chat ID',
                updated_at: new Date()
            });

            if (error) throw error;
            addToast('ക്രമീകരണങ്ങൾ സേവ് ചെയ്തു!', 'success');
            checkKeyValidity(apiKey);
        } catch (error) {
            console.error('Error saving settings:', error);
            addToast('പരാജയപ്പെട്ടു: ' + error.message, 'error');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <LoadingSpinner />;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white'
                }}>
                    <Bot size={28} />
                </div>
                <div>
                    <h2 style={{ margin: 0, color: 'var(--primary-bg)' }}>AI ക്രമീകരണങ്ങൾ</h2>
                    <p style={{ margin: 0, color: 'var(--text-light)' }}>ആപ്ലിക്കേഷനിലെ AI സേവനങ്ങൾ നിയന്ത്രിക്കുക</p>
                </div>
            </div>

            <div className="card">
                <form onSubmit={handleSave}>
                    <div className="form-group">
                        <label className="label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Key size={16} />
                                OpenAI API Key
                            </div>
                            {keyStatus !== 'unknown' && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    fontSize: '0.85rem',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    background: keyStatus === 'valid' ? '#dcfce7' : keyStatus === 'checking' ? '#f3f4f6' : '#fee2e2',
                                    color: keyStatus === 'valid' ? '#166534' : keyStatus === 'checking' ? '#4b5563' : '#991b1b'
                                }} title={keyError || ''}>
                                    {keyStatus === 'checking' && <Loader size={14} className="spin" />}
                                    {keyStatus === 'valid' && <CheckCircle size={14} />}
                                    {keyStatus === 'invalid' && <AlertCircle size={14} />}
                                    <span>
                                        {keyStatus === 'checking' ? 'പരിശോധിക്കുന്നു...' :
                                            keyStatus === 'valid' ? 'Valid' : 'Invalid'}
                                    </span>
                                </div>
                            )}
                        </label>
                        {keyStatus === 'invalid' && keyError && (
                            <div style={{
                                fontSize: '0.8rem',
                                color: '#dc2626',
                                marginBottom: '0.5rem',
                                background: '#fef2f2',
                                padding: '0.5rem',
                                borderRadius: '6px',
                                border: '1px solid #fecaca'
                            }}>
                                Error: {keyError}
                            </div>
                        )}
                        <input
                            type="password"
                            className="input"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="AI_zaSy..."
                            style={{ fontFamily: 'monospace' }}
                        />
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '0.5rem' }}>
                            മംഗ്ലീഷ് സെർച്ചിനും മറ്റ് AI സേവനങ്ങൾക്കും ഈ കീ ആവശ്യമാണ്.
                            <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', marginLeft: '4px' }}>
                                കീ ഇവിടെ ലഭിക്കും
                            </a>
                        </p>
                    </div>

                    <hr style={{ margin: '2rem 0', border: 'none', borderTop: '1px solid #eee' }} />

                    {/* Telegram Settings */}
                    <div className="form-group">
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#1f2937' }}>Telegram Alerts</h3>

                        <label className="label">Bot Token</label>
                        <input
                            type="password"
                            className="input"
                            value={telegramToken}
                            onChange={(e) => setTelegramToken(e.target.value)}
                            placeholder="123456789:ABCdef..."
                            style={{ fontFamily: 'monospace', marginBottom: '1rem' }}
                        />

                        <label className="label">Chat ID</label>
                        <input
                            type="text"
                            className="input"
                            value={telegramChatId}
                            onChange={(e) => setTelegramChatId(e.target.value)}
                            placeholder="-1001234567890"
                            style={{ fontFamily: 'monospace' }}
                        />
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-light)', marginTop: '0.5rem' }}>
                            ലോഗിൻ, വോട്ടിംഗ് അലേർട്ടുകൾ ടെലഗ്രാമിൽ ലഭിക്കാൻ ഇത് കോൺഫിഗർ ചെയ്യുക.
                        </p>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={async () => {
                                if (!telegramToken || !telegramChatId) {
                                    addToast('Please save Telegram details first', 'error');
                                    return;
                                }
                                addToast('Sending test message...', 'info');
                                await sendTelegramAlert('🔔 <b>Test Alert</b>\nThis is a test message from My Vote App.');
                                addToast('Test message sent!', 'success');
                            }}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Send size={18} />
                            Test Alert
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={saving}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <Save size={18} />
                            {saving ? 'സേവ് ചെയ്യുന്നു...' : 'സേവ് ചെയ്യുക'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
