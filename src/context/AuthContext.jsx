import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Fetch initial session & user from Supabase Auth
    supabase.auth.getSession().then(({ data: { session: activeSession }, error }) => {
      if (error) {
        console.error('AuthContext getSession error:', error);
      }
      if (isMounted) {
        setSession(activeSession);
        setUser(activeSession?.user ?? null);
        setIsAuthLoading(false);
      }
    }).catch((err) => {
      console.error('AuthContext session catch error:', err);
      if (isMounted) {
        setSession(null);
        setUser(null);
        setIsAuthLoading(false);
      }
    });

    // Listen to real-time auth changes (LOGIN, LOGOUT, SESSION_REFRESH)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (isMounted) {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setIsAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Compute user display name dynamically (Metadata -> Email -> Default)
  const getDisplayName = () => {
    if (!user) return 'User';
    
    // Check for full_name or name in user_metadata
    if (user.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user.user_metadata?.name) return user.user_metadata.name;
    
    // Fall back to user email
    if (user.email) {
      return user.email;
    }

    return 'Authenticated User';
  };

  const displayName = getDisplayName();

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isAuthLoading,
        displayName,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
