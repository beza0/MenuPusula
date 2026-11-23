import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Sparkles, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox, Switch } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/states';
import { errorMessage } from '@/lib/errors';
import { centsToInput, parsePriceToCents } from '@/lib/format';
import { qk } from '@/lib/queries';
import { IMPORT_BUCKET, supabase } from '@/lib/supabase';
import type { Business } from '@/lib/types';
import { cn } from '@/lib/utils';

interface DraftItem {
  category: string | null;
  name: string | null;
  description: string | null;
  price_cents: number | null;
  variants: { name: string | null; price_cents: number | null }[];
  flags: string[];
  note: string | null;
}

interface Row {
  include: boolean;
  category: string;
  name: string;
  description: string;
  price: string;
  variants: { name: string; price: string }[];
  flags: string[];
  note: string | null;
}

const FLAG_LABEL: Record<string, string> = {
  name_missing: 'Ad okunamadı',
  price_missing: 'Fiyat bulunamadı',
  price_unparsed: 'Fiyat anlaşılamadı',
  model_uncertain: 'Belirsiz',
  variant_incomplete: 'Seçenek eksik',
};

const toRow = (d: DraftItem): Row => ({
  include: !d.flags.includes('name_missing'),
  category: d.category ?? '',
  name: d.name ?? '',
  description: d.description ?? '',
  price: d.price_cents === null ? '' : centsToInput(d.price_cents),
  variants: d.variants.map((v) => ({ name: v.name ?? '', price: v.price_cents === null ? '' : centsToInput(v.price_cents) })),
  flags: d.flags,
  note: d.note,
});

/** Satırın onaylanabilir olup olmadığı (fiyat/ad işletme tarafından girilmeli). */
export function rowProblem(r: Row): string | null {
  if (!r.name.trim()) return 'Ürün adı girin';
  if (r.variants.length) {
    if (r.variants.some((v) => !v.name.trim() || parsePriceToCents(v.price) === null)) return 'Seçenek adı/fiyatı eksik';
    return null;
  }
  return parsePriceToCents(r.price) === null ? 'Fiyat girin' : null;
}

export function ImportTab({ business }: { business: Business }) {
  const qc = useQueryClient();
  const status = useQuery({
    queryKey: ['menu-import-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('menu-import', { method: 'GET' });
      if (error) throw error;
      return data as { configured: boolean; reason: string | null; limits: { maxFiles: number; maxPdfPages: number; dailyPerBusiness: number } };
    },
  });
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [hidden, setHidden] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (status.isLoading) return <LoadingState />;
  if (status.isError || !status.data?.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-5" /> AI ile menü aktarma</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="warning">
            <p className="font-medium">Bu özellik yapılandırılmamış.</p>
            <p>Sunucuda bir AI sağlayıcısı ve API anahtarı tanımlanmadığı için menü fotoğrafından aktarma kullanılamıyor. Menünüzü “Menü” sekmesinden elle ekleyebilirsiniz.</p>
            {status.data?.reason && <p className="mt-1 text-xs">Ayrıntı: {status.data.reason}</p>}
          </Alert>
        </CardContent>
      </Card>
    );
  }
  const limits = status.data.limits;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const paths: string[] = [];
      for (const f of files) {
        const ext = f.type === 'application/pdf' ? 'pdf' : f.type.split('/')[1].replace('jpeg', 'jpg');
        const path = `${business.id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from(IMPORT_BUCKET).upload(path, f, { contentType: f.type });
        if (error) throw error;
        paths.push(path);
      }
      const { data, error } = await supabase.functions.invoke('menu-import', { method: 'POST', body: { business_id: business.id, paths } });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        const body = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(body?.message ?? errorMessage(error));
      }
      setJobId(data.job_id);
      setRows((data.draft as DraftItem[]).map(toRow));
      if ((data.draft as DraftItem[]).length === 0) setError('Dosyalarda ürün bulunamadı.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const selected = rows.filter((r) => r.include);
  const problems = selected.map(rowProblem).filter(Boolean);

  const apply = async () => {
    if (!jobId) return;
    const items = selected.map((r) => ({
      category: r.category.trim() || null,
      name: r.name.trim(),
      description: r.description.trim() || null,
      price_cents: r.variants.length ? null : parsePriceToCents(r.price),
      variants: r.variants.map((v) => ({ name: v.name.trim(), price_cents: parsePriceToCents(v.price) })),
    }));
    setBusy(true);
    const { data, error } = await supabase.rpc('apply_menu_import', { p_job_id: jobId, p_items: items, p_hidden: hidden });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    toast.success(`${data} ürün menüye eklendi${hidden ? ' (gizli)' : ''}`);
    setRows([]);
    setJobId(null);
    setFiles([]);
    qc.invalidateQueries({ queryKey: qk.menu(business.id) });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="size-5" /> AI ile menü aktarma</CardTitle>
          <CardDescription>
            Menü fotoğraflarını veya PDF’ini yükleyin. Sonuçlar önce taslak olarak gösterilir; siz düzeltip onaylamadan hiçbir ürün menüye eklenmez.
            AI fiyat veya içerik uydurmaz; okunamayan alanlar boş ve işaretli gelir. Alerjen bilgisi aktarılmaz.
            Sınırlar: en fazla {limits.maxFiles} dosya, toplam {limits.maxPdfPages} sayfa, işletme başına günde {limits.dailyPerBusiness} aktarım.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border bg-white px-4 text-sm hover:bg-muted">
            <Upload className="size-4" /> Dosya seç
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="sr-only"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, limits.maxFiles))}
            />
          </label>
          <span className="text-sm text-muted-foreground">{files.length ? files.map((f) => f.name).join(', ') : 'Dosya seçilmedi'}</span>
          <Button className="ml-auto" disabled={!files.length || busy} onClick={run}>{busy && !rows.length ? 'Okunuyor…' : 'Menüyü oku'}</Button>
        </CardContent>
      </Card>

      {error && <Alert variant="danger">{error}</Alert>}

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Taslak önizleme ({rows.length} satır)</CardTitle>
            <CardDescription>İşaretli satırları kontrol edin. Fiyatı olmayan ürün onaylanamaz.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr><th className="p-1">Ekle</th><th className="p-1">Kategori</th><th className="p-1">Ürün</th><th className="p-1">Açıklama</th><th className="p-1">Fiyat (₺)</th><th className="p-1">Uyarılar</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const problem = r.include ? rowProblem(r) : null;
                    return (
                      <tr key={i} className={cn('border-t align-top', r.flags.length > 0 && 'bg-amber-50/60', !r.include && 'opacity-50')}>
                        <td className="p-1"><Checkbox aria-label="Satırı ekle" checked={r.include} onCheckedChange={(v) => update(i, { include: v === true })} /></td>
                        <td className="p-1"><Input value={r.category} onChange={(e) => update(i, { category: e.target.value })} placeholder="Diğer" /></td>
                        <td className="p-1"><Input value={r.name} aria-invalid={!r.name.trim()} onChange={(e) => update(i, { name: e.target.value })} /></td>
                        <td className="p-1"><Input value={r.description} onChange={(e) => update(i, { description: e.target.value })} /></td>
                        <td className="p-1">
                          {r.variants.length === 0 ? (
                            <Input className="w-28" inputMode="decimal" value={r.price} aria-invalid={r.include && parsePriceToCents(r.price) === null} onChange={(e) => update(i, { price: e.target.value })} />
                          ) : (
                            <div className="space-y-1">
                              {r.variants.map((v, vi) => (
                                <div key={vi} className="flex gap-1">
                                  <Input className="w-24" value={v.name} onChange={(e) => update(i, { variants: r.variants.map((x, xi) => (xi === vi ? { ...x, name: e.target.value } : x)) })} />
                                  <Input className="w-24" inputMode="decimal" value={v.price} aria-invalid={parsePriceToCents(v.price) === null} onChange={(e) => update(i, { variants: r.variants.map((x, xi) => (xi === vi ? { ...x, price: e.target.value } : x)) })} />
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-1">
                          <div className="flex flex-wrap gap-1">
                            {r.flags.map((f) => <Badge key={f} variant="warning"><AlertTriangle className="size-3" /> {FLAG_LABEL[f] ?? f}</Badge>)}
                            {problem && <Badge variant="danger">{problem}</Badge>}
                          </div>
                          {r.note && <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={hidden} onCheckedChange={setHidden} /> Ürünleri gizli olarak ekle (menüde kontrol ettikten sonra görünür yapın)</label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => { setRows([]); setJobId(null); }}><Trash2 /> Taslağı at</Button>
              <Button disabled={busy || selected.length === 0 || problems.length > 0} onClick={apply}>
                Onayla ve {selected.length} ürünü ekle
              </Button>
            </div>
            {problems.length > 0 && <p className="text-right text-xs text-danger">{problems.length} satırda eksik bilgi var.</p>}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
