import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminSecurity() {
    const { user, signOut } = useAuth();
    const location = useLocation();

    useEffect(() => {
        // If user is logged in
        if (user) {
            const path = location.pathname;

            const isAdminPath = path.startsWith('/admin');
            const isLoginPath = path === '/login';
            const isPublicPath = path === '/' ||
                path.startsWith('/districts') ||
                path.startsWith('/district') ||
                path.startsWith('/constituency') ||
                path.startsWith('/booth') ||
                path.startsWith('/voters');

            if (!isAdminPath && !isLoginPath && !isPublicPath) {
                console.log('User navigated away from admin area. Logging out...');
                signOut();
            }
        }
    }, [location, user, signOut]);

    return null; // This component renders nothing
}
