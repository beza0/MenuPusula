import { Link } from 'react-router-dom';
import { ChevronRight, Plus, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge, VerifiedBadge } from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { BUSINESS_TYPE_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { useMyBusinesses } from '@/lib/queries';

export default function BusinessListPage() {
  const { data, isLoading, isError, error, refetch } = useMyBusinesses();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">İşletmelerim</h1>
          <p className="text-sm text-muted-foreground">Şubelerinizi ve menülerinizi buradan yönetin.</p>
        </div>
        <Button asChild>
          <Link to="/panel/isletme/yeni"><Plus /> Yeni işletme</Link>
        </Button>
      </div>
      {isLoading && <LoadingState />}
      {isError && <ErrorState error={error} onRetry={() => refetch()} />}
      {data && data.length === 0 && (
        <EmptyState
          icon={<Store className="size-8" />}
          title="Henüz işletmeniz yok"
          description="İlk işletmenizi ekleyin, menünüzü oluşturun ve incelemeye gönderin."
          action={<Button asChild><Link to="/panel/isletme/yeni"><Plus /> İşletme ekle</Link></Button>}
        />
      )}
      {data && data.length > 0 && (
        <Card className="divide-y">
          {data.map((b) => (
            <Link key={b.id} to={`/panel/isletme/${b.id}`} className="flex items-center gap-3 p-4 hover:bg-muted/50">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{b.name}</span>
                  <StatusBadge status={b.status} />
                  {b.is_verified && <VerifiedBadge />}
                </div>
                <p className="text-sm text-muted-foreground">
                  {BUSINESS_TYPE_LABELS[b.type]} · {[b.district, b.city].filter(Boolean).join(', ') || 'Adres eklenmedi'} · Menü güncelleme: {formatDate(b.menu_updated_at)}
                </p>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
