import { Link } from 'react-router-dom';
import { brand } from '@/config/brand';

/**
 * Gizlilik ve kullanım koşulları için SAYFA ALANLARI. Metinler hukuki inceleme sonrası
 * doldurulmalıdır; aşağıdaki bölümler yalnızca uygulamanın fiilen yaptığı veri işlemeyi özetler.
 */
export default function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to="/" className="text-sm text-primary">← {brand.appName}</Link>
      {kind === 'privacy' ? (
        <article className="prose mt-4 space-y-3 text-sm leading-relaxed">
          <h1 className="text-2xl font-bold">Gizlilik Politikası</h1>
          <p className="rounded-lg bg-amber-50 p-3 text-amber-900">Taslak: Bu metin yayından önce hukuki olarak gözden geçirilmelidir.</p>
          <h2 className="text-lg font-semibold">Toplanan veriler</h2>
          <ul className="list-disc pl-5">
            <li>Hesap: e-posta adresi ve isteğe bağlı görünen ad.</li>
            <li>Favoriler ve gönderdiğiniz bildirimler.</li>
            <li>İşletme hesapları için işletme bilgileri, menü içerikleri ve yüklenen görseller.</li>
            <li>İstatistik: işletme/menü görüntüleme sayıları. Kişisel konum veya kimlik bilgisi kaydedilmez; anonim istemci kimliği günlük değişen tuzla hash'lenir.</li>
          </ul>
          <h2 className="text-lg font-semibold">Konum</h2>
          <p>Kesin konumunuz yalnızca yakınlık araması sırasında cihazınızda kullanılır ve sunucuda saklanmaz.</p>
          <h2 className="text-lg font-semibold">Hesap silme</h2>
          <p>Hesabınızı uygulama veya panel üzerinden silebilirsiniz. Tek sahibi olduğunuz işletmeler varsa önce bu işletmeleri silmeniz gerekir.</p>
          <h2 className="text-lg font-semibold">İletişim</h2>
          <p>{brand.supportEmail}</p>
        </article>
      ) : (
        <article className="mt-4 space-y-3 text-sm leading-relaxed">
          <h1 className="text-2xl font-bold">Kullanım Koşulları</h1>
          <p className="rounded-lg bg-amber-50 p-3 text-amber-900">Taslak: Bu metin yayından önce hukuki olarak gözden geçirilmelidir.</p>
          <h2 className="text-lg font-semibold">İşletme içerikleri</h2>
          <p>Menü, fiyat, beslenme ve alerjen bilgilerinin doğruluğundan işletme sorumludur. {brand.appName} bu bilgileri işletmenin beyanı olarak yayınlar.</p>
          <h2 className="text-lg font-semibold">Yayın ve moderasyon</h2>
          <p>İşletmeler yönetim incelemesinden sonra yayınlanır. Kurallara aykırı içerikler kaldırılabilir veya işletme askıya alınabilir.</p>
        </article>
      )}
    </div>
  );
}
