// AI ile menü aktarma (isteğe bağlı, ikinci aşama).
// GET  → yapılandırma durumu ve sınırlar
// POST {business_id, paths[]} → dosyaları okur, sağlayıcıyla çıkarır, TASLAK kaydeder.
// Hiçbir ürün burada menüye eklenmez; işletme panelde düzeltip apply_menu_import ile onaylar.
import { corsHeaders, env, json, requireUser, rpcAsUser } from '../_shared/http.ts';
import { LIMITS, mimeFromPath, normalizeExtraction, type SourceFile, validateFiles } from '../_shared/menu-extraction.ts';
import { createProvider, providerStatus } from './providers.ts';

const dailyLimit = () => Math.max(0, Number(Deno.env.get('MENU_IMPORT_DAILY_LIMIT') ?? '10') || 0);

async function service(path: string, init: RequestInit = {}) {
  const key = env('SUPABASE_SERVICE_ROLE_KEY');
  return fetch(`${env('SUPABASE_URL')}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

async function saveJob(row: Record<string, unknown>) {
  const res = await service('/rest/v1/menu_import_jobs', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`Taslak kaydedilemedi (${res.status})`);
  return (await res.json())[0];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await requireUser(req);
    if (user instanceof Response) return user;
    const status = providerStatus();

    if (req.method === 'GET') {
      return json({ configured: status.configured, provider: status.provider, reason: status.reason ?? null, limits: { ...LIMITS, dailyPerBusiness: dailyLimit() } });
    }
    if (req.method !== 'POST') return json({ code: 'method_not_allowed', message: 'Yalnızca GET/POST' }, 405);
    if (!status.configured) {
      return json({ code: 'not_configured', message: 'AI ile menü aktarma yapılandırılmamış. Menüyü elle ekleyebilirsiniz.', reason: status.reason }, 503);
    }

    const body = await req.json().catch(() => null);
    const businessId: string | undefined = body?.business_id;
    const paths: unknown = body?.paths;
    if (!businessId || !Array.isArray(paths) || !paths.every((p) => typeof p === 'string')) {
      return json({ code: 'bad_request', message: 'business_id ve paths gerekli' }, 400);
    }
    const isMember = await rpcAsUser<boolean>(user, 'is_business_member', { p_business_id: businessId });
    if (!isMember) return json({ code: 'forbidden', message: 'Bu işletme üzerinde yetkiniz yok' }, 403);
    if ((paths as string[]).some((p) => !p.startsWith(`${businessId}/`) || p.includes('..'))) {
      return json({ code: 'bad_request', message: 'Geçersiz dosya yolu' }, 400);
    }

    // Maliyet kontrolü: işletme başına günlük sınır
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const countRes = await service(
      `/rest/v1/menu_import_jobs?select=id&business_id=eq.${businessId}&created_at=gte.${since}`,
      { headers: { Prefer: 'count=exact', Range: '0-0' } },
    );
    const used = Number(countRes.headers.get('content-range')?.split('/')[1] ?? '0');
    if (used >= dailyLimit()) {
      return json({ code: 'rate_limited', message: `Günlük aktarım sınırına ulaşıldı (${dailyLimit()}). Yarın tekrar deneyin.` }, 429);
    }

    const files: SourceFile[] = [];
    for (const path of paths as string[]) {
      const mime = mimeFromPath(path);
      if (!mime) return json({ code: 'bad_request', message: 'Desteklenmeyen dosya türü' }, 400);
      const res = await service(`/storage/v1/object/menu-imports/${path.split('/').map(encodeURIComponent).join('/')}`);
      if (!res.ok) return json({ code: 'not_found', message: 'Dosya bulunamadı' }, 404);
      files.push({ path, mime, bytes: new Uint8Array(await res.arrayBuffer()) });
    }
    const check = validateFiles(files);
    if (!check.ok) return json({ code: 'limit', message: check.message }, 400);

    const provider = createProvider();
    try {
      const raw = await provider.extract(files);
      const draft = normalizeExtraction(raw);
      const job = await saveJob({
        business_id: businessId, created_by: user.id, status: 'ready', provider: provider.name, model: provider.model,
        source_paths: paths, page_count: check.pages, draft, input_tokens: raw.inputTokens ?? null, output_tokens: raw.outputTokens ?? null,
      });
      return json({ job_id: job.id, draft });
    } catch (e) {
      console.error('extraction failed', e);
      await saveJob({
        business_id: businessId, created_by: user.id, status: 'failed', provider: provider.name, model: provider.model,
        source_paths: paths, page_count: check.pages, error: String((e as Error).message).slice(0, 500),
      }).catch(() => {});
      return json({ code: 'extraction_failed', message: (e as Error).message || 'Menü okunamadı' }, 502);
    }
  } catch (e) {
    console.error(e);
    return json({ code: 'internal', message: 'Beklenmeyen bir hata oluştu' }, 500);
  }
});
