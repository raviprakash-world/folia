import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Trash2, Upload } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { FormField } from '@/components/common/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/common/Alert';
import { Tag } from '@/components/ui/Tag';
import {
  useSellerProductDetail,
  useCreateSellerProduct,
  useRealSellersApi,
} from '@/hooks/useSellerProducts';
import { fetchCategories } from '@/services/categoryService';
import { productApprovalStatusTone, productApprovalStatusLabel } from '@/utils/sellerProductStatus';

const CARE_LEVELS = ['', 'Easy', 'Moderate', 'Advanced'] as const;

// Kept as validated strings rather than z.coerce.number() — coercion makes
// a schema's input type (what the form holds) diverge from its output type,
// which breaks useForm<T>'s single-type generic. See
// utils/validation.ts's own priceString for the identical reasoning; this
// mirrors it rather than importing it directly since compare-at-price here
// allows an explicit empty string (optional), not the same union shape.
const priceString = (label: string) =>
  z.string().min(1, `Enter ${label}`).refine((v) => !isNaN(Number(v)) && Number(v) > 0, `Enter ${label} greater than 0`);

const productSchema = z.object({
  name: z.string().min(1, 'Enter a product name'),
  price: priceString('a price'),
  compareAtPrice: z.union([priceString('a compare-at price'), z.literal('')]).optional(),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  categoryId: z.string().min(1, 'Choose a category'),
  careLevel: z.enum(CARE_LEVELS).optional(),
  stock: z
    .string()
    .min(1, 'Enter a stock quantity')
    .refine((v) => !isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= 0, 'Enter a whole number, 0 or more'),
});

type ProductFormValues = z.infer<typeof productSchema>;

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function SellerProductEditor() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === undefined;
  const navigate = useNavigate();

  const { product, isLoading, update, submit, archive, uploadMedia, deleteMedia } = useSellerProductDetail(id);
  const createMutation = useCreateSellerProduct();
  const { data: categories = [] } = useQuery({
    queryKey: ['seller-categories'],
    queryFn: fetchCategories,
    enabled: useRealSellersApi,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: { careLevel: '', compareAtPrice: '' },
  });

  useEffect(() => {
    if (!product) return;
    reset({
      name: product.name,
      price: String(product.price),
      compareAtPrice: product.compareAtPrice !== null ? String(product.compareAtPrice) : '',
      description: product.description,
      categoryId: product.categoryId,
      careLevel: product.careLevel ?? '',
      stock: String(product.stockCount),
    });
  }, [product, reset]);

  if (!useRealSellersApi) {
    return (
      <div>
        <PageHeader title={isNew ? 'New product' : 'Edit product'} />
        <p className="text-sm text-ink-soft">
          The seller dashboard requires the real backend (set <code>VITE_REAL_SELLERS_API=true</code>).
        </p>
      </div>
    );
  }

  if (!isNew && isLoading) {
    return (
      <div>
        <PageHeader title="Edit product" />
        <p className="text-sm text-ink-soft py-8 text-center">Loading…</p>
      </div>
    );
  }

  if (!isNew && !product) {
    return (
      <div>
        <PageHeader title="Product not found" />
        <Link to="/seller/products" className="text-fern underline text-sm">
          Back to products
        </Link>
      </div>
    );
  }

  async function onSubmit(values: ProductFormValues) {
    setSaved(false);
    const compareAtPrice =
      values.compareAtPrice === '' || values.compareAtPrice === undefined ? undefined : Number(values.compareAtPrice);
    const careLevel = values.careLevel === '' ? undefined : values.careLevel;

    if (isNew) {
      const created = await createMutation.mutateAsync({
        name: values.name,
        price: Number(values.price),
        compareAtPrice,
        description: values.description,
        categoryId: values.categoryId,
        careLevel,
        initialStock: Number(values.stock),
      });
      void navigate(`/seller/products/${created.id}`, { replace: true });
      return;
    }

    await update.mutateAsync({
      name: values.name,
      price: Number(values.price),
      compareAtPrice,
      description: values.description,
      categoryId: values.categoryId,
      careLevel,
      stock: Number(values.stock),
    });
    setSaved(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0 || !product) return;
    void uploadMedia.mutateAsync(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const canEdit = isNew || product?.approvalStatus === 'DRAFT' || product?.approvalStatus === 'REJECTED';
  const mutationError = createMutation.error ?? update.error;
  const isSubmitting = createMutation.isPending || update.isPending;

  return (
    <div className="max-w-lg">
      <PageHeader
        title={isNew ? 'New product' : product!.name}
        action={
          !isNew ? <Tag tone={productApprovalStatusTone[product!.approvalStatus]}>{productApprovalStatusLabel[product!.approvalStatus]}</Tag> : undefined
        }
      />

      {!isNew && product!.approvalStatus === 'REJECTED' && product!.rejectionNote && (
        <Alert tone="error" className="mb-6">
          Not approved: {product!.rejectionNote}. Update the listing below and resubmit for review.
        </Alert>
      )}
      {!isNew && !canEdit && (
        <Alert tone="info" className="mb-6">
          This product is {productApprovalStatusLabel[product!.approvalStatus].toLowerCase()} and can't be edited right now.
        </Alert>
      )}
      {saved && (
        <Alert tone="success" className="mb-5">
          Changes saved.
        </Alert>
      )}
      {mutationError && (
        <Alert tone="error" className="mb-5">
          {errorMessage(mutationError, 'Could not save this product.')}
        </Alert>
      )}

      <form
        onSubmit={(e) => {
          setSaved(false);
          void handleSubmit(onSubmit)(e);
        }}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField label="Name" error={errors.name?.message} disabled={!canEdit} {...register('name')} />
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label="Price" type="number" step="0.01" error={errors.price?.message} disabled={!canEdit} {...register('price')} />
          <FormField
            label="Compare-at price (optional)"
            type="number"
            step="0.01"
            error={errors.compareAtPrice?.message}
            disabled={!canEdit}
            {...register('compareAtPrice')}
          />
        </div>
        <FormField as="textarea" rows={3} label="Description" error={errors.description?.message} disabled={!canEdit} {...register('description')} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="seller-product-category" className="text-sm font-medium text-ink-soft">
            Category
          </label>
          <select
            id="seller-product-category"
            disabled={!canEdit}
            className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm text-ink focus:border-fern transition-colors disabled:opacity-60"
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
            <label htmlFor="seller-product-care-level" className="text-sm font-medium text-ink-soft">
              Care level (optional)
            </label>
            <select
              id="seller-product-care-level"
              disabled={!canEdit}
              className="rounded-[var(--radius-control)] border border-stone-dark bg-stone-light px-3.5 py-2.5 text-sm text-ink focus:border-fern transition-colors disabled:opacity-60"
              {...register('careLevel')}
            >
              {CARE_LEVELS.map((c) => (
                <option key={c} value={c}>
                  {c || 'None'}
                </option>
              ))}
            </select>
          </div>
          <FormField
            label={isNew ? 'Initial stock' : 'Stock'}
            type="number"
            error={errors.stock?.message}
            disabled={!canEdit}
            {...register('stock')}
          />
        </div>

        {canEdit && (
          <Button type="submit" variant="primary" disabled={isSubmitting} className="self-start">
            {isSubmitting ? 'Saving…' : isNew ? 'Create product' : 'Save changes'}
          </Button>
        )}
      </form>

      {!isNew && product && (
        <>
          <div className="mt-10">
            <h2 className="font-display text-base font-semibold text-heading mb-3">Images</h2>
            <div className="flex flex-wrap gap-3 mb-3">
              {product.images.map((img) => (
                <div key={img.id} className="relative w-20 h-20 rounded-[var(--radius-control)] overflow-hidden border border-stone-dark">
                  <img src={img.url} alt={img.altText ?? ''} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={() => void deleteMedia.mutateAsync(img.id)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-ink/60 text-stone-light hover:bg-rust"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" aria-label="Upload product image" />
            <Button variant="outline" size="sm" icon={<Upload size={14} />} onClick={() => fileInputRef.current?.click()} disabled={uploadMedia.isPending}>
              {uploadMedia.isPending ? 'Uploading…' : 'Add image'}
            </Button>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            {(product.approvalStatus === 'DRAFT' || product.approvalStatus === 'REJECTED') && (
              <Button variant="primary" disabled={submit.isPending} onClick={() => void submit.mutateAsync()}>
                {submit.isPending ? 'Submitting…' : 'Submit for review'}
              </Button>
            )}
            {product.approvalStatus === 'ACTIVE' && (
              <Button variant="outline" className="!border-rust !text-rust" disabled={archive.isPending} onClick={() => void archive.mutateAsync()}>
                {archive.isPending ? 'Archiving…' : 'Archive product'}
              </Button>
            )}
          </div>
          {submit.isError && <p className="text-sm text-rust mt-2">{errorMessage(submit.error, 'Could not submit for review.')}</p>}
          {archive.isError && <p className="text-sm text-rust mt-2">{errorMessage(archive.error, 'Could not archive.')}</p>}
        </>
      )}
    </div>
  );
}
