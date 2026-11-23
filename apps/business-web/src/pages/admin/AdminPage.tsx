import { useState } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { StatusBadge, VerifiedBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { BUSINESS_TYPE_LABELS, REPORT_REASON_LABELS } from '@/lib/constants';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import type { AuditLog, Business, BusinessStatus, Report } from '@/lib/types';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { id: 'basvurular', label: 'Başvurular' },
  { id: 'isletmeler', label: 'Tüm işletmeler' },
  { id: 'bildirimler', label: 'Bildirimler' },
  { id: 'kayitlar', label: 'İşlem kayıtları' },
];

export default function AdminPage() {
  const { section = 'basvurular' } = useParams();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Yönetim</h1>
      <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Yönetim bölümleri">
        {SECTIONS.map((s) => (
          <NavLink
            key={s.id}
            to={`/admin/${s.id}`}
            className={() => cn('-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium', section === s.id ? 'border-primary' : 'border-transparent text-muted-foreground')}
          >
            {s.label}
          </NavLink>
        ))}
      </nav>
      {section === 'basvurular' && <BusinessList statuses={['pending_review']} emptyText="İncelenmeyi bekleyen başvuru yok." />}
      {section === 'isletmeler' && <AllBusinesses />}
      {section === 'bildirimler' && <Reports />}
      {section === 'kayitlar' && <AuditLogs />}
    </div>
  );
}

function AllBusinesses() {
  const [status, setStatus] = useState<BusinessStatus | ''>('');
  const [q, setQ] = useState('');
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="İşletme adı ara" value={q} onChange={(e) => setQ(e.target.value)} />
        <NativeSelect className="max-w-48" value={status} onChange={(e) => setStatus(e.target.value as BusinessStatus | '')}>
          <option value="">Tüm durumlar</option>
          <option value="draft">Taslak</option>
          <option value="pending_review">İncelemede</option>
          <option value="published">Yayında</option>
          <option value="rejected">Reddedildi</option>
          <option value="suspended">Askıda</option>
        </NativeSelect>
      </div>
      <BusinessList statuses={status ? [status] : undefined} search={q} emptyText="Kayıt bulunamadı." />
    </div>
  );
}

function BusinessList({ statuses, search = '', emptyText }: { statuses?: BusinessStatus[]; search?: string; emptyText: string }) {
  const query = useQuery({
    queryKey: ['admin-businesses', statuses, search],
    queryFn: async () => {
      let req = supabase.from('businesses').select('*').order('submitted_at', { ascending: true, nullsFirst: false }).limit(200);
      if (statuses) req = req.in('status', statuses);
      if (search.trim()) req = req.ilike('name', `%${search.trim().replace(/[%_]/g, '')}%`);
      const { data, error } = await req;
      if (error) throw error;
      return data as Business[];
    },
  });
  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.length) return <EmptyState title={emptyText} />;
  return (
    <Card className="divide-y">
      {query.data.map((b) => (
        <Link key={b.id} to={`/admin/isletme/${b.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/50">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{b.name}</span>
              <StatusBadge status={b.status} />
              {b.is_verified && <VerifiedBadge />}
            </div>
            <p className="text-sm text-muted-foreground">
              {BUSINESS_TYPE_LABELS[b.type]} · {[b.district, b.city].filter(Boolean).join(', ') || '—'} · Gönderim: {formatDateTime(b.submitted_at)}
            </p>
          </div>
          <ChevronRight className="size-5 text-muted-foreground" />
        </Link>
      ))}
    </Card>
  );
}

function Reports() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed'>('open');
  const [resolving, setResolving] = useState<{ report: Report; outcome: 'resolved' | 'dismissed' } | null>(null);
  const [note, setNote] = useState('');
  const query = useQuery({
    queryKey: ['admin-reports', status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*, businesses(id, name, status), menu_items(name)')
        .eq('status', status)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as (Report & { businesses: { id: string; name: string; status: BusinessStatus } | null; menu_items: { name: string } | null })[];
    },
  });

  const resolve = async () => {
    if (!resolving) return;
    const { error } = await supabase.rpc('admin_resolve_report', { p_report_id: resolving.report.id, p_status: resolving.outcome, p_note: note });
    if (error) return toast.error(errorMessage(error));
    toast.success('Bildirim sonuçlandırıldı');
    setResolving(null);
    setNote('');
    qc.invalidateQueries({ queryKey: ['admin-reports'] });
  };

  return (
    <div className="space-y-3">
      <NativeSelect className="max-w-48" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
        <option value="open">Açık</option>
        <option value="resolved">Çözüldü</option>
        <option value="dismissed">Geçersiz sayıldı</option>
      </NativeSelect>
      {query.isLoading && <LoadingState />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data?.length === 0 && <EmptyState title="Bildirim yok" />}
      {query.data && query.data.length > 0 && (
        <Card className="divide-y">
          {query.data.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="warning">{REPORT_REASON_LABELS[r.reason]}</Badge>
                  {r.businesses && <Link to={`/admin/isletme/${r.businesses.id}`} className="font-semibold text-primary">{r.businesses.name}</Link>}
                  {r.menu_items && <span className="text-sm text-muted-foreground">· {r.menu_items.name}</span>}
                </div>
                {r.message && <p className="text-sm">{r.message}</p>}
                <p className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}{r.resolution_note && ` · Not: ${r.resolution_note}`}</p>
              </div>
              {r.status === 'open' && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setResolving({ report: r, outcome: 'resolved' })}>Çözüldü</Button>
                  <Button size="sm" variant="outline" onClick={() => setResolving({ report: r, outcome: 'dismissed' })}>Geçersiz</Button>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
      <Dialog open={Boolean(resolving)} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{resolving?.outcome === 'resolved' ? 'Bildirimi çözüldü olarak işaretle' : 'Bildirimi geçersiz say'}</DialogTitle></DialogHeader>
          <Textarea placeholder="Not (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolving(null)}>Vazgeç</Button>
            <Button onClick={resolve}>Onayla</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AuditLogs() {
  const query = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return data as AuditLog[];
    },
  });
  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data?.length) return <EmptyState title="Henüz yönetim işlemi yok" />;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted text-left"><tr><th className="p-2">Zaman</th><th className="p-2">İşlem</th><th className="p-2">Hedef</th><th className="p-2">Ayrıntı</th></tr></thead>
        <tbody>
          {query.data.map((l) => (
            <tr key={l.id} className="border-t align-top">
              <td className="whitespace-nowrap p-2">{formatDateTime(l.created_at)}</td>
              <td className="p-2 font-medium">{l.action}</td>
              <td className="p-2">{l.target_type === 'business' && l.target_id ? <Link className="text-primary" to={`/admin/isletme/${l.target_id}`}>{l.target_id.slice(0, 8)}</Link> : l.target_id?.slice(0, 8)}</td>
              <td className="p-2 text-xs text-muted-foreground">{JSON.stringify(l.details)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
