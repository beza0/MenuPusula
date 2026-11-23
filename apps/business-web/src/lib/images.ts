/**
 * Görselleri yüklemeden önce tarayıcıda yeniden boyutlandırır ve sıkıştırır.
 * Sunucu tarafında da kova boyut/tür sınırları uygulanır (5 MB, jpeg/png/webp).
 */
export const IMAGE_PRESETS = {
  logo: { maxWidth: 512, maxHeight: 512, quality: 0.85 },
  cover: { maxWidth: 1600, maxHeight: 900, quality: 0.8 },
  items: { maxWidth: 1000, maxHeight: 1000, quality: 0.8 },
} as const;

export type ImageKind = keyof typeof IMAGE_PRESETS;

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_INPUT_BYTES = 15 * 1024 * 1024;

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED.includes(file.type)) return 'Yalnızca JPEG, PNG veya WebP görseller yüklenebilir.';
  if (file.size > MAX_INPUT_BYTES) return 'Görsel 15 MB’tan büyük olamaz.';
  return null;
}

export async function compressImage(file: File, kind: ImageKind): Promise<Blob> {
  const preset = IMAGE_PRESETS[kind];
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, preset.maxWidth / bitmap.width, preset.maxHeight / bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Görsel işlenemedi');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, preset.quality));
  const blob = (await toBlob('image/webp')) ?? (await toBlob('image/jpeg'));
  if (!blob) throw new Error('Görsel sıkıştırılamadı');
  if (blob.size > 5 * 1024 * 1024) throw new Error('Sıkıştırılmış görsel 5 MB sınırını aşıyor.');
  return blob;
}
