// Uçtan uca işletme akışı (gerçek yerel Supabase yığını):
// kayıt → e-posta doğrulama → işletme taslağı → menü → saatler → incelemeye gönder →
// yayında değilken QR menü kapalı → yönetici onayı → QR menüde görünür → fiyat güncellemesi
// QR'da görünür, URL değişmez → toplu fiyat güncelleme önizleme + onay.
import { expect, test, type Page } from '@playwright/test';
import { confirmationLink, createConfirmedUser, uniqueEmail } from './helpers';

const PASSWORD = 'Test-Sifre-12345';

test('işletme sahibi menüsünü yayınlar ve günceller', async ({ page, browser }) => {
  const ownerEmail = uniqueEmail('owner');
  const businessName = `E2E Kafe ${Date.now().toString(36)}`;

  // 1) Kayıt + e-posta doğrulama
  await page.goto('/kayit');
  await page.getByLabel('E-posta').fill(ownerEmail);
  await page.getByLabel('Şifre').fill(PASSWORD);
  await page.getByRole('checkbox').click();
  await page.getByRole('button', { name: 'Hesap oluştur' }).click();
  await expect(page.getByText('E-postanızı doğrulayın')).toBeVisible();

  // Doğrulanmadan giriş yapılamaz
  await page.goto('/giris');
  await page.getByLabel('E-posta').fill(ownerEmail);
  await page.getByLabel('Şifre').fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByText('E-posta adresiniz henüz doğrulanmadı')).toBeVisible();

  await page.goto(await confirmationLink(ownerEmail));
  await expect(page.getByRole('heading', { name: 'İşletmelerim' })).toBeVisible();
  await expect(page.getByText('Henüz işletmeniz yok')).toBeVisible();

  // 2) İşletme taslağı
  await page.getByRole('link', { name: 'İşletme ekle' }).click();
  await page.getByLabel('İşletme adı *').fill(businessName);
  await page.getByLabel('Telefon').fill('+90 216 555 12 34');
  await page.getByLabel('Adres').fill('Moda Caddesi No: 10');
  await page.getByLabel('İlçe').fill('Kadıköy');
  await page.getByLabel('Şehir').fill('İstanbul');
  await page.getByLabel('Enlem').fill('40.9875');
  await page.getByLabel('Boylam').fill('29.0262');
  await page.getByLabel('Boylam').blur();
  await page.getByText('Kahve', { exact: true }).click();
  await page.getByRole('button', { name: 'Taslağı oluştur' }).click();
  await expect(page.getByText('Taslak — henüz herkese açık değil.')).toBeVisible();

  // Eksik bilgiyle gönderme sunucu tarafından reddedilir
  await page.getByRole('button', { name: 'İncelemeye gönder' }).click();
  await expect(page.getByText(/Eksik bilgiler: .*çalışma saatleri/)).toBeVisible();

  // 3) Menü
  await page.getByRole('button', { name: 'İlk kategoriyi ekle' }).click();
  await page.getByLabel('Kategori adı').fill('Kahveler');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByRole('heading', { name: 'Kahveler' })).toBeVisible();
  await addItem(page, 'Latte', '95,50');
  await addItem(page, 'Filtre Kahve', '70');
  await expect(page.getByText('₺95,50')).toBeVisible();

  // 4) Çalışma saatleri (gece yarısını geçen)
  await page.getByRole('tab', { name: 'Çalışma saatleri' }).click();
  await page.getByRole('button', { name: 'Aralık' }).first().click();
  await page.getByLabel('Pazartesi açılış').fill('08:00');
  await page.getByLabel('Pazartesi kapanış').fill('01:00');
  await expect(page.getByText('ertesi gün')).toBeVisible();
  await page.getByTitle('Bu günü tüm günlere kopyala').click();
  await page.getByRole('button', { name: 'Saatleri kaydet' }).click();
  await expect(page.getByText('Çalışma saatleri kaydedildi').last()).toBeVisible();

  // QR URL'si (kalıcı)
  await page.getByRole('tab', { name: 'QR menü' }).click();
  const qrUrl = (await page.locator('code').first().textContent())!.trim();
  expect(qrUrl).toMatch(/\/m\/[a-z0-9]{10}$/);
  await expect(page.getByRole('img', { name: /QR menü kodu/ })).toBeVisible();

  // 5) İncelemeye gönder
  await page.getByRole('button', { name: 'İncelemeye gönder' }).click();
  await expect(page.getByText('Başvurunuz incelemeye gönderildi').last()).toBeVisible();
  await expect(page.getByText('İncelemede', { exact: true }).first()).toBeVisible();

  // 6) Onay öncesi ziyaretçi menüyü göremez
  const visitor = await browser.newPage();
  await visitor.goto(qrUrl);
  await expect(visitor.getByText('Bu menü şu anda görüntülenemiyor')).toBeVisible();

  // 7) Yönetici onayı
  const adminEmail = uniqueEmail('admin');
  await createConfirmedUser(adminEmail, PASSWORD, true);
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, adminEmail);
  await admin.getByRole('link', { name: 'Yönetim' }).click();
  await admin.getByRole('link', { name: new RegExp(businessName) }).click();
  await expect(admin.getByRole('heading', { name: 'Menü önizlemesi' })).toBeVisible();
  await expect(admin.getByText('Latte')).toBeVisible();
  await admin.getByRole('button', { name: 'Onayla ve yayınla' }).click();
  await expect(admin.getByText('İşletme yayınlandı').last()).toBeVisible();

  // 8) Ziyaretçi (hesapsız) QR menüyü görür
  await visitor.reload();
  await expect(visitor.getByRole('heading', { name: businessName })).toBeVisible();
  await expect(visitor.getByText('₺95,50')).toBeVisible();
  await expect(visitor.getByText('Doğrulanmış')).toHaveCount(0); // onay ≠ doğrulama

  // 9) Sahip fiyatı günceller → QR menüde görünür, URL aynı
  await page.reload();
  await page.getByRole('tab', { name: 'Menü', exact: true }).click();
  await page.locator('li', { hasText: 'Latte' }).getByRole('button', { name: 'Ürünü düzenle' }).click();
  await page.getByLabel('Fiyat (₺) *').fill('110');
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByText('Ürün kaydedildi').last()).toBeVisible();
  await page.getByRole('tab', { name: 'QR menü' }).click();
  expect((await page.locator('code').first().textContent())!.trim()).toBe(qrUrl);
  await visitor.reload();
  await expect(visitor.getByText('₺110')).toBeVisible();

  // 10) Toplu fiyat güncelleme: önizleme → onay
  await page.getByRole('tab', { name: 'Menü', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Kahveler kategorisindeki tüm ürünleri seç' }).click();
  await page.getByRole('button', { name: /Toplu fiyat \(2\)/ }).click();
  await page.getByLabel('Değişim (%)').fill('10');
  await page.getByRole('button', { name: 'Önizle' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('₺121')).toBeVisible();
  await expect(dialog.getByText('₺77')).toBeVisible();
  // Önizleme henüz yazmadı
  await visitor.reload();
  await expect(visitor.getByText('₺110')).toBeVisible();
  await dialog.getByRole('button', { name: /Onayla ve 2 fiyatı güncelle/ }).click();
  await expect(page.getByText('2 fiyat güncellendi').last()).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByText('₺121')).toBeVisible();
  await expect(visitor.getByText('₺77')).toBeVisible();

  // "Fiyatları kontrol ettim" ayrı tarih
  await page.getByRole('button', { name: 'Fiyatları kontrol ettim' }).click();
  await expect(page.getByText('Fiyatların kontrol edildiği kaydedildi').last()).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByText(/Fiyatlar işletme tarafından son kontrol edildi/)).toBeVisible();

  await adminCtx.close();
});

test('normal kullanıcı yönetim sayfasına erişemez', async ({ page }) => {
  const email = uniqueEmail('plain');
  await createConfirmedUser(email, PASSWORD);
  await login(page, email);
  await expect(page.getByRole('link', { name: 'Yönetim' })).toHaveCount(0);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/panel$/);
});

async function addItem(page: Page, name: string, price: string) {
  await page.getByRole('button', { name: 'Ürün ekle' }).first().click();
  await page.getByLabel('Ürün adı *').fill(name);
  await page.getByLabel('Fiyat (₺) *').fill(price);
  await page.getByRole('button', { name: 'Kaydet' }).click();
  await expect(page.getByText('Ürün kaydedildi').last()).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function login(page: Page, email: string) {
  await page.goto('/giris');
  await page.getByLabel('E-posta').fill(email);
  await page.getByLabel('Şifre').fill(PASSWORD);
  await page.getByRole('button', { name: 'Giriş yap' }).click();
  await expect(page.getByRole('heading', { name: 'İşletmelerim' })).toBeVisible();
}
