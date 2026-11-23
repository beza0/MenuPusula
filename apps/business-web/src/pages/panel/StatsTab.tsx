import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

interface StatRow { day: string; business_views: number; menu_views: number }

const istanbulToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const dayLabel = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Yalnızca gerçek ölçümler gösterilir; veri yoksa boş durum. */
export function StatsTab({ businessId }: { businessId: string }) {
  const today = istanbulToday();
  const [from, setFrom] = useState(shift(today, -6));
  const [to, setTo] = useState(today);

  const q = useQuery({
    queryKey: ['stats', businessId, from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_business_stats', { p_business_id: businessId, p_from: from, p_to: to });
      if (error) throw error;
      return data as StatRow[];
    },
  });

  const totals = (q.data ?? []).reduce((a, r) => ({ b: a.b + r.business_views, m: a.m + r.menu_views }), { b: 0, m: 0 });
  const max = Math.max(1, ...(q.data ?? []).map((r) => Math.max(r.business_views, r.menu_views)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Görüntülenme istatistikleri</CardTitle>
        <CardDescription>
          Mobil uygulamadaki işletme sayfası ve menü/QR menü görüntülemeleri. Aynı ziyaretçinin 30 dakika içindeki tekrarları sayılmaz; kişisel veri veya konum tutulmaz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Başlangıç" htmlFor="from"><Input id="from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="Bitiş" htmlFor="to"><Input id="to" type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></Field>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => { setFrom(shift(today, -6)); setTo(today); }}>7 gün</Button>
            <Button variant="outline" size="sm" onClick={() => { setFrom(shift(today, -29)); setTo(today); }}>30 gün</Button>
          </div>
        </div>
        {q.isLoading && <LoadingState />}
        {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
        {q.data && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">İşletme sayfası</p><p className="text-2xl font-bold">{totals.b}</p></div>
              <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Menü görüntüleme</p><p className="text-2xl font-bold">{totals.m}</p></div>
            </div>
            {totals.b + totals.m === 0 ? (
              <EmptyState icon={<BarChart3 className="size-8" />} title="Bu aralıkta henüz ölçüm yok" description="İşletmeniz yayına alındıktan sonra görüntülemeler burada görünür." />
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground"><th className="py-1">Gün</th><th>İşletme</th><th>Menü</th></tr></thead>
                <tbody>
                  {q.data.map((r) => (
                    <tr key={r.day} className="border-t">
                      <td className="py-1.5 pr-2">{dayLabel.format(new Date(`${r.day}T12:00:00Z`))}</td>
                      <td className="w-2/5 pr-2"><Bar value={r.business_views} max={max} /></td>
                      <td className="w-2/5"><Bar value={r.menu_views} max={max} tone="soft" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Bar({ value, max, tone }: { value: number; max: number; tone?: 'soft' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded bg-muted">
        <div className={tone === 'soft' ? 'h-2 rounded bg-amber-400' : 'h-2 rounded bg-primary'} style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="w-8 text-right tabular-nums">{value}</span>
    </div>
  );
}
