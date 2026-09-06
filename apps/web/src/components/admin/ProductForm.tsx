import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { adminProductSchema } from '@/utils/validation';
import type { AdminProductFormValues } from '@/utils/validation';
import type { Product, Category } from '@/types/product';

interface ProductFormProps {
  categories: Category[];
  initialValues?: Product;
  onSubmit: (values: AdminProductFormValues) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
}

const badgeOptions = ['', 'New', 'Sale', 'Bestseller', 'Low stock'] as const;
const careLevelOptions = ['', 'Easy', 'Moderate', 'Advanced'] as const;

export function ProductForm({ categories, initialValues, onSubmit, onCancel, submitLabel }: ProductFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminProductFormValues>({
    resolver: zodResolver(adminProductSchema),
    defaultValues: initialValues
      ? {
          slug: initialValues.slug,
          name: initialValues.name,
          price: String(initialValues.price),
          compareAtPrice: initialValues.compareAtPrice !== undefined ? String(initialValues.compareAtPrice) : '',
          description: initialValues.description,
          categoryId: categories.find((c) => c.slug === initialValues.categorySlug)?.id ?? '',
          badge: initialValues.badge ?? '',
          careLevel: initialValues.careLevel ?? '',
        }
      : { badge: '', careLevel: '', compareAtPrice: '' },
  });

  async function handleFormSubmit(values: AdminProductFormValues) {
    await onSubmit(values);
  }

  return (
    <form onSubmit={(e) => void handleSubmit(handleFormSubmit)(e)} noValidate className="flex flex-col gap-4">
      <FormField label="Name" error={errors.name?.message} {...register('name')} />
      <FormField label="Slug" error={errors.slug?.message} {...register('slug')} />
      <div className="grid sm:grid-cols-2 gap-4">
        <FormField label="Price" type="number" step="0.01" error={errors.price?.message} {...register('price')} />
        <FormField
          label="Compare-at price (optional)"
          type="number"
          step="0.01"
          error={errors.compareAtPrice?.message}
          {...register('compareAtPrice')}
        />
      </div>
      <FormField as="textarea" rows={3} label="Description" error={errors.description?.message} {...register('description')} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="product-category" className="text-sm font-medium text-ink-soft">
          Category
        </label>
        <select
          id="product-category"
          className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm text-ink focus:border-fern transition-colors"
          {...register('categoryId')}
        >
          <option value="">Select a category</option>
          {categories.map((c) => (
            <option key={c.id ?? c.slug} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <p role="alert" className="text-xs text-rust">
            {errors.categoryId.message}
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-badge" className="text-sm font-medium text-ink-soft">
            Badge (optional)
          </label>
          <select
            id="product-badge"
            className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm text-ink focus:border-fern transition-colors"
            {...register('badge')}
          >
            {badgeOptions.map((b) => (
              <option key={b} value={b}>
                {b || 'None'}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-care-level" className="text-sm font-medium text-ink-soft">
            Care level (optional)
          </label>
          <select
            id="product-care-level"
            className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm text-ink focus:border-fern transition-colors"
            {...register('careLevel')}
          >
            {careLevelOptions.map((c) => (
              <option key={c} value={c}>
                {c || 'None'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  );
}
