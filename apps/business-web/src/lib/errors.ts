/** Supabase/PostgREST hatalarını kullanıcıya anlaşılır Türkçe mesaja çevirir. */
export function errorMessage(err: unknown): string {
  if (!err) return 'Bilinmeyen bir hata oluştu.';
  const e = err as { message?: string; code?: string; status?: number; name?: string };
  const msg = e.message ?? String(err);
  if (e.name === 'TypeError' && /fetch/i.test(msg)) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
  if (msg === 'Invalid login credentials') return 'E-posta veya şifre hatalı.';
  if (msg === 'Email not confirmed') return 'E-posta adresiniz henüz doğrulanmadı. Gelen kutunuzdaki bağlantıya tıklayın.';
  if (/User already registered/i.test(msg)) return 'Bu e-posta ile kayıtlı bir hesap zaten var.';
  if (/Password should be at least/i.test(msg)) return 'Şifre en az 8 karakter olmalı.';
  if (/rate limit/i.test(msg)) return 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.';
  if (e.code === '42501' && /row-level security/.test(msg)) return 'Bu işlem için yetkiniz yok.';
  if (e.code === '23505') return 'Bu kayıt zaten mevcut.';
  if (/mime type/i.test(msg)) return 'Bu dosya türü desteklenmiyor.';
  if (/exceeded the maximum allowed size|Payload too large/i.test(msg)) return 'Dosya çok büyük.';
  return msg;
}
