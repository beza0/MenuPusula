// Veritabanı satır tipleri (supabase/migrations ile uyumlu, elle tutulur).
export type BusinessStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'suspended';
export type BusinessType = 'restaurant' | 'cafe';

export interface Business {
  id: string;
  public_id: string;
  name: string;
  type: BusinessType;
  description: string | null;
  phone: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  address_line: string | null;
  district: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  currency: string;
  logo_path: string | null;
  cover_path: string | null;
  menu_pdf_path: string | null;
  status: BusinessStatus;
  is_verified: boolean;
  verified_at: string | null;
  rejection_reason: string | null;
  suspension_reason: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  menu_updated_at: string | null;
  prices_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessHour {
  id: string;
  business_id: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
}

export interface BusinessHourException {
  id: string;
  business_id: string;
  date: string;
  is_closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  note: string | null;
}

export interface CuisineType {
  id: string;
  name_tr: string;
  sort_order: number;
}

export interface MenuCategory {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_visible: boolean;
}

export interface MenuItemVariant {
  id: string;
  item_id: string;
  name: string;
  price_cents: number;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  business_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  has_variants: boolean;
  image_path: string | null;
  is_available: boolean;
  is_hidden: boolean;
  dietary_info_confirmed: boolean;
  sort_order: number;
  updated_at: string;
  menu_item_variants?: MenuItemVariant[];
  menu_item_tags?: { tag: string }[];
}

export interface Report {
  id: string;
  reporter_id: string | null;
  business_id: string;
  menu_item_id: string | null;
  reason: string;
  message: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  admin_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

/** get_public_business RPC çıktısı (mobil uygulama ile ortak sözleşme) */
export interface PublicBusiness {
  id: string;
  public_id: string;
  name: string;
  type: BusinessType;
  description: string | null;
  phone: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  address_line: string | null;
  district: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  currency: string;
  logo_path: string | null;
  cover_path: string | null;
  menu_pdf_path: string | null;
  status: BusinessStatus;
  is_verified: boolean;
  menu_updated_at: string | null;
  prices_checked_at: string | null;
  is_open_now: boolean | null;
  cuisines: { id: string; name: string }[];
  hours: { weekday: number; opens_at: string; closes_at: string }[];
  hour_exceptions: { date: string; is_closed: boolean; opens_at: string | null; closes_at: string | null; note: string | null }[];
  categories: {
    id: string;
    name: string;
    description: string | null;
    items: {
      id: string;
      name: string;
      description: string | null;
      price_cents: number;
      currency: string;
      has_variants: boolean;
      is_available: boolean;
      image_path: string | null;
      variants: { id: string; name: string; price_cents: number }[];
      tags: string[];
    }[];
  }[];
}
