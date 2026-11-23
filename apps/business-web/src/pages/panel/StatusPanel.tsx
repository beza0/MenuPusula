import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/errors';
import { formatDateTime } from '@/lib/format';
import { qk } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { Business } from '@/lib/types';

/** Yayın durumu ve incelemeye gönderme. Durum geçişleri yalnızca sunucu fonksiyonlarıyla yapılır. */
export function StatusPanel({ business: b }: { business: Business }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setMissing(null);
    const { error } = await supabase.rpc('submit_business_for_review', { p_business_id: b.id });
    setBusy(false);
    if (error) {
      if (error.message.startsWith('Eksik bilgiler')) return setMissing(error.message);
      return toast.error(errorMessage(error));
    }
    toast.success('Başvurunuz incelemeye gönderildi');
    qc.invalidateQueries({ queryKey: qk.business(b.id) });
    qc.invalidateQueries({ queryKey: qk.myBusinesses });
  };

  const submitButton = (
    <Button onClick={submit} disabled={busy} className="shrink-0">
      <Send /> {busy ? 'Gönderiliyor…' : 'İncelemeye gönder'}
    </Button>
  );

  switch (b.status) {
    case 'draft':
      return (
        <Alert variant="info" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="font-medium">Taslak — henüz herkese açık değil.</p>
            <p>Bilgileri, çalışma saatlerini ve en az bir menü ürününü ekledikten sonra incelemeye gönderin.</p>
            {missing && <p className="mt-1 font-medium text-danger">{missing}</p>}
          </div>
          {submitButton}
        </Alert>
      );
    case 'pending_review':
      return (
        <Alert variant="warning">
          <p className="font-medium">İncelemede</p>
          <p>{formatDateTime(b.submitted_at)} tarihinde gönderildi. Onaylandığında haritada ve QR menüde yayınlanır. Bu sırada düzenleme yapabilirsiniz.</p>
        </Alert>
      );
    case 'rejected':
      return (
        <Alert variant="danger" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="font-medium">Başvuru reddedildi</p>
            <p>Gerekçe: {b.rejection_reason}</p>
            <p>Gerekli düzeltmeleri yapıp yeniden gönderebilirsiniz.</p>
            {missing && <p className="mt-1 font-medium">{missing}</p>}
          </div>
          {submitButton}
        </Alert>
      );
    case 'suspended':
      return (
        <Alert variant="danger">
          <p className="font-medium">İşletme askıya alındı</p>
          <p>Gerekçe: {b.suspension_reason}. Menünüz şu anda herkese açık değil. Destek için yönetimle iletişime geçin.</p>
        </Alert>
      );
    case 'published':
      return (
        <Alert variant="success">
          Yayında. Menü ve fiyat değişiklikleri kaydedildiği anda mobil uygulamada ve QR menüde görünür.
        </Alert>
      );
  }
}
