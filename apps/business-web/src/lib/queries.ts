import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import type { Business, BusinessHour, BusinessHourException, CuisineType, MenuCategory, MenuItem, PublicBusiness } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function unwrap<T>(p: PromiseLike<{ data: any; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return data as T;
}

export const qk = {
  myBusinesses: ['my-businesses'] as const,
  business: (id: string) => ['business', id] as const,
  hours: (id: string) => ['hours', id] as const,
  menu: (id: string) => ['menu', id] as const,
  publicBusiness: (ref: string) => ['public-business', ref] as const,
};

export function useMyBusinesses() {
  return useQuery({
    queryKey: qk.myBusinesses,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return [];
      const rows = await unwrap<{ business_id: string; role: string; businesses: Business }[]>(
        supabase.from('business_members').select('business_id, role, businesses(*)').eq('user_id', uid),
      );
      return rows.map((r) => ({ ...r.businesses, role: r.role })).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    },
  });
}

export function useBusiness(id: string) {
  return useQuery({
    queryKey: qk.business(id),
    queryFn: async () => {
      const b = await unwrap<Business>(supabase.from('businesses').select('*').eq('id', id).single());
      const cuisines = await unwrap<{ cuisine_id: string }[]>(supabase.from('business_cuisines').select('cuisine_id').eq('business_id', id));
      return { ...b, cuisines: cuisines.map((c) => c.cuisine_id) };
    },
  });
}

export function useCuisineTypes() {
  return useQuery({
    queryKey: ['cuisine-types'],
    staleTime: Infinity,
    queryFn: () => unwrap<CuisineType[]>(supabase.from('cuisine_types').select('*').order('sort_order')),
  });
}

export function useHours(businessId: string) {
  return useQuery({
    queryKey: qk.hours(businessId),
    queryFn: async () => ({
      hours: await unwrap<BusinessHour[]>(
        supabase.from('business_hours').select('*').eq('business_id', businessId).order('weekday').order('opens_at'),
      ),
      exceptions: await unwrap<BusinessHourException[]>(
        supabase.from('business_hour_exceptions').select('*').eq('business_id', businessId).order('date'),
      ),
    }),
  });
}

export function useMenu(businessId: string) {
  return useQuery({
    queryKey: qk.menu(businessId),
    queryFn: async () => {
      const categories = await unwrap<MenuCategory[]>(
        supabase.from('menu_categories').select('*').eq('business_id', businessId).order('sort_order').order('created_at'),
      );
      const items = await unwrap<MenuItem[]>(
        supabase
          .from('menu_items')
          .select('*, menu_item_variants(*), menu_item_tags(tag)')
          .eq('business_id', businessId)
          .order('sort_order')
          .order('created_at'),
      );
      for (const i of items) i.menu_item_variants?.sort((a, b) => a.sort_order - b.sort_order || a.price_cents - b.price_cents);
      return { categories, items };
    },
  });
}

export function usePublicBusiness(ref: string) {
  return useQuery({
    queryKey: qk.publicBusiness(ref),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_business', { p_ref: ref });
      if (error) throw error;
      return data as PublicBusiness | null;
    },
  });
}
