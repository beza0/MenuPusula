// Ortak HTTP yardımcıları (Edge Functions). Harici bağımlılık yok.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Eksik ortam değişkeni: ${name}`);
  return v;
}

export interface AuthedUser {
  id: string;
  email?: string;
  token: string;
}

/** İsteği yapan kullanıcıyı Supabase Auth'a sorarak doğrular (JWT imzası sunucuda kontrol edilir). */
export async function requireUser(req: Request): Promise<AuthedUser | Response> {
  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) return json({ code: 'unauthorized', message: 'Giriş yapmanız gerekiyor' }, 401);
  const res = await fetch(`${env('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: env('SUPABASE_ANON_KEY') },
  });
  if (!res.ok) return json({ code: 'unauthorized', message: 'Oturum geçersiz' }, 401);
  const user = await res.json();
  if (!user?.id) return json({ code: 'unauthorized', message: 'Oturum geçersiz' }, 401);
  return { id: user.id, email: user.email, token };
}

/** Kullanıcının kendi yetkisiyle (RLS geçerli) PostgREST RPC çağrısı. */
export async function rpcAsUser<T>(user: AuthedUser, fn: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${user.token}`,
      apikey: env('SUPABASE_ANON_KEY'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message ?? `RPC ${fn} başarısız (${res.status})`);
  return body as T;
}
