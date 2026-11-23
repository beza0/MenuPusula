import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Yapılandırma eksikse uygulama çökmek yerine açık bir uyarı ekranı gösterir. */
export const supabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient = createClient(
  url ?? 'http://localhost:54321',
  anonKey ?? 'missing-anon-key',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } },
);

export const MEDIA_BUCKET = 'business-media';
export const IMPORT_BUCKET = 'menu-imports';

export const publicMenuBaseUrl = (): string =>
  ((import.meta.env.VITE_PUBLIC_MENU_BASE_URL as string | undefined) || window.location.origin).replace(/\/$/, '');

export const publicMenuUrl = (publicId: string) => `${publicMenuBaseUrl()}/m/${publicId}`;
