import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, Ban, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/input';
import { PublicMenuView } from '@/components/PublicMenuView';
import { StatusBadge, VerifiedBadge } from '@/components/StatusBadge';
import { ErrorState, LoadingState } from '@/components/states';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { usePublicBusiness } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { Business } from '@/lib/types';

type Action = 'reject' | 'suspend' | 'verify' | null;

export default function AdminBusinessPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const business = useQuery({
    queryKey: ['admin-business', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('businesses').select('*').eq('id', id).single();
      if (error) throw error;
      return data as Business;
    },
  });
  const menu = usePublicBusiness(id);
  const [action, setAction] = useState<Action>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-business', id] });
    qc.invalidateQueries({ queryKey: ['admin-businesses'] });
    qc.invalidateQueries({ queryKey: ['public-business', id] });
  };

  const rpc = async (fn: string, args: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(ok);
    setAction(null);
    setText('');
    refresh();
  };

  if (business.isLoading) return <LoadingState />;
  if (business.isError) return <ErrorState error={business.error} onRetry={() => business.refetch()} />;
  const b = business.data!;

  return (
    <div className="space-y-4">
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground"><ArrowLeft className="size-4" /> Yönetim</Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{b.name}</h1>
        <StatusBadge status={b.status} />
        {b.is_verified && <VerifiedBadge />}
      </div>

      <Card>
        <CardHeader><CardTitle>İnceleme işlemleri</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <dl className="grid gap-1 text-sm sm:grid-cols-2">
            <div><dt className="inline text-muted-foreground">Gönderim: </dt><dd className="inline">{formatDateTime(b.submitted_at)}</dd></div>
            <div><dt className="inline text-muted-foreground">Son inceleme: </dt><dd className="inline">{formatDateTime(b.reviewed_at)}</dd></div>
            <div><dt className="inline text-muted-foreground">Telefon: </dt><dd className="inline">{b.phone ?? '—'}</dd></div>
            <div><dt className="inline text-muted-foreground">Konum: </dt><dd className="inline">{b.latitude !== null ? `${b.latitude}, ${b.longitude}` : '—'}</dd></div>
          </dl>
          {b.rejection_reason && <Alert variant="danger">Ret gerekçesi: {b.rejection_reason}</Alert>}
          {b.suspension_reason && <Alert variant="danger">Askı gerekçesi: {b.suspension_reason}</Alert>}
          <div className="flex flex-wrap gap-2">
            {b.status === 'pending_review' && (
              <>
                <Button disabled={busy} onClick={() => rpc('admin_review_business', { p_business_id: b.id, p_approve: true }, 'İşletme yayınlandı')}><Check /> Onayla ve yayınla</Button>
                <Button variant="outline" onClick={() => setAction('reject')}><X /> Gerekçeyle reddet</Button>
              </>
            )}
            {b.status !== 'suspended' && b.status !== 'draft' && (
              <Button variant="destructive" onClick={() => setAction('suspend')}><Ban /> Askıya al</Button>
            )}
            {b.status === 'suspended' && (
              <Button variant="outline" disabled={busy} onClick={() => rpc('admin_set_suspension', { p_business_id: b.id, p_suspend: false }, 'Askı kaldırıldı')}>Askıyı kaldır</Button>
            )}
            {b.is_verified ? (
              <Button variant="ghost" disabled={busy} onClick={() => rpc('admin_set_verified', { p_business_id: b.id, p_verified: false }, 'Doğrulama kaldırıldı')}>Doğrulamayı kaldır</Button>
            ) : (
              <Button variant="ghost" onClick={() => setAction('verify')}><BadgeCheck /> Doğrulanmış olarak işaretle</Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">“Doğrulanmış” rozeti onaydan bağımsızdır; yalnızca belge, telefon veya yerinde kontrol gibi gerçek bir doğrulamadan sonra verilmelidir.</p>
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold">Menü önizlemesi</h2>
      {menu.isLoading && <LoadingState />}
      {menu.isError && <ErrorState error={menu.error} onRetry={() => menu.refetch()} />}
      {menu.data && <div className="overflow-hidden rounded-2xl border bg-background"><PublicMenuView business={menu.data} preview /></div>}

      <Dialog open={action !== null} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === 'reject' ? 'Başvuruyu reddet' : action === 'suspend' ? 'İşletmeyi askıya al' : 'Doğrulama notu'}</DialogTitle>
            <DialogDescription>
              {action === 'verify' ? 'Hangi yöntemle doğruladığınızı yazın (ör. vergi levhası + telefon).' : 'Gerekçe işletme sahibine gösterilir (en az 10 karakter).'}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)}>Vazgeç</Button>
            <Button
              disabled={busy}
              variant={action === 'verify' ? 'default' : 'destructive'}
              onClick={() =>
                action === 'reject'
                  ? rpc('admin_review_business', { p_business_id: b.id, p_approve: false, p_reason: text }, 'Başvuru reddedildi')
                  : action === 'suspend'
                    ? rpc('admin_set_suspension', { p_business_id: b.id, p_suspend: true, p_reason: text }, 'İşletme askıya alındı')
                    : rpc('admin_set_verified', { p_business_id: b.id, p_verified: true, p_note: text }, 'Doğrulandı olarak işaretlendi')
              }
            >Onayla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
