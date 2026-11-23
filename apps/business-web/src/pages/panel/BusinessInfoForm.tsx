import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { LocationPicker } from '@/components/LocationPicker';
import { businessInfoSchema, type BusinessInfo, type BusinessInfoInput } from '@/lib/schemas';
import { useCuisineTypes } from '@/lib/queries';

export const emptyBusinessInfo: BusinessInfoInput = {
  name: '',
  type: 'cafe',
  cuisines: [],
  description: '',
  phone: '',
  website_url: '',
  instagram_url: '',
  facebook_url: '',
  address_line: '',
  district: '',
  city: '',
  latitude: null,
  longitude: null,
};

export function BusinessInfoForm({
  defaultValues, onSubmit, submitLabel,
}: { defaultValues: BusinessInfoInput; onSubmit: (v: BusinessInfo) => Promise<void>; submitLabel: string }) {
  const cuisines = useCuisineTypes();
  const form = useForm<BusinessInfoInput, unknown, BusinessInfo>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues,
  });
  const { register, handleSubmit, control, formState: { errors, isSubmitting, isDirty } } = form;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="İşletme adı *" htmlFor="name" error={errors.name?.message} className="sm:col-span-2">
          <Input id="name" {...register('name')} aria-invalid={Boolean(errors.name)} />
        </Field>
        <Field label="Tür *" htmlFor="type" error={errors.type?.message}>
          <NativeSelect id="type" {...register('type')}>
            <option value="cafe">Kafe</option>
            <option value="restaurant">Restoran</option>
          </NativeSelect>
        </Field>
        <Field label="Telefon" htmlFor="phone" error={errors.phone?.message} hint="İncelemeye göndermek için gerekli">
          <Input id="phone" type="tel" inputMode="tel" placeholder="+90 212 555 00 00" {...register('phone')} />
        </Field>
        <Field label="Açıklama" htmlFor="description" error={errors.description?.message} className="sm:col-span-2">
          <Textarea id="description" rows={3} maxLength={1000} {...register('description')} />
        </Field>
      </section>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Mutfak türleri</legend>
        <Controller
          control={control}
          name="cuisines"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {cuisines.data?.map((c) => {
                const checked = field.value.includes(c.id);
                return (
                  <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary-soft">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => field.onChange(v ? [...field.value, c.id] : field.value.filter((x) => x !== c.id))}
                    />
                    {c.name_tr}
                  </label>
                );
              })}
            </div>
          )}
        />
        {errors.cuisines && <p className="text-xs text-danger">{errors.cuisines.message}</p>}
      </fieldset>

      <section className="grid gap-4 sm:grid-cols-2">
        <Field label="Adres" htmlFor="address_line" error={errors.address_line?.message} className="sm:col-span-2">
          <Input id="address_line" autoComplete="street-address" {...register('address_line')} />
        </Field>
        <Field label="İlçe" htmlFor="district" error={errors.district?.message}>
          <Input id="district" {...register('district')} />
        </Field>
        <Field label="Şehir" htmlFor="city" error={errors.city?.message}>
          <Input id="city" {...register('city')} />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium">Harita konumu</p>
          <Controller
            control={control}
            name="latitude"
            render={({ field }) => (
              <LocationPicker
                latitude={field.value}
                longitude={form.watch('longitude')}
                error={errors.latitude?.message}
                onChange={(lat, lng) => {
                  form.setValue('latitude', lat, { shouldDirty: true });
                  form.setValue('longitude', lng, { shouldDirty: true });
                }}
              />
            )}
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Field label="Web sitesi" htmlFor="website_url" error={errors.website_url?.message}>
          <Input id="website_url" type="url" placeholder="https://" {...register('website_url')} />
        </Field>
        <Field label="Instagram" htmlFor="instagram_url" error={errors.instagram_url?.message}>
          <Input id="instagram_url" type="url" placeholder="https://instagram.com/…" {...register('instagram_url')} />
        </Field>
        <Field label="Facebook" htmlFor="facebook_url" error={errors.facebook_url?.message}>
          <Input id="facebook_url" type="url" placeholder="https://facebook.com/…" {...register('facebook_url')} />
        </Field>
      </section>

      <div className="sticky bottom-0 -mx-4 flex justify-end border-t bg-white/95 px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Button type="submit" disabled={isSubmitting || (!isDirty && submitLabel !== 'Taslağı oluştur')}>
          {isSubmitting ? 'Kaydediliyor…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function toBusinessRow(v: BusinessInfo) {
  const { cuisines: _c, ...row } = v;
  void _c;
  return row;
}
