import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { ErrorState, LoadingState } from '@/components/states';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatHoursRange, WEEKDAYS } from '@/lib/format';
import { qk, useHours } from '@/lib/queries';
import { hoursRowSchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';

type Row = { weekday: number; opens_at: string; closes_at: string };

export function HoursTab({ businessId }: { businessId: string }) {
  const q = useHours(businessId);
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data) {
      setRows(q.data.hours.map((h) => ({ weekday: h.weekday, opens_at: h.opens_at.slice(0, 5), closes_at: h.closes_at.slice(0, 5) === '00:00' && h.opens_at.slice(0, 5) === '00:00' ? '24:00' : h.closes_at.slice(0, 5) })));
      setDirty(false);
    }
  }, [q.data]);

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  const update = (next: Row[]) => { setRows(next); setDirty(true); };
  const errors = rows.map((r) => hoursRowSchema.safeParse(r));
  const hasErrors = errors.some((e) => !e.success);

  const save = async () => {
    if (hasErrors) return toast.error('Saatleri SS:DD biçiminde girin (ör. 08:30).');
    setSaving(true);
    const { error } = await supabase.rpc('set_business_hours', { p_business_id: businessId, p_hours: rows });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success('Çalışma saatleri kaydedildi');
    qc.invalidateQueries({ queryKey: qk.hours(businessId) });
  };

  const copyToAll = (weekday: number) => {
    const src = rows.filter((r) => r.weekday === weekday);
    update(WEEKDAYS.flatMap((d) => src.map((r) => ({ ...r, weekday: d.value }))));
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader>
          <CardTitle>Haftalık çalışma saatleri</CardTitle>
          <CardDescription>
            Gece yarısını geçen saatler desteklenir: ör. 18:00 – 02:00. Tam gün için 00:00 – 24:00 girin. Aralık eklenmeyen günler “Kapalı” görünür.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {WEEKDAYS.map((d) => {
            const dayRows = rows.map((r, idx) => ({ r, idx })).filter(({ r }) => r.weekday === d.value);
            return (
              <div key={d.value} className="flex flex-col gap-2 border-b pb-3 last:border-0 sm:flex-row sm:items-start">
                <div className="w-28 shrink-0 pt-2 font-medium">{d.label}</div>
                <div className="flex-1 space-y-2">
                  {dayRows.length === 0 && <p className="pt-2 text-sm text-muted-foreground">Kapalı</p>}
                  {dayRows.map(({ r, idx }) => (
                    <div key={idx} className="flex flex-wrap items-center gap-2">
                      <Input
                        aria-label={`${d.label} açılış`}
                        className="w-24"
                        inputMode="numeric"
                        placeholder="08:00"
                        value={r.opens_at}
                        aria-invalid={!errors[idx].success}
                        onChange={(e) => update(rows.map((x, i) => (i === idx ? { ...x, opens_at: e.target.value } : x)))}
                      />
                      <span>–</span>
                      <Input
                        aria-label={`${d.label} kapanış`}
                        className="w-24"
                        inputMode="numeric"
                        placeholder="23:00"
                        value={r.closes_at}
                        aria-invalid={!errors[idx].success}
                        onChange={(e) => update(rows.map((x, i) => (i === idx ? { ...x, closes_at: e.target.value } : x)))}
                      />
                      {errors[idx].success && r.closes_at <= r.opens_at && r.closes_at !== '24:00' && (
                        <span className="text-xs text-muted-foreground">ertesi gün</span>
                      )}
                      <Button variant="ghost" size="icon" aria-label="Aralığı sil" onClick={() => update(rows.filter((_, i) => i !== idx))}>
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => update([...rows, { weekday: d.value, opens_at: '09:00', closes_at: '22:00' }])}>
                    <Plus /> Aralık
                  </Button>
                  {dayRows.length > 0 && (
                    <Button variant="ghost" size="sm" title="Bu günü tüm günlere kopyala" onClick={() => copyToAll(d.value)}>
                      <Copy /> <span className="sr-only sm:not-sr-only">Tümüne</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="flex justify-end">
            <Button onClick={save} disabled={!dirty || saving || hasErrors}>{saving ? 'Kaydediliyor…' : 'Saatleri kaydet'}</Button>
          </div>
        </CardContent>
      </Card>
      <ExceptionsCard businessId={businessId} exceptions={q.data!.exceptions} />
    </div>
  );
}

function ExceptionsCard({ businessId, exceptions }: { businessId: string; exceptions: NonNullable<ReturnType<typeof useHours>['data']>['exceptions'] }) {
  const qc = useQueryClient();
  const [date, setDate] = useState('');
  const [closed, setClosed] = useState(true);
  const [opens, setOpens] = useState('10:00');
  const [closes, setCloses] = useState('18:00');
  const [note, setNote] = useState('');

  const add = async () => {
    if (!date) return toast.error('Tarih seçin');
    const row = {
      business_id: businessId, date, is_closed: closed, note: note || null,
      opens_at: closed ? null : opens, closes_at: closed ? null : closes,
    };
    const { error } = await supabase.from('business_hour_exceptions').upsert(row, { onConflict: 'business_id,date' });
    if (error) return toast.error(errorMessage(error));
    setDate(''); setNote('');
    qc.invalidateQueries({ queryKey: qk.hours(businessId) });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('business_hour_exceptions').delete().eq('id', id);
    if (error) return toast.error(errorMessage(error));
    qc.invalidateQueries({ queryKey: qk.hours(businessId) });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Özel günler</CardTitle>
        <CardDescription>Bayram, tatil veya bakım günleri için haftalık düzeni geçersiz kılın.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field label="Tarih" htmlFor="ex-date"><Input id="ex-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={closed} onCheckedChange={(v) => setClosed(v === true)} /> Tüm gün kapalı</label>
        {!closed && (
          <div className="flex items-center gap-2">
            <Input aria-label="Açılış" className="w-24" value={opens} onChange={(e) => setOpens(e.target.value)} />–
            <Input aria-label="Kapanış" className="w-24" value={closes} onChange={(e) => setCloses(e.target.value)} />
          </div>
        )}
        <Field label="Not (isteğe bağlı)" htmlFor="ex-note"><Input id="ex-note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <Button variant="outline" onClick={add}><Plus /> Ekle</Button>
        <ul className="divide-y text-sm">
          {exceptions.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                {formatDate(e.date)} — {e.is_closed ? 'Kapalı' : formatHoursRange(e.opens_at!, e.closes_at!)}
                {e.note && <span className="text-muted-foreground"> ({e.note})</span>}
              </span>
              <Button variant="ghost" size="icon" aria-label="Sil" onClick={() => remove(e.id)}><Trash2 /></Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
