// Hesap silme. Service-role anahtarı yalnızca bu sunucu fonksiyonunda kullanılır.
// Politika: Kullanıcı, başka sahibi olmayan bir işletmenin tek sahibiyse silme
// engellenir (işletmeler sessizce sahipsiz bırakılmaz). Aksi halde auth kullanıcısı
// silinir; profiles/favorites/business_members kaskadla silinir, gönderilen
// bildirimlerde reporter_id NULL yapılır (moderasyon geçmişi korunur).
import { corsHeaders, env, json, requireUser, rpcAsUser } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ code: 'method_not_allowed', message: 'Yalnızca POST' }, 405);

  try {
    const user = await requireUser(req);
    if (user instanceof Response) return user;

    const blockers = await rpcAsUser<{ business_id: string; business_name: string }[]>(user, 'account_deletion_blockers', {});
    if (blockers.length > 0) {
      return json({
        code: 'sole_owner',
        message: `Tek sahibi olduğunuz işletmeler var (${blockers.map((b) => b.business_name).join(', ')}). Önce bu işletmeleri silin.`,
        businesses: blockers,
      }, 409);
    }

    const res = await fetch(`${env('SUPABASE_URL')}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`, apikey: env('SUPABASE_SERVICE_ROLE_KEY') },
    });
    if (!res.ok) {
      console.error('delete user failed', res.status, await res.text());
      return json({ code: 'delete_failed', message: 'Hesap silinemedi. Lütfen daha sonra tekrar deneyin.' }, 500);
    }
    return json({ deleted: true });
  } catch (e) {
    console.error(e);
    return json({ code: 'internal', message: 'Beklenmeyen bir hata oluştu' }, 500);
  }
});
