import { supabase } from './supabase';

/**
 * Anonim, rastgele istemci kimliği (kişisel veri değildir). Sunucu bunu günlük tuzla
 * hash'leyerek yalnızca tekrar sayımı engellemek için kullanır. Konum gönderilmez.
 */
function clientId(): string {
  const key = 'ma_client_id';
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export async function logEvent(businessId: string, type: 'business_view' | 'menu_view') {
  try {
    await supabase.rpc('log_event', { p_business_id: businessId, p_event_type: type, p_source: 'web', p_client_id: clientId() });
  } catch {
    /* ölçüm hatası kullanıcı deneyimini etkilemez */
  }
}
