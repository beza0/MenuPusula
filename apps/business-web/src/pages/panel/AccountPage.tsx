import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { useAuth } from '@/auth/AuthProvider';
import { errorMessage } from '@/lib/errors';
import { passwordSchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';

export default function AccountPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const profile = useQuery({
    queryKey: ['profile', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('display_name').eq('id', session!.user.id).single();
      if (error) throw error;
      return data;
    },
  });
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  useEffect(() => setName(profile.data?.display_name ?? ''), [profile.data]);

  const blockers = useQuery({
    queryKey: ['deletion-blockers'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('account_deletion_blockers');
      if (error) throw error;
      return data as { business_id: string; business_name: string }[];
    },
  });

  const saveName = async () => {
    const { error } = await supabase.from('profiles').update({ display_name: name.trim() || null }).eq('id', session!.user.id);
    if (error) return toast.error(errorMessage(error));
    toast.success('Profil güncellendi');
  };

  const savePassword = async () => {
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return toast.error(errorMessage(error));
    setPassword('');
    toast.success('Şifre güncellendi');
  };

  const deleteAccount = async () => {
    if (!confirm('Hesabınız ve favorileriniz kalıcı olarak silinecek. Emin misiniz?')) return;
    const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      const body = ctx ? await ctx.json().catch(() => null) : null;
      return toast.error(body?.message ?? errorMessage(error));
    }
    if (data?.deleted) {
      await supabase.auth.signOut();
      toast.success('Hesabınız silindi');
      navigate('/giris');
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Hesap</h1>
      <Card>
        <CardHeader><CardTitle>Profil</CardTitle><CardDescription>{session?.user.email}</CardDescription></CardHeader>
        <CardContent className="flex items-end gap-2">
          <Field label="Görünen ad" htmlFor="display-name" className="flex-1">
            <Input id="display-name" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button onClick={saveName}>Kaydet</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Şifre değiştir</CardTitle></CardHeader>
        <CardContent className="flex items-end gap-2">
          <Field label="Yeni şifre" htmlFor="new-password" className="flex-1">
            <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button onClick={savePassword}>Güncelle</Button>
        </CardContent>
      </Card>
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-danger">Hesabı sil</CardTitle>
          <CardDescription>Profiliniz ve favorileriniz silinir; gönderdiğiniz bildirimler anonimleştirilir.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {blockers.data && blockers.data.length > 0 ? (
            <Alert variant="warning">
              Tek sahibi olduğunuz işletmeler var: <strong>{blockers.data.map((b) => b.business_name).join(', ')}</strong>.
              İşletmeler sahipsiz bırakılamaz; hesabınızı silmeden önce bu işletmeleri silin (İşletme → Bilgiler → İşletmeyi sil).
            </Alert>
          ) : null}
          <Button variant="destructive" disabled={!blockers.data || blockers.data.length > 0} onClick={deleteAccount}>Hesabımı kalıcı olarak sil</Button>
        </CardContent>
      </Card>
    </div>
  );
}
