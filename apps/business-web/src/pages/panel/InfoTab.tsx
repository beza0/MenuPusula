import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { FileText, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ImageField } from '@/components/ImageField';
import { errorMessage } from '@/lib/errors';
import { qk } from '@/lib/queries';
import type { BusinessInfo } from '@/lib/schemas';
import { MEDIA_BUCKET, supabase } from '@/lib/supabase';
import { removeMedia, uploadBusinessPdf } from '@/lib/storage';
import type { Business } from '@/lib/types';
import { BusinessInfoForm, toBusinessRow } from './BusinessInfoForm';

export function InfoTab({ business: b }: { business: Business & { cuisines: string[] } }) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.business(b.id) });
    qc.invalidateQueries({ queryKey: qk.myBusinesses });
  };

  const save = async (v: BusinessInfo) => {
    try {
      const { error } = await supabase.from('businesses').update(toBusinessRow(v)).eq('id', b.id);
      if (error) throw error;
      const removed = b.cuisines.filter((c) => !v.cuisines.includes(c));
      const added = v.cuisines.filter((c) => !b.cuisines.includes(c));
      if (removed.length) {
        const { error: e1 } = await supabase.from('business_cuisines').delete().eq('business_id', b.id).in('cuisine_id', removed);
        if (e1) throw e1;
      }
      if (added.length) {
        const { error: e2 } = await supabase.from('business_cuisines').insert(added.map((cuisine_id) => ({ business_id: b.id, cuisine_id })));
        if (e2) throw e2;
      }
      toast.success('Bilgiler kaydedildi');
      refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const setMedia = async (field: 'logo_path' | 'cover_path' | 'menu_pdf_path', path: string | null) => {
    const old = b[field];
    const { error } = await supabase.from('businesses').update({ [field]: path }).eq('id', b.id);
    if (error) {
      await removeMedia([path]);
      throw error;
    }
    if (old && old !== path) await removeMedia([old]);
    refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader><CardTitle>İşletme bilgileri</CardTitle></CardHeader>
        <CardContent>
          <BusinessInfoForm
            key={b.updated_at}
            submitLabel="Kaydet"
            onSubmit={save}
            defaultValues={{
              name: b.name, type: b.type, cuisines: b.cuisines, description: b.description ?? '', phone: b.phone ?? '',
              website_url: b.website_url ?? '', instagram_url: b.instagram_url ?? '', facebook_url: b.facebook_url ?? '',
              address_line: b.address_line ?? '', district: b.district ?? '', city: b.city ?? '',
              latitude: b.latitude, longitude: b.longitude,
            }}
          />
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Görseller</CardTitle>
            <CardDescription>Görseller yüklenmeden önce otomatik olarak küçültülür. İşletme yayınlanana kadar herkese açık değildir.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ImageField businessId={b.id} kind="logo" label="Logo" aspect="aspect-square w-32" path={b.logo_path} onChange={(p) => setMedia('logo_path', p)} />
            <ImageField businessId={b.id} kind="cover" label="Kapak görseli" path={b.cover_path} onChange={(p) => setMedia('cover_path', p)} />
          </CardContent>
        </Card>
        <PdfCard business={b} onChange={(p) => setMedia('menu_pdf_path', p)} />
        <DeleteBusinessCard business={b} />
      </div>
    </div>
  );
}

function PdfCard({ business: b, onChange }: { business: Business; onChange: (p: string | null) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const pick = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadBusinessPdf(b.id, file);
      await onChange(path);
      toast.success('PDF eklendi');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ek PDF menü (isteğe bağlı)</CardTitle>
        <CardDescription>Menü her zaman yapılandırılmış verilerden gösterilir; PDF yalnızca ek belge olarak sunulur.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        {b.menu_pdf_path && <span className="flex items-center gap-1 text-sm"><FileText className="size-4" /> PDF yüklü</span>}
        <label className="inline-flex">
          <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
          <span className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border bg-white px-3 text-sm hover:bg-muted"><Upload className="size-4" /> {b.menu_pdf_path ? 'Değiştir' : 'PDF yükle'}</span>
        </label>
        {b.menu_pdf_path && <Button variant="ghost" size="sm" onClick={() => onChange(null)}><Trash2 /> Kaldır</Button>}
      </CardContent>
    </Card>
  );
}

function DeleteBusinessCard({ business: b }: { business: Business }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const remove = async () => {
    setBusy(true);
    try {
      // Önce dosyaları temizle (veritabanı silinince yollar kaybolur).
      for (const folder of ['logo', 'cover', 'items', 'documents']) {
        const { data } = await supabase.storage.from(MEDIA_BUCKET).list(`${b.id}/${folder}`, { limit: 1000 });
        await removeMedia((data ?? []).map((f) => `${b.id}/${folder}/${f.name}`));
      }
      const { error, count } = await supabase.from('businesses').delete({ count: 'exact' }).eq('id', b.id);
      if (error) throw error;
      if (!count) throw new Error('İşletmeyi yalnızca sahibi silebilir.');
      toast.success('İşletme silindi');
      await qc.invalidateQueries({ queryKey: qk.myBusinesses });
      navigate('/panel');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-danger">İşletmeyi sil</CardTitle>
        <CardDescription>İşletme, menüsü, görselleri ve istatistikleri kalıcı olarak silinir. QR bağlantısı çalışmaz.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="destructive" size="sm" onClick={() => setOpen(true)}><Trash2 /> İşletmeyi sil</Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>“{b.name}” silinsin mi?</DialogTitle>
              <DialogDescription>Bu işlem geri alınamaz. Onaylamak için işletme adını yazın.</DialogDescription>
            </DialogHeader>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="İşletme adı" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Vazgeç</Button>
              <Button variant="destructive" disabled={busy || confirmText.trim() !== b.name} onClick={remove}>Kalıcı olarak sil</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
