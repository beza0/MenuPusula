import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LoadingState } from '@/components/states';

interface AuthState {
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });
  const qc = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false });
      qc.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/**
 * Yönetici durumu sunucudaki admin_users tablosundan okunur (kullanıcı metadata'sından DEĞİL).
 * Arayüz yalnızca gösterim içindir; asıl koruma veritabanı fonksiyonları ve RLS'tedir.
 */
export function useIsAdmin() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['am-i-admin', session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('am_i_admin');
      if (error) throw error;
      return Boolean(data);
    },
  });
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState />;
  if (!session) return <Navigate to="/giris" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { data: isAdmin, isLoading } = useIsAdmin();
  if (isLoading) return <LoadingState />;
  if (!isAdmin) return <Navigate to="/panel" replace />;
  return <>{children}</>;
}
