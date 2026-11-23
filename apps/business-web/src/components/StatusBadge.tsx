import { BadgeCheck } from 'lucide-react';
import { Badge } from './ui/badge';
import { STATUS_LABELS } from '@/lib/constants';
import type { BusinessStatus } from '@/lib/types';

const VARIANT: Record<BusinessStatus, 'neutral' | 'warning' | 'success' | 'danger'> = {
  draft: 'neutral',
  pending_review: 'warning',
  published: 'success',
  rejected: 'danger',
  suspended: 'danger',
};

export function StatusBadge({ status }: { status: BusinessStatus }) {
  return <Badge variant={VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}

/** Yalnızca yöneticinin gerçek doğrulama kararıyla gösterilir. */
export function VerifiedBadge() {
  return (
    <Badge variant="default" title="İşletme bilgileri yönetim tarafından doğrulandı">
      <BadgeCheck className="size-3.5" /> Doğrulanmış işletme
    </Badge>
  );
}
