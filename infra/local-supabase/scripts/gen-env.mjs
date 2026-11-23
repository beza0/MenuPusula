// Yerel geliştirme için rastgele JWT sırrı ve anon/service_role anahtarları üretir.
// Çıktı: infra/local-supabase/.env (git'e eklenmez). Üretim anahtarı DEĞİLDİR.
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
if (existsSync(envPath) && !process.argv.includes('--force')) {
  console.log('.env zaten var (yeniden üretmek için --force)');
  process.exit(0);
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const secret = randomBytes(40).toString('hex');
const sign = (payload) => {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
};
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 365 * 5;
const anon = sign({ role: 'anon', iss: 'supabase-local', iat, exp });
const service = sign({ role: 'service_role', iss: 'supabase-local', iat, exp });

const env = `# YEREL GELİŞTİRME ANAHTARLARI — scripts/gen-env.mjs tarafından üretildi. Repoya eklemeyin.
POSTGRES_PASSWORD=${randomBytes(24).toString('hex')}
JWT_SECRET=${secret}
ANON_KEY=${anon}
SERVICE_ROLE_KEY=${service}
API_PORT=54321
DB_PORT=54322
MAILPIT_PORT=54324
SUPABASE_PUBLIC_URL=http://localhost:54321
API_EXTERNAL_URL=http://localhost:54321/auth/v1
SITE_URL=http://localhost:5173
ADDITIONAL_REDIRECT_URLS=http://localhost:5173/**,menuatlasi://**
# İsteğe bağlı AI menü aktarma (yalnızca sunucu):
MENU_IMPORT_PROVIDER=
ANTHROPIC_API_KEY=
MENU_IMPORT_MODEL=
MENU_IMPORT_DAILY_LIMIT=10
`;
writeFileSync(envPath, env, { mode: 0o600 });
console.log('.env oluşturuldu:', envPath);
