import { useQuery } from '@tanstack/react-query';
import { MEDIA_BUCKET, supabase } from './supabase';
import { compressImage, type ImageKind } from './images';

/** Görseli sıkıştırıp işletmenin klasörüne yükler, depolama yolunu döner. */
export async function uploadBusinessImage(businessId: string, kind: ImageKind, file: File): Promise<string> {
  const blob = await compressImage(file, kind);
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${businessId}/${kind}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function uploadBusinessPdf(businessId: string, file: File): Promise<string> {
  if (file.type !== 'application/pdf') throw new Error('Yalnızca PDF yüklenebilir.');
  if (file.size > 5 * 1024 * 1024) throw new Error('PDF 5 MB’tan büyük olamaz.');
  const path = `${businessId}/documents/${crypto.randomUUID()}.pdf`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType: 'application/pdf' });
  if (error) throw error;
  return path;
}

export async function removeMedia(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => Boolean(p));
  if (list.length) await supabase.storage.from(MEDIA_BUCKET).remove(list);
}

/**
 * Kova özel olduğundan görseller imzalı URL ile gösterilir. RLS, yalnızca yayındaki
 * işletmelerin (veya üyeler/yöneticiler için kendi işletmelerinin) dosyalarına izin verir.
 */
export function useSignedUrls(paths: (string | null | undefined)[]) {
  const list = Array.from(new Set(paths.filter((p): p is string => Boolean(p)))).sort();
  return useQuery({
    queryKey: ['signed-urls', list],
    enabled: list.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(list, 60 * 60);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) if (row.path && row.signedUrl) map[row.path] = row.signedUrl;
      return map;
    },
  });
}
