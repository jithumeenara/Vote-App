import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

export default function ConfirmModal({ isOpen, onClose, onConfirm, title, message }) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
                <button className="modal-close" onClick={onClose}>
                    <X size={24} />
                </button>

                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                    <div style={{
                        background: '#fee2e2',
                        padding: '1rem',
                        borderRadius: '50%',
                        color: '#ef4444'
                    }}>
                        <AlertTriangle size={32} />
                    </div>
                </div>

                <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary-bg)' }}>{title}</h3>
                <p style={{ color: 'var(--text-light)', marginBottom: '1.5rem' }}>
                    {message}
                </p>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button
                        onClick={onClose}
                        className="btn btn-secondary"
                        style={{ flex: 1 }}
                    >
                        റദ്ദാക്കുക
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className="btn btn-primary"
                        style={{
                            flex: 1,
                            backgroundColor: '#ef4444',
                            borderColor: '#ef4444'
                        }}
                    >
                        ഡിലീറ്റ് ചെയ്യുക
                    </button>
                </div>
            </div>
        </div>
    );
}
