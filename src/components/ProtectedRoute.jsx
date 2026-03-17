import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
    const { user } = useAuth();
    const location = useLocation();

    const hasWardSession = !!localStorage.getItem('ward_user');
    const hasBoothSession = !!localStorage.getItem('booth_user');

    if (!user && !hasWardSession && !hasBoothSession) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}
