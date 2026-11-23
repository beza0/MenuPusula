import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/AppShell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { errorMessage } from '@/lib/errors';
import { emailSchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${window.location.origin}/sifre-yenile` });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    setSent(true);
  };

  return (
    <AuthLayout title="Şifre sıfırlama" description="Hesabınıza bağlı e-postayı girin.">
      {sent ? (
        <Alert variant="success">Bu adrese kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi.</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="E-posta" htmlFor="email" error={error ?? undefined}>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>Bağlantı gönder</Button>
        </form>
      )}
      <p className="mt-4 text-center text-sm"><Link to="/giris" className="text-primary">Girişe dön</Link></p>
    </AuthLayout>
  );
}
