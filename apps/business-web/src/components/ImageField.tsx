import { useRef, useState } from 'react';
import { ImageOff, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { errorMessage } from '@/lib/errors';
import { validateImageFile, type ImageKind } from '@/lib/images';
import { uploadBusinessImage, useSignedUrls } from '@/lib/storage';
import { cn } from '@/lib/utils';

/** Görsel yükleme alanı: sıkıştırır, yükler ve yeni depolama yolunu bildirir. */
export function ImageField({
  businessId, kind, path, onChange, label, aspect = 'aspect-video',
}: {
  businessId: string;
  kind: ImageKind;
  path: string | null;
  onChange: (path: string | null) => Promise<void> | void;
  label: string;
  aspect?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const { data: urls } = useSignedUrls([path]);
  const url = path ? urls?.[path] : undefined;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const err = validateImageFile(file);
    if (err) return toast.error(err);
    setBusy(true);
    try {
      const newPath = await uploadBusinessImage(businessId, kind, file);
      await onChange(newPath);
      toast.success(`${label} güncellendi`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className={cn('relative flex items-center justify-center overflow-hidden rounded-lg border bg-muted', aspect)}>
        {url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
            <ImageOff className="size-6" /> Görsel yok
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="size-6 animate-spin" />
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          <Upload /> {path ? 'Değiştir' : 'Yükle'}
        </Button>
        {path && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange(null)}>
            <Trash2 /> Kaldır
          </Button>
        )}
      </div>
    </div>
  );
}
