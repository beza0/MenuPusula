import pg from 'pg';
import { randomUUID } from 'node:crypto';

export const API_URL = `http://localhost:${process.env.API_PORT ?? 54321}`;
export const MAILPIT = `http://localhost:${process.env.MAILPIT_PORT ?? 54324}`;

export const db = () =>
  new pg.Client({
    host: '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 54322),
    user: 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    database: 'postgres',
  });

export const uniqueEmail = (p: string) => `${p}-${randomUUID().slice(0, 8)}@e2e.menuatlasi.local`;

/** Test yöneticisi: service-role YALNIZCA test kurulumunda kullanılır. */
export async function createConfirmedUser(email: string, password: string, admin = false) {
  const res = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: process.env.SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${process.env.SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const user = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(user));
  if (admin) {
    const c = db();
    await c.connect();
    await c.query('insert into public.admin_users (user_id, note) values ($1, $2)', [user.id, 'e2e']);
    await c.end();
  }
  return user.id as string;
}

/** Mailpit'ten doğrulama bağlantısını okur. */
export async function confirmationLink(email: string): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
    const list = await r.json();
    const id = list.messages?.[0]?.ID;
    if (id) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
      const m = /(http[^\s"<>]+\/auth\/v1\/verify[^\s"<>]+)/.exec(msg.Text ?? msg.HTML);
      if (m) return m[1].replace(/&amp;/g, '&');
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error(`Doğrulama e-postası bulunamadı: ${email}`);
}
