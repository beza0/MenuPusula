import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Shield, Store, UserRound } from 'lucide-react';
import { Logo } from './Logo';
import { Button } from './ui/button';
import { useAuth, useIsAdmin } from '@/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export function AppShell() {
  const { session } = useAuth();
  const { data: isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  const link = ({ isActive }: { isActive: boolean }) =>
    cn('flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-primary-soft text-primary' : 'hover:bg-muted');

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Logo to="/panel" />
          <nav className="ml-auto flex items-center gap-1" aria-label="Ana menü">
            <NavLink to="/panel" end className={link}><Store className="size-4" /><span className="hidden sm:inline">İşletmelerim</span></NavLink>
            {isAdmin && <NavLink to="/admin" className={link}><Shield className="size-4" /><span className="hidden sm:inline">Yönetim</span></NavLink>}
            <NavLink to="/hesap" className={link}><UserRound className="size-4" /><span className="hidden sm:inline">Hesap</span></NavLink>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Çıkış yap"
              onClick={async () => { await supabase.auth.signOut(); navigate('/giris'); }}
            >
              <LogOut /> <span className="hidden sm:inline">Çıkış</span>
            </Button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted-foreground">
        <span>{session?.user.email}</span> · <Link to="/gizlilik" className="underline">Gizlilik</Link> · <Link to="/kullanim-kosullari" className="underline">Kullanım koşulları</Link>
      </footer>
    </div>
  );
}

export function AuthLayout({ children, title, description }: { children: React.ReactNode; title: string; description?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6"><Logo to="/" /></div>
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
