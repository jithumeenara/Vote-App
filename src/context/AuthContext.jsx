import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Check for Custom Ward User Session
        const storedWardUser = localStorage.getItem('ward_user');
        if (storedWardUser) {
            try {
                setUser(JSON.parse(storedWardUser));
            } catch (e) {
                console.error("Failed to parse stored ward user", e);
                localStorage.removeItem('ward_user');
            }
            setLoading(false);
            return; // Skip Supabase check if custom user exists
        }

        // 2. Check Supabase Session (for Admin)
        const getSession = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;

                if (session?.user) {
                    try {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', session.user.id)
                            .single();

                        if (profile) {
                            session.user.role = profile.role;
                            session.user.ward_id = profile.ward_id;
                        }
                    } catch (error) {
                        console.error('Error fetching profile:', error);
                    }
                }

                setUser(session?.user ?? null);
            } catch (error) {
                console.error('Error checking session:', error);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        getSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            // Ignore Supabase updates if we are logged in as a custom ward user
            if (localStorage.getItem('ward_user')) return;

            if (session?.user) {
                try {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    if (profile) {
                        session.user.role = profile.role;
                        session.user.ward_id = profile.ward_id;
                    }
                } catch (error) {
                    console.error('Error fetching profile:', error);
                }
            }
            setUser(session?.user ?? null);
            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    const wardLogin = async (username, password) => {
        const { data, error } = await supabase.rpc('login_ward_user', {
            username_input: username,
            password_input: password
        });

        if (error) throw error;
        if (!data) throw new Error('Invalid credentials');

        // Store custom session
        localStorage.setItem('ward_user', JSON.stringify(data));
        setUser(data);
        return data;
    };

    const value = {
        signUp: (data) => supabase.auth.signUp(data),
        signIn: (data) => supabase.auth.signInWithPassword(data),
        wardLogin, // Export new login function
        signOut: async () => {
            localStorage.removeItem('ward_user'); // Clear custom session
            setUser(null);
            await supabase.auth.signOut();
        },
        user,
    };

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LoadingSpinner />
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};
