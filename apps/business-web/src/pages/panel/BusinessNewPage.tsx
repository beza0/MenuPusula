import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { errorMessage } from '@/lib/errors';
import { qk } from '@/lib/queries';
import type { BusinessInfo } from '@/lib/schemas';
import { supabase } from '@/lib/supabase';
import { BusinessInfoForm, emptyBusinessInfo, toBusinessRow } from './BusinessInfoForm';

export default function BusinessNewPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const create = async (v: BusinessInfo) => {
    try {
      // Durum her zaman sunucuda "taslak" olarak atanır.
      const { data, error } = await supabase.from('businesses').insert(toBusinessRow(v)).select('id').single();
      if (error) throw error;
      if (v.cuisines.length) {
        const { error: cErr } = await supabase
          .from('business_cuisines')
          .insert(v.cuisines.map((cuisine_id) => ({ business_id: data.id, cuisine_id })));
        if (cErr) throw cErr;
      }
      await qc.invalidateQueries({ queryKey: qk.myBusinesses });
      toast.success('Taslak oluşturuldu. Şimdi görselleri, çalışma saatlerini ve menüyü ekleyin.');
      navigate(`/panel/isletme/${data.id}/menu`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yeni işletme</CardTitle>
        <CardDescription>Bilgiler taslak olarak kaydedilir. Menü ve çalışma saatlerini ekledikten sonra incelemeye gönderebilirsiniz.</CardDescription>
      </CardHeader>
      <CardContent>
        <BusinessInfoForm defaultValues={emptyBusinessInfo} onSubmit={create} submitLabel="Taslağı oluştur" />
      </CardContent>
    </Card>
  );
}
