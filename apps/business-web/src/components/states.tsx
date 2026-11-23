import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { errorMessage } from '@/lib/errors';

export function LoadingState({ label = 'Yükleniyor…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground" role="status" aria-live="polite">
      <Loader2 className="size-5 animate-spin" /> {label}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Bir sorun oluştu' }: { error: unknown; onRetry?: () => void; title?: string }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center" role="alert">
      <AlertTriangle className="size-8 text-danger" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw /> Tekrar dene
        </Button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-12 text-center">
      <div className="text-muted-foreground">{icon ?? <Inbox className="size-8" />}</div>
      <div>
        <p className="font-semibold">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
