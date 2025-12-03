import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';

export default function AddPanchayat() {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { addToast } = useToast();

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.from('panchayats').insert([{ name }]);
            if (error) throw error;
            addToast('പഞ്ചായത്ത് വിജയകരമായി ചേർത്തു!', 'success');
            navigate('/admin');
        } catch (error) {
            addToast('പിശക്: ' + error.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <h2 style={{ marginBottom: '2rem', color: 'var(--primary-bg)' }}>ഗ്രാമപഞ്ചായത്ത് ചേർക്കുക</h2>
            <form onSubmit={handleSubmit} className="card">
                <div className="form-group">
                    <label className="label">പഞ്ചായത്തിന്റെ പേര്</label>
                    <input
                        type="text"
                        className="input"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                        placeholder="ഉദാ: അടിമാലി"
                    />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? 'സേവ് ചെയ്യുന്നു...' : 'പഞ്ചായത്ത് സേവ് ചെയ്യുക'}
                </button>
            </form>
        </div>
    );
}
