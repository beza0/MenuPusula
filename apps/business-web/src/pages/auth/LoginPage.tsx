import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AppShell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/auth/AuthProvider';
import { errorMessage } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/panel';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={from} replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    navigate(from, { replace: true });
  };

  return (
    <AuthLayout title="İşletme paneline giriş" description="Menünüzü yönetmek için giriş yapın.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="E-posta" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Şifre" htmlFor="password">
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <Alert variant="danger">{error}</Alert>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Giriş yapılıyor…' : 'Giriş yap'}</Button>
      </form>
      <div className="mt-4 flex justify-between text-sm">
        <Link to="/sifremi-unuttum" className="text-primary">Şifremi unuttum</Link>
        <Link to="/kayit" className="text-primary">Hesap oluştur</Link>
      </div>
    </AuthLayout>
  );
}
