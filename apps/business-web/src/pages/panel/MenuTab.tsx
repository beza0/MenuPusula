import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CheckCheck, Eye, EyeOff, Pencil, Percent, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox, Switch } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { errorMessage } from '@/lib/errors';
import { formatDate, formatDateTime, formatPrice } from '@/lib/format';
import { qk, useMenu } from '@/lib/queries';
import { categorySchema } from '@/lib/schemas';
import { useSignedUrls } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { Business, MenuCategory, MenuItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ItemDialog } from './ItemDialog';
import { BulkPriceDialog } from './BulkPriceDialog';

export function MenuTab({ business }: { business: Business }) {
  const menu = useMenu(business.id);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [catDialog, setCatDialog] = useState<MenuCategory | 'new' | null>(null);
  const [itemDialog, setItemDialog] = useState<{ item: MenuItem | null; categoryId: string } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.menu(business.id) });
    qc.invalidateQueries({ queryKey: qk.business(business.id) });
  };

  const imagePaths = useMemo(() => menu.data?.items.map((i) => i.image_path) ?? [], [menu.data]);
  const { data: urls } = useSignedUrls(imagePaths);

  if (menu.isLoading) return <LoadingState />;
  if (menu.isError) return <ErrorState error={menu.error} onRetry={() => menu.refetch()} />;
  const { categories, items } = menu.data!;

  const run = async (p: PromiseLike<{ error: unknown }>, ok?: string) => {
    const { error } = await p;
    if (error) return toast.error(errorMessage(error));
    if (ok) toast.success(ok);
    refresh();
  };

  const move = (kind: 'categories' | 'items', list: { id: string }[], index: number, dir: -1 | 1) => {
    const next = [...list];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(supabase.rpc('reorder_menu', { p_business_id: business.id, p_kind: kind, p_ids: next.map((x) => x.id) }));
  };

  const markChecked = () =>
    run(supabase.rpc('mark_prices_checked', { p_business_id: business.id }), 'Fiyatların kontrol edildiği kaydedildi');

  const toggleSelect = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex-1 text-sm">
          <p>Menü son güncelleme: <strong>{formatDateTime(business.menu_updated_at)}</strong></p>
          <p>Fiyatlar son kontrol: <strong>{formatDate(business.prices_checked_at)}</strong></p>
          <p className="text-xs text-muted-foreground">“Fiyatları kontrol ettim”, içerik değişikliği yapmadan fiyatların güncel olduğunu onaylar ve ayrı tarih olarak gösterilir.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={markChecked}><CheckCheck /> Fiyatları kontrol ettim</Button>
          <Button variant="outline" disabled={selected.size === 0} onClick={() => setBulkOpen(true)}>
            <Percent /> Toplu fiyat ({selected.size})
          </Button>
          <Button onClick={() => setCatDialog('new')}><Plus /> Kategori</Button>
        </div>
      </Card>

      {categories.length === 0 && (
        <EmptyState
          icon={<UtensilsCrossed className="size-8" />}
          title="Menünüz boş"
          description="Önce “Kahveler”, “Ana yemekler” gibi bir kategori ekleyin, ardından ürünleri girin."
          action={<Button onClick={() => setCatDialog('new')}><Plus /> İlk kategoriyi ekle</Button>}
        />
      )}

      {categories.map((cat, ci) => {
        const catItems = items.filter((i) => i.category_id === cat.id);
        const allSelected = catItems.length > 0 && catItems.every((i) => selected.has(i.id));
        return (
          <Card key={cat.id} className={cn(!cat.is_visible && 'border-dashed')}>
            <div className="flex flex-wrap items-center gap-2 border-b p-3">
              <Checkbox
                aria-label={`${cat.name} kategorisindeki tüm ürünleri seç`}
                checked={allSelected}
                disabled={catItems.length === 0}
                onCheckedChange={(v) =>
                  setSelected((s) => {
                    const n = new Set(s);
                    catItems.forEach((i) => (v ? n.add(i.id) : n.delete(i.id)));
                    return n;
                  })
                }
              />
              <h3 className="font-semibold">{cat.name}</h3>
              {!cat.is_visible && <Badge variant="neutral">Gizli kategori</Badge>}
              <span className="text-xs text-muted-foreground">{catItems.length} ürün</span>
              <div className="ml-auto flex gap-1">
                <Button variant="ghost" size="icon" aria-label="Kategoriyi yukarı taşı" disabled={ci === 0} onClick={() => move('categories', categories, ci, -1)}><ArrowUp /></Button>
                <Button variant="ghost" size="icon" aria-label="Kategoriyi aşağı taşı" disabled={ci === categories.length - 1} onClick={() => move('categories', categories, ci, 1)}><ArrowDown /></Button>
                <Button variant="ghost" size="icon" aria-label="Kategoriyi düzenle" onClick={() => setCatDialog(cat)}><Pencil /></Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Kategoriyi sil"
                  onClick={() => {
                    if (confirm(`“${cat.name}” kategorisi ve içindeki ${catItems.length} ürün silinsin mi?`)) {
                      run(supabase.from('menu_categories').delete().eq('id', cat.id), 'Kategori silindi');
                    }
                  }}
                ><Trash2 /></Button>
              </div>
            </div>
            <ul className="divide-y">
              {catItems.map((item, ii) => (
                <li key={item.id} className={cn('flex items-center gap-3 p-3', item.is_hidden && 'bg-muted/40')}>
                  <Checkbox aria-label={`${item.name} seç`} checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} />
                  <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.image_path && urls?.[item.image_path] ? (
                      <img src={urls[item.image_path]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground/60"><UtensilsCrossed className="size-4" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{item.name}</span>
                      {!item.is_available && <Badge variant="danger">Tükendi</Badge>}
                      {item.is_hidden && <Badge variant="neutral">Gizli</Badge>}
                    </div>
                    <p className="price text-sm text-muted-foreground">
                      {item.has_variants
                        ? item.menu_item_variants?.map((v) => `${v.name}: ${formatPrice(v.price_cents)}`).join(' · ')
                        : formatPrice(item.price_cents)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="hidden items-center gap-1.5 text-xs sm:flex" title="Satışta / tükendi">
                      <Switch
                        checked={item.is_available}
                        aria-label="Satışta"
                        onCheckedChange={(v) => run(supabase.from('menu_items').update({ is_available: v }).eq('id', item.id))}
                      />
                      {item.is_available ? 'Satışta' : 'Tükendi'}
                    </label>
                    <Button
                      variant="ghost" size="icon"
                      aria-label={item.is_hidden ? 'Ürünü göster' : 'Ürünü gizle'}
                      onClick={() => run(supabase.from('menu_items').update({ is_hidden: !item.is_hidden }).eq('id', item.id))}
                    >
                      {item.is_hidden ? <EyeOff /> : <Eye />}
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Yukarı" disabled={ii === 0} onClick={() => move('items', catItems, ii, -1)}><ArrowUp /></Button>
                    <Button variant="ghost" size="icon" aria-label="Aşağı" disabled={ii === catItems.length - 1} onClick={() => move('items', catItems, ii, 1)}><ArrowDown /></Button>
                    <Button variant="ghost" size="icon" aria-label="Ürünü düzenle" onClick={() => setItemDialog({ item, categoryId: cat.id })}><Pencil /></Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="p-3">
              <Button variant="outline" size="sm" onClick={() => setItemDialog({ item: null, categoryId: cat.id })}><Plus /> Ürün ekle</Button>
            </div>
          </Card>
        );
      })}

      {catDialog && (
        <CategoryDialog
          businessId={business.id}
          category={catDialog === 'new' ? null : catDialog}
          nextOrder={categories.length}
          onClose={() => setCatDialog(null)}
          onSaved={refresh}
        />
      )}
      {itemDialog && (
        <ItemDialog
          businessId={business.id}
          categories={categories}
          item={itemDialog.item}
          categoryId={itemDialog.categoryId}
          nextOrder={items.filter((i) => i.category_id === itemDialog.categoryId).length}
          onClose={() => setItemDialog(null)}
          onSaved={refresh}
        />
      )}
      {bulkOpen && (
        <BulkPriceDialog
          businessId={business.id}
          itemIds={[...selected]}
          onClose={() => setBulkOpen(false)}
          onApplied={() => { setSelected(new Set()); refresh(); }}
        />
      )}
    </div>
  );
}

function CategoryDialog({
  businessId, category, nextOrder, onClose, onSaved,
}: { businessId: string; category: MenuCategory | null; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [description, setDescription] = useState(category?.description ?? '');
  const [visible, setVisible] = useState(category?.is_visible ?? true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = categorySchema.safeParse({ name, description, is_visible: visible });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    const { error } = category
      ? await supabase.from('menu_categories').update(parsed.data).eq('id', category.id)
      : await supabase.from('menu_categories').insert({ ...parsed.data, business_id: businessId, sort_order: nextOrder });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    toast.success('Kategori kaydedildi');
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{category ? 'Kategoriyi düzenle' : 'Yeni kategori'}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4" noValidate>
          <Field label="Kategori adı" htmlFor="cat-name" error={error ?? undefined}>
            <Input id="cat-name" autoFocus placeholder="ör. Kahveler" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Açıklama (isteğe bağlı)" htmlFor="cat-desc">
            <Textarea id="cat-desc" rows={2} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm"><Switch checked={visible} onCheckedChange={setVisible} /> Menüde görünür</label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Vazgeç</Button>
            <Button type="submit" disabled={busy}>Kaydet</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
