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

            // Check if the user is navigating AWAY from admin pages
            // We allow /admin* and /login
            // If they go to /, /panchayats, etc., we log them out.
            const isAdminPath = path.startsWith('/admin');
            const isLoginPath = path === '/login';

            if (!isAdminPath && !isLoginPath) {
                console.log('User navigated away from admin area. Logging out...');
                signOut();
            }
        }
    }, [location, user, signOut]);

    return null; // This component renders nothing
}
