import { PublicMenuView } from '@/components/PublicMenuView';
import { ErrorState, LoadingState } from '@/components/states';
import { Alert } from '@/components/ui/alert';
import { usePublicBusiness } from '@/lib/queries';
import type { Business } from '@/lib/types';

/** Yayın öncesi önizleme: herkese açık menüyle aynı veri kaynağı ve bileşen. */
export function PreviewTab({ business }: { business: Business }) {
  const q = usePublicBusiness(business.id);
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <div className="space-y-3">
      {business.status !== 'published' && (
        <Alert variant="info">Bu bir önizlemedir. İşletme onaylanıp yayınlanana kadar ziyaretçiler bu sayfayı göremez.</Alert>
      )}
      <div className="overflow-hidden rounded-2xl border bg-background">
        {q.data && <PublicMenuView business={q.data} preview />}
      </div>
    </div>
  );
}
