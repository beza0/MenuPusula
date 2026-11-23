import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Nfc } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { publicMenuUrl } from '@/lib/supabase';
import type { Business } from '@/lib/types';

/** Kalıcı QR: URL yalnızca işletmenin değişmeyen public_id'sine bağlıdır; menü değişse de QR aynı kalır. */
export function QrTab({ business }: { business: Business }) {
  const url = publicMenuUrl(business.public_id);
  const [png, setPng] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    const opts = { errorCorrectionLevel: 'M' as const, margin: 2, color: { dark: '#1C1917', light: '#FFFFFF' } };
    QRCode.toDataURL(url, { ...opts, width: 1024 }).then(setPng);
    QRCode.toString(url, { ...opts, type: 'svg' }).then(setSvg);
  }, [url]);

  const download = (href: string, name: string) => {
    const a = document.createElement('a');
    a.href = href;
    a.download = name;
    a.click();
  };
  const fileBase = `qr-menu-${business.public_id}`;

  return (
    <div className="grid gap-4 md:grid-cols-[320px_1fr]">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-5">
          {png ? <img src={png} alt={`${business.name} QR menü kodu`} className="w-full max-w-64" /> : <div className="aspect-square w-64 animate-pulse rounded bg-muted" />}
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" size="sm" disabled={!png} onClick={() => download(png!, `${fileBase}.png`)}><Download /> PNG</Button>
            <Button
              variant="outline" size="sm" disabled={!svg}
              onClick={() => download(URL.createObjectURL(new Blob([svg!], { type: 'image/svg+xml' })), `${fileBase}.svg`)}
            ><Download /> SVG</Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Herkese açık menü bağlantısı</CardTitle>
          <CardDescription>Bu adres kalıcıdır. Menü, fiyat veya işletme adı değişse de QR kodunu yeniden basmanız gerekmez.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {business.status !== 'published' && (
            <Alert variant="warning">İşletme henüz yayında değil. QR kodu şimdiden basabilirsiniz; onaylandıktan sonra menü bu adreste görünür.</Alert>
          )}
          <div className="flex gap-2">
            <code className="flex-1 truncate rounded-lg border bg-muted px-3 py-2 text-sm">{url}</code>
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success('Kopyalandı'))}><Copy /> Kopyala</Button>
          </div>
          <p className="text-sm text-muted-foreground">QR ile açılan menü mobil tarayıcıda çalışır; hesap veya uygulama indirme gerektirmez.</p>
          <div className="flex gap-2 rounded-lg bg-muted p-3 text-sm">
            <Nfc className="size-5 shrink-0" />
            <p>Aynı bağlantıyı NFC etiketine “URL / Web adresi” kaydı olarak yazabilirsiniz (ör. telefonunuzdaki bir NFC yazma uygulamasıyla).</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
