import React from 'react';
import { Link } from 'react-router-dom';
import { Search, Database } from 'lucide-react';

export default function Home() {
    return (
        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                <img src="/logo.png" alt="Logo" style={{ width: '120px', height: '120px', maxWidth: '100%', borderRadius: '50%', border: '5px solid var(--primary)' }} />
            </div>
            <h1 style={{ marginBottom: '1rem', color: 'var(--primary-bg)', fontWeight: '800' }}>
                എന്റെ വോട്ട്
            </h1>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-light)', marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem', padding: '0 1rem' }}>
                വോട്ടർ പട്ടികയിൽ നിങ്ങളുടെ പേര് തിരയുക, സ്ഥാനാർത്ഥികളെ കാണുക, ബൂത്ത് വിവരങ്ങൾ അറിയുക.
            </p>

            <div className="grid grid-2" style={{ maxWidth: '800px', margin: '0 auto' }}>
                <Link to="/panchayats" className="card" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: '#fdf2f4', padding: '1.5rem', borderRadius: '50%', color: 'var(--primary)' }}>
                        <Search size={48} />
                    </div>
                    <h2>വോട്ടർ പട്ടിക തിരയുക</h2>
                    <p style={{ color: 'var(--text-light)' }}>പഞ്ചായത്ത്, വാർഡ്, ബൂത്ത് എന്നിവ വഴി തിരയുക</p>
                    <span className="btn btn-primary" style={{ width: '100%' }}>തിരയുക</span>
                </Link>

                <Link to="/admin" className="card" style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ background: '#f0fdf4', padding: '1.5rem', borderRadius: '50%', color: 'var(--success)' }}>
                        <Database size={48} />
                    </div>
                    <h2>അഡ്മിൻ പോർട്ടൽ</h2>
                    <p style={{ color: 'var(--text-light)' }}>പഞ്ചായത്ത്, വാർഡ്, ബൂത്ത്, വോട്ടർ വിവരങ്ങൾ ചേർക്കുക</p>
                    <span className="btn btn-secondary" style={{ width: '100%' }}>ലോഗിൻ ചെയ്യുക</span>
                </Link>
            </div>
        </div>
    );
}
