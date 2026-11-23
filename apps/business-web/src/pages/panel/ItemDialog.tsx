import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox, Switch } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { ImageField } from '@/components/ImageField';
import { DIETARY_TAGS } from '@/lib/constants';
import { errorMessage } from '@/lib/errors';
import { centsToInput, parsePriceToCents } from '@/lib/format';
import { menuItemSchema, type MenuItemInput, type MenuItemOutput } from '@/lib/schemas';
import { removeMedia } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import type { MenuCategory, MenuItem } from '@/lib/types';

export function ItemDialog({
  businessId, categories, item, categoryId, nextOrder, onClose, onSaved,
}: {
  businessId: string;
  categories: MenuCategory[];
  item: MenuItem | null;
  categoryId: string;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [imagePath, setImagePath] = useState<string | null>(item?.image_path ?? null);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<MenuItemInput, unknown, MenuItemOutput>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: item?.name ?? '',
      description: item?.description ?? '',
      category_id: item?.category_id ?? categoryId,
      price: item && !item.has_variants ? centsToInput(item.price_cents) : '',
      variants: (item?.menu_item_variants ?? []).map((v) => ({ id: v.id, name: v.name, price: centsToInput(v.price_cents) })),
      is_available: item?.is_available ?? true,
      is_hidden: item?.is_hidden ?? false,
      tags: item?.menu_item_tags?.map((t) => t.tag) ?? [],
      dietary_info_confirmed: item?.dietary_info_confirmed ?? false,
    },
  });
  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = form;
  const variants = useFieldArray({ control, name: 'variants' });
  const hasVariants = watch('variants').length > 0;

  const close = async () => {
    // Kaydedilmeden yüklenen yeni görsel varsa temizle.
    if (imagePath && imagePath !== item?.image_path) await removeMedia([imagePath]);
    onClose();
  };

  const save = handleSubmit(async (v) => {
    setFormError(null);
    try {
      const variantCents = v.variants.map((x) => x.price);
      const price_cents = variantCents.length ? Math.min(...variantCents) : (parsePriceToCents(v.price) as number);
      const row = {
        name: v.name,
        description: v.description,
        category_id: v.category_id,
        price_cents,
        is_available: v.is_available,
        is_hidden: v.is_hidden,
        dietary_info_confirmed: v.tags.length > 0 && v.dietary_info_confirmed,
        image_path: imagePath,
      };
      let itemId = item?.id;
      if (item) {
        const { error } = await supabase.from('menu_items').update(row).eq('id', item.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('menu_items')
          .insert({ ...row, business_id: businessId, sort_order: nextOrder })
          .select('id')
          .single();
        if (error) throw error;
        itemId = data.id;
      }

      // Varyantlar: silinen / güncellenen / yeni
      const keepIds = v.variants.map((x) => x.id).filter(Boolean) as string[];
      const removed = (item?.menu_item_variants ?? []).filter((x) => !keepIds.includes(x.id)).map((x) => x.id);
      if (removed.length) {
        const { error } = await supabase.from('menu_item_variants').delete().in('id', removed);
        if (error) throw error;
      }
      for (const [idx, x] of v.variants.entries()) {
        const vrow = { name: x.name, price_cents: x.price, sort_order: idx };
        const { error } = x.id
          ? await supabase.from('menu_item_variants').update(vrow).eq('id', x.id)
          : await supabase.from('menu_item_variants').insert({ ...vrow, item_id: itemId, business_id: businessId });
        if (error) throw error;
      }

      // Etiketler
      const oldTags = item?.menu_item_tags?.map((t) => t.tag) ?? [];
      const toRemove = oldTags.filter((t) => !v.tags.includes(t));
      const toAdd = v.tags.filter((t) => !oldTags.includes(t));
      if (toRemove.length) {
        const { error } = await supabase.from('menu_item_tags').delete().eq('item_id', itemId!).in('tag', toRemove);
        if (error) throw error;
      }
      if (toAdd.length) {
        const { error } = await supabase.from('menu_item_tags').insert(toAdd.map((tag) => ({ item_id: itemId, tag })));
        if (error) throw error;
      }
      if (item?.image_path && item.image_path !== imagePath) await removeMedia([item.image_path]);
      toast.success('Ürün kaydedildi');
      onSaved();
      onClose();
    } catch (e) {
      setFormError(errorMessage(e));
    }
  });

  const remove = async () => {
    if (!item || !confirm(`“${item.name}” silinsin mi?`)) return;
    const { error } = await supabase.from('menu_items').delete().eq('id', item.id);
    if (error) return toast.error(errorMessage(error));
    await removeMedia([item.image_path]);
    toast.success('Ürün silindi');
    onSaved();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{item ? 'Ürünü düzenle' : 'Yeni ürün'}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
            <div className="space-y-4">
              <Field label="Ürün adı *" htmlFor="item-name" error={errors.name?.message}>
                <Input id="item-name" autoFocus {...register('name')} aria-invalid={Boolean(errors.name)} />
              </Field>
              <Field label="Açıklama" htmlFor="item-desc" error={errors.description?.message}>
                <Textarea id="item-desc" rows={2} maxLength={500} {...register('description')} />
              </Field>
              <Field label="Kategori" htmlFor="item-cat">
                <NativeSelect id="item-cat" {...register('category_id')}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </NativeSelect>
              </Field>
            </div>
            <ImageField businessId={businessId} kind="items" label="Fotoğraf" aspect="aspect-square" path={imagePath} onChange={setImagePath} />
          </div>

          {!hasVariants && (
            <Field label="Fiyat (₺) *" htmlFor="item-price" error={errors.price?.message} hint="ör. 95 veya 95,50">
              <Input id="item-price" inputMode="decimal" className="max-w-40" {...register('price')} aria-invalid={Boolean(errors.price)} />
            </Field>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Seçenekler / varyantlar</legend>
            <p className="text-xs text-muted-foreground">Küçük/orta/büyük, tek/çift gibi. Varyant eklenirse fiyatlar seçeneklerden alınır ve en düşük fiyat “başlangıç fiyatı” olarak gösterilir.</p>
            {variants.fields.map((f, idx) => (
              <div key={f.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <Input placeholder="Seçenek adı" aria-label="Seçenek adı" {...register(`variants.${idx}.name`)} aria-invalid={Boolean(errors.variants?.[idx]?.name)} />
                  {errors.variants?.[idx]?.name && <p className="text-xs text-danger">{errors.variants[idx]?.name?.message}</p>}
                </div>
                <div className="w-32">
                  <Input placeholder="Fiyat ₺" aria-label="Seçenek fiyatı" inputMode="decimal" {...register(`variants.${idx}.price`)} aria-invalid={Boolean(errors.variants?.[idx]?.price)} />
                  {errors.variants?.[idx]?.price && <p className="text-xs text-danger">{errors.variants[idx]?.price?.message}</p>}
                </div>
                <Button type="button" variant="ghost" size="icon" aria-label="Seçeneği sil" onClick={() => variants.remove(idx)}><Trash2 /></Button>
              </div>
            ))}
            {errors.variants?.message && <p className="text-xs text-danger">{errors.variants.message}</p>}
            <Button type="button" variant="outline" size="sm" onClick={() => variants.append({ name: '', price: '' })}><Plus /> Seçenek ekle</Button>
          </fieldset>

          <div className="flex flex-wrap gap-6">
            <Controller control={control} name="is_available" render={({ field }) => (
              <label className="flex items-center gap-2 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} /> Satışta (kapalıysa “Tükendi”)</label>
            )} />
            <Controller control={control} name="is_hidden" render={({ field }) => (
              <label className="flex items-center gap-2 text-sm"><Switch checked={field.value} onCheckedChange={field.onChange} /> Geçici olarak gizle</label>
            )} />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Beslenme ve alerjen bilgileri (isteğe bağlı)</legend>
            <Controller control={control} name="tags" render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {DIETARY_TAGS.map((t) => (
                  <label key={t.id} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
                    <Checkbox
                      checked={field.value.includes(t.id)}
                      onCheckedChange={(c) => field.onChange(c ? [...field.value, t.id] : field.value.filter((x) => x !== t.id))}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
            )} />
            <Controller control={control} name="dietary_info_confirmed" render={({ field }) => (
              <label className="flex items-start gap-2 text-sm">
                <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} className="mt-0.5" />
                Seçtiğim beslenme ve alerjen bilgilerinin doğru olduğunu işletme olarak doğruluyorum.
              </label>
            )} />
            {errors.dietary_info_confirmed && <p className="text-xs text-danger">{errors.dietary_info_confirmed.message}</p>}
          </fieldset>

          {formError && <Alert variant="danger">{formError}</Alert>}
          <DialogFooter className="sm:justify-between">
            {item ? <Button type="button" variant="ghost" className="text-danger" onClick={remove}><Trash2 /> Sil</Button> : <span />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={close}>Vazgeç</Button>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
