import React from 'react';

/**
 * Full-featured pagination component.
 * Props:
 *   currentPage      - 1-based current page
 *   totalPages       - total number of pages
 *   totalItems       - total record count (for "X–Y / Z" display)
 *   pageSize         - current items per page
 *   onPageChange     - (newPage: number) => void
 *   onPageSizeChange - (newSize: number) => void  (optional — hides dropdown if omitted)
 */
export default function Pagination({ currentPage, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange }) {
    if (!totalPages || totalPages <= 0) return null;

    // Build visible page number list: 1 … [prev2] [prev1] [cur] [next1] [next2] … last
    const getPages = () => {
        const delta = 2;
        const pages = [];
        const left = Math.max(2, currentPage - delta);
        const right = Math.min(totalPages - 1, currentPage + delta);

        pages.push(1);
        if (left > 2) pages.push('left-ellipsis');
        for (let i = left; i <= right; i++) pages.push(i);
        if (right < totalPages - 1) pages.push('right-ellipsis');
        if (totalPages > 1) pages.push(totalPages);

        return pages;
    };

    const pages = getPages();
    const from = Math.min((currentPage - 1) * pageSize + 1, totalItems || 1);
    const to = Math.min(currentPage * pageSize, totalItems || 0);

    const navBtn = (label, onClick, disabled) => (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: '0.4rem 0.6rem',
                minWidth: '34px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: disabled ? '#e5e7eb' : 'var(--primary)',
                background: disabled ? '#f5f5f5' : 'white',
                color: disabled ? '#c0c0c0' : 'var(--primary)',
                fontWeight: '600',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                lineHeight: 1,
                transition: 'background 0.15s',
            }}
        >
            {label}
        </button>
    );

    const pageBtn = (p) => {
        const isActive = p === currentPage;
        return (
            <button
                key={p}
                onClick={() => onPageChange(p)}
                style={{
                    padding: '0.4rem 0.6rem',
                    minWidth: '34px',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--primary)' : '#e5e7eb',
                    background: isActive ? 'var(--primary)' : 'white',
                    color: isActive ? 'white' : '#333',
                    fontWeight: isActive ? '700' : '500',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    lineHeight: 1,
                    transition: 'all 0.15s',
                }}
            >
                {p}
            </button>
        );
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '1.25rem 0.5rem',
            flexWrap: 'wrap',
        }}>
            {/* First / Prev */}
            {navBtn('«', () => onPageChange(1), currentPage === 1)}
            {navBtn('‹', () => onPageChange(currentPage - 1), currentPage === 1)}

            {/* Page numbers */}
            {pages.map((p, i) =>
                typeof p === 'string' ? (
                    <span key={p} style={{ padding: '0.4rem 0.15rem', color: '#999', fontSize: '0.9rem', userSelect: 'none' }}>…</span>
                ) : (
                    pageBtn(p)
                )
            )}

            {/* Next / Last */}
            {navBtn('›', () => onPageChange(currentPage + 1), currentPage >= totalPages)}
            {navBtn('»', () => onPageChange(totalPages), currentPage >= totalPages)}

            {/* Range info */}
            <span style={{ fontSize: '0.85rem', color: '#777', marginLeft: '0.5rem', whiteSpace: 'nowrap' }}>
                {from}–{to} / {totalItems} വോട്ടർമാർ
            </span>

            {/* Page size selector */}
            {onPageSizeChange && (
                <select
                    value={pageSize}
                    onChange={e => onPageSizeChange(Number(e.target.value))}
                    style={{
                        marginLeft: '0.25rem',
                        padding: '0.4rem 0.5rem',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        color: '#333',
                        background: 'white',
                    }}
                >
                    {[10, 25, 50, 100].map(s => (
                        <option key={s} value={s}>{s} / page</option>
                    ))}
                </select>
            )}
        </div>
    );
}
