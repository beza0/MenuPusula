import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge, VerifiedBadge } from '@/components/StatusBadge';
import { ErrorState, LoadingState } from '@/components/states';
import { publicMenuUrl } from '@/lib/supabase';
import { useBusiness } from '@/lib/queries';
import { StatusPanel } from './StatusPanel';
import { InfoTab } from './InfoTab';
import { HoursTab } from './HoursTab';
import { MenuTab } from './MenuTab';
import { PreviewTab } from './PreviewTab';
import { QrTab } from './QrTab';
import { StatsTab } from './StatsTab';
import { ImportTab } from './ImportTab';

const TABS = [
  { id: 'menu', label: 'Menü' },
  { id: 'bilgiler', label: 'Bilgiler' },
  { id: 'saatler', label: 'Çalışma saatleri' },
  { id: 'onizleme', label: 'Önizleme' },
  { id: 'qr', label: 'QR menü' },
  { id: 'istatistik', label: 'İstatistik' },
  { id: 'ai-aktarim', label: 'AI ile aktar' },
] as const;

export default function BusinessPage() {
  const { id = '', tab = 'menu' } = useParams();
  const navigate = useNavigate();
  const business = useBusiness(id);

  if (business.isLoading) return <LoadingState />;
  if (business.isError) return <ErrorState error={business.error} onRetry={() => business.refetch()} />;
  const b = business.data!;

  return (
    <div className="space-y-4">
      <Link to="/panel" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> İşletmelerim
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{b.name}</h1>
        <StatusBadge status={b.status} />
        {b.is_verified && <VerifiedBadge />}
        {b.status === 'published' && (
          <a href={publicMenuUrl(b.public_id)} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-sm text-primary">
            Herkese açık menü <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
      <StatusPanel business={b} />
      <Tabs value={tab} onValueChange={(t) => navigate(`/panel/isletme/${id}/${t}`)}>
        <TabsList>
          {TABS.map((t) => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
        </TabsList>
        <div className="pt-4">
          <TabsContent value="menu"><MenuTab business={b} /></TabsContent>
          <TabsContent value="bilgiler"><InfoTab business={b} /></TabsContent>
          <TabsContent value="saatler"><HoursTab businessId={b.id} /></TabsContent>
          <TabsContent value="onizleme"><PreviewTab business={b} /></TabsContent>
          <TabsContent value="qr"><QrTab business={b} /></TabsContent>
          <TabsContent value="istatistik"><StatsTab businessId={b.id} /></TabsContent>
          <TabsContent value="ai-aktarim"><ImportTab business={b} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
