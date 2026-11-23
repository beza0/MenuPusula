import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { AuthLayout } from '@/components/AppShell';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { errorMessage } from '@/lib/errors';
import { emailSchema, passwordSchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    const em = emailSchema.safeParse(email);
    const pw = passwordSchema.safeParse(password);
    if (!em.success) next.email = em.error.issues[0].message;
    if (!pw.success) next.password = pw.error.issues[0].message;
    if (!accepted) next.terms = 'Devam etmek için koşulları kabul edin';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/panel` },
    });
    setBusy(false);
    if (error) return setErrors({ form: errorMessage(error) });
    setSentTo(email.trim());
  };

  if (sentTo) {
    return (
      <AuthLayout title="E-postanızı doğrulayın">
        <div className="flex flex-col items-center gap-3 text-center">
          <MailCheck className="size-10 text-primary" />
          <p className="text-sm"><strong>{sentTo}</strong> adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra giriş yapabilirsiniz.</p>
          <Link to="/giris" className="text-sm text-primary">Giriş sayfasına dön</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="İşletme hesabı oluştur" description="Hesap oluşturup işletmenizi ve menünüzü ekleyin.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="E-posta" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" value={email} aria-invalid={Boolean(errors.email)} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Şifre" htmlFor="password" error={errors.password} hint="En az 8 karakter">
          <Input id="password" type="password" autoComplete="new-password" value={password} aria-invalid={Boolean(errors.password)} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5" />
          <span>
            <Link to="/kullanim-kosullari" className="text-primary underline" target="_blank">Kullanım koşullarını</Link> ve{' '}
            <Link to="/gizlilik" className="text-primary underline" target="_blank">gizlilik politikasını</Link> okudum, kabul ediyorum.
          </span>
        </label>
        {errors.terms && <p className="text-xs text-danger">{errors.terms}</p>}
        {errors.form && <Alert variant="danger">{errors.form}</Alert>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Oluşturuluyor…' : 'Hesap oluştur'}</Button>
      </form>
      <p className="mt-4 text-center text-sm">Zaten hesabınız var mı? <Link to="/giris" className="text-primary">Giriş yapın</Link></p>
    </AuthLayout>
  );
}
