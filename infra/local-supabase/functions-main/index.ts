// Yerel edge-runtime ana yönlendiricisi: /<fonksiyon-adı>/... isteğini
// supabase/functions/<fonksiyon-adı> çalışanına iletir. (Barındırılan
// Supabase'de bu dosyaya gerek yoktur.)
// deno-lint-ignore-file no-explicit-any
declare const EdgeRuntime: any;

const NAME_RE = /^[a-z0-9-]{1,64}$/;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const name = url.pathname.split('/')[1] ?? '';
  if (!NAME_RE.test(name) || name.startsWith('_')) {
    return Response.json({ code: 'NOT_FOUND', message: 'Fonksiyon bulunamadı' }, { status: 404 });
  }
  const envVars = Object.entries(Deno.env.toObject());
  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath: `/home/deno/functions/${name}`,
      memoryLimitMb: 256,
      workerTimeoutMs: 120_000,
      noModuleCache: false,
      envVars,
      forceCreate: false,
      cpuTimeSoftLimitMs: 10_000,
      cpuTimeHardLimitMs: 20_000,
    });
    return await worker.fetch(req);
  } catch (e) {
    console.error('worker error', e);
    return Response.json({ code: 'BOOT_ERROR', message: String(e) }, {
      status: 503,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
});
