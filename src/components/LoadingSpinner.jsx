import React from 'react';

export default function LoadingSpinner({ text = 'ലോഡിംഗ്...' }) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            gap: '1.5rem',
            width: '100%',
            minHeight: '80vh'
        }}>
            <div className="logo-spinner" style={{ width: '100px', height: '100px' }}></div>
            <p style={{ color: 'var(--text-light)', fontWeight: 600, fontSize: '1.25rem' }}>{text}</p>
        </div>
    );
}
