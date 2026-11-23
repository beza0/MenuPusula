import { useMemo, useState } from 'react';
import { AtSign, BadgeCheck, Clock, FileText, Globe, MapPin, Navigation, Phone, Search, UtensilsCrossed } from 'lucide-react';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { BUSINESS_TYPE_LABELS, TAG_LABEL } from '@/lib/constants';
import { formatDate, formatDateTime, formatHoursRange, formatPrice, WEEKDAYS } from '@/lib/format';
import { useSignedUrls } from '@/lib/storage';
import type { PublicBusiness } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Herkese açık menü görünümü. QR menü sayfası, işletme önizlemesi ve yönetici incelemesi
 * aynı bileşeni ve aynı veri kaynağını (get_public_business RPC) kullanır.
 */
export function PublicMenuView({ business, preview = false }: { business: PublicBusiness; preview?: boolean }) {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const imagePaths = useMemo(
    () => [business.logo_path, business.cover_path, business.menu_pdf_path, ...business.categories.flatMap((c) => c.items.map((i) => i.image_path))],
    [business],
  );
  const { data: urls } = useSignedUrls(imagePaths);
  const url = (p: string | null) => (p ? urls?.[p] : undefined);

  const q = query.trim().toLocaleLowerCase('tr');
  const categories = useMemo(
    () =>
      business.categories
        .map((c) => ({
          ...c,
          items: q
            ? c.items.filter((i) => i.name.toLocaleLowerCase('tr').includes(q) || (i.description ?? '').toLocaleLowerCase('tr').includes(q))
            : c.items,
        }))
        .filter((c) => c.items.length > 0),
    [business.categories, q],
  );

  const mapsUrl =
    business.latitude !== null && business.longitude !== null
      ? `https://www.google.com/maps/dir/?api=1&destination=${business.latitude},${business.longitude}`
      : null;

  return (
    <div className="mx-auto max-w-3xl pb-16">
      {/* Kapak + başlık */}
      <div className="relative aspect-[16/7] w-full overflow-hidden bg-muted sm:rounded-b-2xl">
        {url(business.cover_path) ? (
          <img src={url(business.cover_path)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary-soft text-primary">
            <UtensilsCrossed className="size-10" aria-hidden />
          </div>
        )}
      </div>
      <div className="px-4">
        <div className="-mt-8 flex items-end gap-3">
          <div className="size-16 shrink-0 overflow-hidden rounded-xl border-2 border-white bg-white shadow">
            {url(business.logo_path) ? (
              <img src={url(business.logo_path)} alt={`${business.name} logosu`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-lg font-bold text-muted-foreground">
                {business.name.slice(0, 1)}
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{business.name}</h1>
            {business.is_verified && (
              <Badge title="İşletme bilgileri yönetim tarafından doğrulandı"><BadgeCheck className="size-3.5" /> Doğrulanmış</Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{BUSINESS_TYPE_LABELS[business.type]}</span>
            {business.cuisines.length > 0 && <span>· {business.cuisines.map((c) => c.name).join(', ')}</span>}
            {business.is_open_now !== null && (
              <Badge variant={business.is_open_now ? 'success' : 'neutral'}>{business.is_open_now ? 'Şu an açık' : 'Şu an kapalı'}</Badge>
            )}
          </div>
          {business.description && <p className="text-sm leading-relaxed">{business.description}</p>}
        </div>

        {/* İletişim */}
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {business.address_line && (
            <div className="flex gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>{[business.address_line, business.district, business.city].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {business.phone && (
            <a className="flex items-center gap-2 text-primary" href={`tel:${business.phone.replace(/\s/g, '')}`}>
              <Phone className="size-4" /> {business.phone}
            </a>
          )}
          {mapsUrl && (
            <a className="flex items-center gap-2 text-primary" href={mapsUrl} target="_blank" rel="noreferrer">
              <Navigation className="size-4" /> Yol tarifi al
            </a>
          )}
          {business.website_url && (
            <a className="flex items-center gap-2 text-primary" href={business.website_url} target="_blank" rel="noreferrer noopener">
              <Globe className="size-4" /> Web sitesi
            </a>
          )}
          {business.instagram_url && (
            <a className="flex items-center gap-2 text-primary" href={business.instagram_url} target="_blank" rel="noreferrer noopener">
              <AtSign className="size-4" /> Instagram
            </a>
          )}
          {business.menu_pdf_path && url(business.menu_pdf_path) && (
            <a className="flex items-center gap-2 text-primary" href={url(business.menu_pdf_path)} target="_blank" rel="noreferrer">
              <FileText className="size-4" /> Ek menü belgesi (PDF)
            </a>
          )}
        </div>

        <HoursBlock business={business} />

        <div className="mt-4 space-y-0.5 text-xs text-muted-foreground">
          <p>Menü son güncelleme: {formatDateTime(business.menu_updated_at)}</p>
          {business.prices_checked_at && <p>Fiyatlar işletme tarafından son kontrol edildi: {formatDate(business.prices_checked_at)}</p>}
        </div>
      </div>

      {/* Menü */}
      <div className="sticky top-0 z-10 mt-6 border-b bg-background/95 px-4 pb-2 pt-3 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Menüde ara"
            aria-label="Menüde ara"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {!q && business.categories.length > 1 && (
          <nav className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4" aria-label="Menü kategorileri">
            {business.categories.map((c) => (
              <a
                key={c.id}
                href={`#cat-${c.id}`}
                onClick={() => setActiveCat(c.id)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-sm',
                  activeCat === c.id ? 'border-primary bg-primary-soft text-primary' : 'bg-white',
                )}
              >
                {c.name}
              </a>
            ))}
          </nav>
        )}
      </div>

      <div className="px-4">
        {business.categories.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">Bu işletme henüz menü eklemedi.</p>
        )}
        {business.categories.length > 0 && categories.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">“{query}” için menüde sonuç bulunamadı.</p>
        )}
        {categories.map((c) => (
          <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-32 pt-6">
            <h2 className="text-lg font-semibold">{c.name}</h2>
            {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
            <ul className="mt-2 divide-y">
              {c.items.map((i) => (
                <li key={i.id} className={cn('flex gap-3 py-3', !i.is_available && 'opacity-60')}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-medium">{i.name}</h3>
                      {!i.has_variants && <span className="price font-semibold">{formatPrice(i.price_cents)}</span>}
                    </div>
                    {i.description && <p className="mt-0.5 text-sm text-muted-foreground">{i.description}</p>}
                    {i.has_variants && (
                      <ul className="mt-1 space-y-0.5 text-sm">
                        {i.variants.map((v) => (
                          <li key={v.id} className="flex justify-between gap-3">
                            <span>{v.name}</span>
                            <span className="price font-semibold">{formatPrice(v.price_cents)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {!i.is_available && <Badge variant="danger">Tükendi</Badge>}
                      {i.tags.map((t) => (
                        <Badge key={t} variant="neutral">{TAG_LABEL[t] ?? t}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {url(i.image_path) ? (
                      <img src={url(i.image_path)} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground/60" aria-hidden>
                        <UtensilsCrossed className="size-6" />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {preview && <p className="mt-8 text-center text-xs text-muted-foreground">Önizleme: gizli ürün ve kategoriler gösterilmez.</p>}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Etiketler ve alerjen bilgileri işletme tarafından beyan edilmiştir. Fiyatlara ilişkin kesin bilgi için işletmeye danışın.
        </p>
      </div>
    </div>
  );
}

function HoursBlock({ business }: { business: PublicBusiness }) {
  if (business.hours.length === 0) return null;
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: business.timezone }).format(new Date());
  const todayIso = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(today) + 1;
  return (
    <details className="mt-4 rounded-lg border bg-white p-3 text-sm">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        <Clock className="size-4 text-muted-foreground" /> Çalışma saatleri
      </summary>
      <table className="mt-2 w-full">
        <tbody>
          {WEEKDAYS.map((d) => {
            const rows = business.hours.filter((h) => h.weekday === d.value);
            return (
              <tr key={d.value} className={cn(d.value === todayIso && 'font-semibold')}>
                <td className="py-0.5 pr-4">{d.label}</td>
                <td className="py-0.5 text-right">
                  {rows.length === 0 ? 'Kapalı' : rows.map((r) => formatHoursRange(r.opens_at, r.closes_at)).join(', ')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {business.hour_exceptions.length > 0 && (
        <div className="mt-2 border-t pt-2">
          <p className="font-medium">Özel günler</p>
          {business.hour_exceptions.map((e) => (
            <p key={e.date}>
              {formatDate(e.date)}: {e.is_closed ? 'Kapalı' : formatHoursRange(e.opens_at!, e.closes_at!)} {e.note && `(${e.note})`}
            </p>
          ))}
        </div>
      )}
    </details>
  );
}
