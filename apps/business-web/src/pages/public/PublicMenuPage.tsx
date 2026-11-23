import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { brand } from '@/config/brand';
import { PublicMenuView } from '@/components/PublicMenuView';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { logEvent } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import type { PublicBusiness } from '@/lib/types';

/**
 * QR / NFC ile açılan kalıcı herkese açık menü: /m/:publicId
 * Hesap veya uygulama gerektirmez. Mobil uygulama ile aynı RPC'yi (get_public_business) kullanır.
 * Taslak, incelemedeki, reddedilmiş veya askıya alınmış işletmeler için içerik gösterilmez.
 */
export default function PublicMenuPage() {
  const { publicId = '' } = useParams();
  const query = useQuery({
    queryKey: ['public-business', publicId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_business', { p_ref: publicId });
      if (error) throw error;
      return data as PublicBusiness | null;
    },
  });

  const business = query.data;
  useEffect(() => {
    if (business?.status === 'published') {
      document.title = `${business.name} – Menü | ${brand.appName}`;
      logEvent(business.id, 'menu_view');
    }
  }, [business?.id, business?.status, business?.name]);

  if (query.isLoading) return <LoadingState label="Menü yükleniyor…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} title="Menü yüklenemedi" />;
  if (!business || business.status !== 'published') {
    return (
      <EmptyState
        title="Bu menü şu anda görüntülenemiyor"
        description="İşletme menüsü yayında değil veya geçici olarak kapatılmış olabilir."
      />
    );
  }
  return (
    <div>
      <PublicMenuView business={business} />
      <footer className="pb-6 text-center text-xs text-muted-foreground">{brand.appName} ile yayınlandı</footer>
    </div>
  );
}
