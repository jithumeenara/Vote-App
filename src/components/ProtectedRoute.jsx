import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
    const { user } = useAuth();
    const location = useLocation();

    // Also check localStorage directly — handles the race condition where
    // wardLogin sets localStorage before React re-renders with new user state
    const hasWardSession = !!localStorage.getItem('ward_user');

    if (!user && !hasWardSession) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}
