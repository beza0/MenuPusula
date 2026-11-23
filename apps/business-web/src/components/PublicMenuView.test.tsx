import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PublicMenuView } from './PublicMenuView';
import type { PublicBusiness } from '@/lib/types';

vi.mock('@/lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) } },
  MEDIA_BUCKET: 'business-media',
}));

const business: PublicBusiness = {
  id: 'b1', public_id: 'abc', name: 'Örnek Kafe', type: 'cafe', description: null, phone: '+90 212 000 00 00',
  website_url: null, instagram_url: null, facebook_url: null, address_line: 'Cad. 1', district: 'Kadıköy', city: 'İstanbul',
  latitude: 41, longitude: 29, timezone: 'Europe/Istanbul', currency: 'TRY', logo_path: null, cover_path: null, menu_pdf_path: null,
  status: 'published', is_verified: false, menu_updated_at: '2026-11-20T10:00:00Z', prices_checked_at: null, is_open_now: true,
  cuisines: [], hours: [{ weekday: 5, opens_at: '18:00', closes_at: '02:00' }], hour_exceptions: [],
  categories: [
    { id: 'c1', name: 'Kahveler', description: null, items: [
      { id: 'i1', name: 'Latte', description: 'Sütlü', price_cents: 8000, currency: 'TRY', has_variants: true, is_available: true, image_path: null,
        variants: [{ id: 'v1', name: 'Küçük', price_cents: 8000 }, { id: 'v2', name: 'Büyük', price_cents: 11050 }], tags: ['vegetarian'] },
      { id: 'i2', name: 'Türk Kahvesi', description: null, price_cents: 6000, currency: 'TRY', has_variants: false, is_available: false, image_path: null, variants: [], tags: [] },
    ] },
    { id: 'c2', name: 'Tatlılar', description: null, items: [
      { id: 'i3', name: 'Cheesecake', description: null, price_cents: 14500, currency: 'TRY', has_variants: false, is_available: true, image_path: null, variants: [], tags: [] },
    ] },
  ],
};

const renderView = () =>
  render(<QueryClientProvider client={new QueryClient()}><PublicMenuView business={business} /></QueryClientProvider>);

describe('herkese açık menü görünümü', () => {
  it('fiyatları, varyantları, tükendi ve etiketleri gösterir', () => {
    renderView();
    expect(screen.getByRole('heading', { name: 'Örnek Kafe' })).toBeInTheDocument();
    expect(screen.getByText('Küçük')).toBeInTheDocument();
    expect(screen.getByText(/110,50/)).toBeInTheDocument();
    expect(screen.getByText('Tükendi')).toBeInTheDocument();
    expect(screen.getByText('Vejetaryen')).toBeInTheDocument();
    expect(screen.getByText('Şu an açık')).toBeInTheDocument();
    expect(screen.getByText(/Menü son güncelleme/)).toBeInTheDocument();
  });

  it('menü içinde arama yapar ve boş sonucu bildirir', () => {
    renderView();
    const input = screen.getByRole('searchbox', { name: 'Menüde ara' });
    fireEvent.change(input, { target: { value: 'cheese' } });
    expect(screen.getByText('Cheesecake')).toBeInTheDocument();
    expect(screen.queryByText('Latte')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'pizza' } });
    expect(screen.getByText(/için menüde sonuç bulunamadı/)).toBeInTheDocument();
  });
});
