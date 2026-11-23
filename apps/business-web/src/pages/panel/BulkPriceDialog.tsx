import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { errorMessage } from '@/lib/errors';
import { formatPrice, parsePriceToCents } from '@/lib/format';
import { bulkPriceSchema } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';

interface PreviewRow {
  item_id: string;
  variant_id: string | null;
  item_name: string;
  variant_name: string | null;
  old_price_cents: number;
  new_price_cents: number;
}

/** "-5,50" gibi işaretli TL tutarını kuruşa çevirir. */
export function parseSignedTl(input: string): number | null {
  const s = input.trim();
  const negative = s.startsWith('-');
  const cents = parsePriceToCents(negative || s.startsWith('+') ? s.slice(1) : s);
  return cents === null ? null : negative ? -cents : cents;
}

export function BulkPriceDialog({
  businessId, itemIds, onClose, onApplied,
}: { businessId: string; itemIds: string[]; onClose: () => void; onApplied: () => void }) {
  const [mode, setMode] = useState<'percent' | 'fixed'>('percent');
  const [valueText, setValueText] = useState('');
  const [roundTo, setRoundTo] = useState(1);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const params = () => {
    const value = mode === 'percent' ? Number(valueText.replace(',', '.')) : parseSignedTl(valueText);
    const parsed = bulkPriceSchema.safeParse({ mode, value: value ?? Number.NaN, roundTo });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message === 'Invalid input' ? 'Geçerli bir değer girin' : parsed.error.issues[0].message);
      return null;
    }
    return parsed.data;
  };

  const call = async (apply: boolean) => {
    setError(null);
    const p = params();
    if (!p) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('bulk_update_prices', {
      p_business_id: businessId, p_item_ids: itemIds, p_mode: p.mode, p_value: p.value, p_round_to: p.roundTo, p_apply: apply,
    });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    if (apply) {
      toast.success(`${(data as PreviewRow[]).length} fiyat güncellendi`);
      onApplied();
      onClose();
    } else {
      setPreview(data as PreviewRow[]);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Toplu fiyat güncelleme</DialogTitle>
          <DialogDescription>{itemIds.length} ürün seçildi. Varyantlı ürünlerde her seçeneğin fiyatı ayrı güncellenir.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Yöntem" htmlFor="bulk-mode">
            <NativeSelect id="bulk-mode" value={mode} onChange={(e) => { setMode(e.target.value as 'percent' | 'fixed'); setPreview(null); }}>
              <option value="percent">Yüzde (%)</option>
              <option value="fixed">Sabit tutar (₺)</option>
            </NativeSelect>
          </Field>
          <Field label={mode === 'percent' ? 'Değişim (%)' : 'Tutar (₺)'} htmlFor="bulk-value" hint={mode === 'percent' ? 'İndirim için eksi: -10' : 'İndirim için eksi: -5'}>
            <Input id="bulk-value" inputMode="decimal" value={valueText} onChange={(e) => { setValueText(e.target.value); setPreview(null); }} />
          </Field>
          <Field label="Yuvarlama" htmlFor="bulk-round">
            <NativeSelect id="bulk-round" value={roundTo} onChange={(e) => { setRoundTo(Number(e.target.value)); setPreview(null); }}>
              <option value={1}>Kuruş</option>
              <option value={50}>0,50 ₺</option>
              <option value={100}>1 ₺</option>
              <option value={500}>5 ₺</option>
              <option value={1000}>10 ₺</option>
            </NativeSelect>
          </Field>
        </div>
        {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
        {preview && (
          <div className="mt-4 max-h-72 overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted text-left">
                <tr><th className="p-2">Ürün</th><th className="p-2 text-right">Eski</th><th className="p-2 text-right">Yeni</th></tr>
              </thead>
              <tbody>
                {preview.map((r) => (
                  <tr key={`${r.item_id}-${r.variant_id ?? ''}`} className="border-t">
                    <td className="p-2">{r.item_name}{r.variant_name && <span className="text-muted-foreground"> · {r.variant_name}</span>}</td>
                    <td className="price p-2 text-right text-muted-foreground line-through">{formatPrice(r.old_price_cents)}</td>
                    <td className="price p-2 text-right font-semibold">{formatPrice(r.new_price_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Vazgeç</Button>
          {!preview ? (
            <Button onClick={() => call(false)} disabled={busy}>Önizle</Button>
          ) : (
            <Button onClick={() => call(true)} disabled={busy}>Onayla ve {preview.length} fiyatı güncelle</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
