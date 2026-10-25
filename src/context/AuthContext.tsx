import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  isLoading: boolean;
  unreadNotificationsCount: number;
  unreadMessagesCount: number;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, username: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('Error fetching profile:', error.message);
        return null;
      }

      if (data) {
        setProfile(data as Profile);
        return data as Profile;
      }

      // If user has auth account but no profile row yet, create one
      const { data: userData } = await supabase.auth.getUser();
      const meta = userData?.user?.user_metadata || {};
      const fallbackUsername = meta.username || `user_${userId.slice(0, 8)}`;
      const fallbackName = meta.full_name || 'Upmind Member';

      const { data: newProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: fallbackUsername,
          full_name: fallbackName,
          display_name: fallbackName,
          followers_count: 0,
          following_count: 0,
          experience_level: 'beginner',
          interests: [],
        })
        .select()
        .single();

      if (!insertError && newProfile) {
        setProfile(newProfile as Profile);
        return newProfile as Profile;
      }
      return null;
    } catch (err) {
      console.error('Unexpected error in fetchProfile:', err);
      return null;
    }
  }, []);

  const fetchUnreadCounts = useCallback(async (userId: string) => {
    try {
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('is_read', false);

      setUnreadNotificationsCount(notifCount || 0);

      // Check conversation members unread
      const { data: memberships } = await supabase
        .from('conversation_members')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId);

      if (memberships && memberships.length > 0) {
        let unreadChatCount = 0;
        for (const m of memberships) {
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', m.conversation_id)
            .neq('sender_id', userId)
            .gt('created_at', m.last_read_at || '1970-01-01');

          if (count && count > 0) unreadChatCount++;
        }
        setUnreadMessagesCount(unreadChatCount);
      } else {
        setUnreadMessagesCount(0);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    let mounted = true;

    // 1. Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchUnreadCounts(session.user.id);
      } else {
        setProfile(null);
      }
      setIsLoading(false);
    });

    // 2. Auth state changes listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        if (!mounted) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
          await fetchUnreadCounts(currentSession.user.id);
        } else {
          setProfile(null);
          setUnreadNotificationsCount(0);
          setUnreadMessagesCount(0);
        }
        setIsLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, fetchUnreadCounts]);

  // Set up periodic unread count poll & realtime notification listener
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchUnreadCounts(user.id);
    }, 15000);

    return () => clearInterval(interval);
  }, [user, fetchUnreadCounts]);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) return { error };

      if (data.user) {
        await fetchProfile(data.user.id);
        await fetchUnreadCounts(data.user.id);
      }
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    username: string
  ) => {
    try {
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

      // Check username uniqueness
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', cleanUsername)
        .maybeSingle();

      if (existingUser) {
        return { error: new Error('Username is already taken. Please choose another.') };
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            username: cleanUsername,
          },
        },
      });

      if (error) return { error };

      if (data.user) {
        // Auto-create profile record if trigger hasn't fired yet
        await supabase.from('profiles').upsert({
          id: data.user.id,
          username: cleanUsername,
          full_name: fullName.trim(),
          display_name: fullName.trim(),
          followers_count: 0,
          following_count: 0,
          experience_level: 'beginner',
          interests: [],
        });
        await fetchProfile(data.user.id);
      }
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setSession(null);
      setUnreadNotificationsCount(0);
      setUnreadMessagesCount(0);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
      await fetchUnreadCounts(user.id);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user || !profile) return { error: new Error('Not authenticated') };
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) return { error };
      await fetchProfile(user.id);
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        isLoading,
        unreadNotificationsCount,
        unreadMessagesCount,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
