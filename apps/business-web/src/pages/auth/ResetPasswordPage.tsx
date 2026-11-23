import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { AuthLayout } from '@/components/AppShell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/auth/AuthProvider';
import { errorMessage } from '@/lib/errors';
import { passwordSchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';

/** E-postadaki sıfırlama bağlantısı bu sayfaya oturum kodu ile döner. */
export default function ResetPasswordPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    if (error) return setError(errorMessage(error));
    toast.success('Şifreniz güncellendi');
    navigate('/panel');
  };

  return (
    <AuthLayout title="Yeni şifre belirleyin">
      {!loading && !session ? (
        <Alert variant="warning">Bağlantı geçersiz veya süresi dolmuş. Lütfen yeniden şifre sıfırlama isteyin.</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Yeni şifre" htmlFor="password" error={error ?? undefined}>
            <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full">Şifreyi kaydet</Button>
        </form>
      )}
    </AuthLayout>
  );
}
