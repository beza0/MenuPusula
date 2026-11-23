import { brand } from '@/config/brand';

export function ConfigMissing() {
  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="text-xl font-semibold">{brand.appName}: yapılandırma eksik</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <code>VITE_SUPABASE_URL</code> ve <code>VITE_SUPABASE_ANON_KEY</code> ortam değişkenleri tanımlı değil.
        <code> apps/business-web/.env.example</code> dosyasını <code>.env.local</code> olarak kopyalayıp doldurun.
      </p>
    </div>
  );
}
