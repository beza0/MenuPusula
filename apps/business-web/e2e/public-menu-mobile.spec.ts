// QR menü küçük ekranda: hesap gerektirmez, yatay taşma yok, menü içi arama ve kategori sekmeleri çalışır.
import { expect, test } from '@playwright/test';
import { db } from './helpers';

let publicId = '';

test.beforeAll(async () => {
  const c = db();
  await c.connect();
  // Doğrudan veritabanı (postgres rolü) ile yayınlanmış test işletmesi; istemci korumaları bu rolde uygulanmaz.
  const { rows } = await c.query(
    `insert into public.businesses (name, type, phone, address_line, district, city, latitude, longitude, status, published_at, description)
     values ('Çok Uzun İsimli Mobil Test Kahvecisi ve Tatlı Evi', 'cafe', '+90 212 000 00 00', 'Uzun Bir Cadde Adı Mahallesi Sokak No: 123/4', 'Beşiktaş', 'İstanbul', 41.04, 29.0, 'published', now(),
       'Mobil görünüm testi için uzun açıklama metni. Satır kaydırma ve taşma kontrolü yapılır.')
     returning id, public_id`,
  );
  publicId = rows[0].public_id;
  const bid = rows[0].id;
  const cats = ['Sıcak Kahveler', 'Soğuk İçecekler', 'Tatlılar', 'Kahvaltılıklar', 'Atıştırmalıklar'];
  for (const [i, name] of cats.entries()) {
    const { rows: cr } = await c.query('insert into public.menu_categories (business_id, name, sort_order) values ($1,$2,$3) returning id', [bid, name, i]);
    for (let j = 0; j < 4; j++) {
      await c.query('insert into public.menu_items (business_id, category_id, name, description, price_cents, sort_order) values ($1,$2,$3,$4,$5,$6)', [
        bid, cr[0].id, `${name} Ürün ${j + 1}`, j === 0 ? 'Oldukça uzun bir ürün açıklaması; içerik bilgisi ve sunum detayları burada yer alır.' : null, 4500 + j * 1250, j,
      ]);
    }
  }
  await c.query("insert into public.business_hours (business_id, weekday, opens_at, closes_at) select $1, d, '08:00', '02:00' from generate_series(1,7) d", [bid]);
  await c.end();
});

test('QR menü mobilde taşmadan çalışır', async ({ page }) => {
  await page.goto(`/m/${publicId}`);
  await expect(page.getByRole('heading', { name: /Mobil Test Kahvecisi/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole('link', { name: 'Tatlılar' }).click();
  await expect(page.getByRole('heading', { name: 'Tatlılar', exact: true })).toBeInViewport();

  await page.getByRole('searchbox', { name: 'Menüde ara' }).fill('soğuk');
  await expect(page.getByText('Soğuk İçecekler Ürün 1')).toBeVisible();
  await expect(page.getByText('Sıcak Kahveler Ürün 1')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/qr-menu-mobile.png', fullPage: false });
});

test('olmayan veya yayında olmayan menü anlaşılır mesaj gösterir', async ({ page }) => {
  await page.goto('/m/yokboylebir');
  await expect(page.getByText('Bu menü şu anda görüntülenemiyor')).toBeVisible();
});

test('bağlantı kesintisinde hata ve tekrar dene gösterilir', async ({ page, context }) => {
  await context.route('**/rest/v1/rpc/get_public_business', (route) => route.abort('internetdisconnected'));
  await page.goto(`/m/${publicId}`);
  await expect(page.getByText('Menü yüklenemedi')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Sunucuya ulaşılamadı/)).toBeVisible();
  await context.unroute('**/rest/v1/rpc/get_public_business');
  await page.getByRole('button', { name: 'Tekrar dene' }).click();
  await expect(page.getByRole('heading', { name: /Mobil Test Kahvecisi/ })).toBeVisible();
});
