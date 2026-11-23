import type { Business } from '@/lib/types';

// İkinci aşamada (AI ile menü aktarma) doldurulacak.
export function ImportTab({ business }: { business: Business }) {
  return <p className="text-sm text-muted-foreground">{business.name}: AI ile menü aktarma henüz eklenmedi.</p>;
}
