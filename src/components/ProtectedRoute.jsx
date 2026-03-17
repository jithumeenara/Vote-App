import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// adminOnly=true  → only real admins (Supabase auth) allowed; booth→/booth, ward→/admin (ward dashboard)
// boothBlock=true → booth members blocked; redirect to /booth
export default function ProtectedRoute({ children, adminOnly = false }) {
    const { user } = useAuth();
    const location = useLocation();

    const hasWardSession = !!localStorage.getItem('ward_user');
    const hasBoothSession = !!localStorage.getItem('booth_user');

    // Not logged in at all
    if (!user && !hasWardSession && !hasBoothSession) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Admin-only pages: block booth_member and ward_member
    if (adminOnly) {
        if (user?.role === 'booth_member') {
            return <Navigate to="/booth" replace />;
        }
        if (user?.role === 'ward_member') {
            // Ward members have their own scoped admin view — redirect to a safe page
            return <Navigate to="/admin/reports" replace />;
        }
    }

    // Booth-only page (/booth): if non-booth user tries to access, redirect to /admin
    return children;
}
