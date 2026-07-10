'use client';

import { useRef, useState, useTransition } from 'react';
import type { MutableRefObject } from 'react';
import type { Control } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Loader2, Plus, Pencil, Trash2, Wine as WineIcon } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatCHF } from '@/lib/utils/currency';
import {
  wineFormSchema,
  wineFormToActionInput,
  type WineFormInput,
} from '@/lib/validators/wine';
import { createWine, updateWine, deleteWine } from '@/server/actions/wine';
import type { WineDTO } from '@/server/queries/wine.queries';

interface WinesManagerProps {
  wines: WineDTO[];
}

interface WineFormFieldsProps {
  control: Control<WineFormInput>;
  /** Quick-add shows placeholders and keeps focus on the name input. */
  withPlaceholders?: boolean;
  nameRef?: MutableRefObject<HTMLInputElement | null>;
}

/** The four wine fields — one definition for the quick-add AND the row
 * editor, so add/edit can never drift apart. */
function WineFormFields({
  control,
  withPlaceholders = false,
  nameRef,
}: WineFormFieldsProps) {
  const t = useTranslations('Dashboard.wines');
  return (
    <>
      <FormField
        control={control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('fieldName')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                ref={(element) => {
                  field.ref(element);
                  if (nameRef) nameRef.current = element;
                }}
                placeholder={
                  withPlaceholders ? t('fieldNamePlaceholder') : undefined
                }
                autoComplete="off"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="grapeVariety"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('fieldGrape')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                placeholder={
                  withPlaceholders ? t('fieldGrapePlaceholder') : undefined
                }
                autoComplete="off"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="vintage"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('fieldVintage')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                inputMode="numeric"
                placeholder={withPlaceholders ? '2024' : undefined}
                autoComplete="off"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="priceChf"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('fieldPrice')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                inputMode="decimal"
                placeholder={withPlaceholders ? '24.50' : undefined}
                autoComplete="off"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

function toFormValues(wine?: WineDTO): WineFormInput {
  return {
    name: wine?.name ?? '',
    grapeVariety: wine?.grapeVariety ?? '',
    vintage: wine?.vintage != null ? String(wine.vintage) : '',
    priceChf: wine != null ? (wine.price / 100).toFixed(2) : '',
  };
}

/**
 * Winemaker wine catalogue (P-07 / L-060). Quick-add form on top (keeps
 * focus after submit — 5 wines in under 2 minutes), then the list with
 * an availability toggle, inline edit and delete.
 */
export function WinesManager({ wines }: WinesManagerProps) {
  const t = useTranslations('Dashboard.wines');
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WineDTO | null>(null);
  const [isPending, startTransition] = useTransition();
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const addForm = useForm<WineFormInput>({
    resolver: zodResolver(wineFormSchema),
    defaultValues: toFormValues(),
  });

  async function onAdd(values: WineFormInput) {
    const result = await createWine(wineFormToActionInput(values));
    if (result.success) {
      toast.success(t('added', { name: values.name }));
      addForm.reset(toFormValues());
      nameInputRef.current?.focus();
      router.refresh();
    } else {
      toast.error(t('saveFailed'));
    }
  }

  function onToggleAvailable(wine: WineDTO, available: boolean) {
    startTransition(async () => {
      const result = await updateWine({ wineId: wine.id, available });
      if (result.success) {
        router.refresh();
      } else {
        toast.error(t('saveFailed'));
      }
    });
  }

  function onDelete(wine: WineDTO) {
    startTransition(async () => {
      const result = await deleteWine({ wineId: wine.id });
      setDeleteTarget(null);
      if (result.success) {
        toast.success(t('deleted', { name: wine.name }));
        router.refresh();
      } else if (result.error.code === 'CONFLICT') {
        // Served wines carry tasting history — offer disabling instead.
        toast.error(t('deleteConflict'));
      } else {
        toast.error(t('saveFailed'));
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Quick add */}
      <section className="rounded-xl border border-border bg-white p-4 sm:p-6">
        <h2 className="text-base font-semibold text-foreground">
          {t('addTitle')}
        </h2>
        <Form {...addForm}>
          <form
            onSubmit={addForm.handleSubmit(onAdd)}
            className="mt-4 grid gap-3 sm:grid-cols-[2fr,2fr,1fr,1fr,auto] sm:items-end"
          >
            <WineFormFields
              control={addForm.control}
              withPlaceholders
              nameRef={nameInputRef}
            />
            <Button
              type="submit"
              disabled={addForm.formState.isSubmitting}
              className="min-h-[44px]"
            >
              {addForm.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {t('addButton')}
            </Button>
          </form>
        </Form>
      </section>

      {/* List */}
      {wines.length === 0 ? (
        <EmptyState
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          icon={<WineIcon className="h-10 w-10 text-burgundy-400" />}
        />
      ) : (
        <ul className="space-y-3">
          {wines.map((wine) =>
            editingId === wine.id ? (
              <li key={wine.id}>
                <WineRowEditor
                  wine={wine}
                  onDone={() => {
                    setEditingId(null);
                    router.refresh();
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={wine.id}
                className="flex min-h-[64px] items-center gap-3 rounded-xl border border-border bg-white p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {wine.name}
                    {wine.vintage != null && (
                      <span className="ml-2 text-muted-foreground">
                        {wine.vintage}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {wine.grapeVariety} · {formatCHF(wine.price)}
                  </p>
                </div>
                <label className="flex min-h-[48px] cursor-pointer items-center gap-2 px-1">
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {wine.available ? t('available') : t('unavailable')}
                  </span>
                  <Switch
                    checked={wine.available}
                    disabled={isPending}
                    onCheckedChange={(checked) =>
                      onToggleAvailable(wine, checked)
                    }
                    aria-label={t('availabilityToggle', { name: wine.name })}
                  />
                </label>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-[44px] min-w-[44px]"
                  onClick={() => setEditingId(wine.id)}
                  aria-label={t('edit', { name: wine.name })}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteTarget(wine)}
                  aria-label={t('delete', { name: wine.name })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            )
          )}
        </ul>
      )}

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('deleteConfirmTitle', { name: deleteTarget?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget !== null && deleteTarget.servedCount > 0
                ? t('deleteConflict')
                : t('deleteConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => {
                if (deleteTarget) onDelete(deleteTarget);
              }}
            >
              {t('deleteConfirmButton')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function WineRowEditor({
  wine,
  onDone,
  onCancel,
}: {
  wine: WineDTO;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('Dashboard.wines');
  const form = useForm<WineFormInput>({
    resolver: zodResolver(wineFormSchema),
    defaultValues: toFormValues(wine),
  });

  async function onSubmit(values: WineFormInput) {
    const input = wineFormToActionInput(values);
    // `available` is owned by the list toggle — not resubmitted here.
    const result = await updateWine({
      wineId: wine.id,
      name: input.name,
      grapeVariety: input.grapeVariety,
      vintage: input.vintage,
      price: input.price,
    });
    if (result.success) {
      toast.success(t('updated', { name: values.name }));
      onDone();
    } else {
      toast.error(t('saveFailed'));
    }
  }

  return (
    <div className="rounded-xl border border-primary/40 bg-white p-4">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-3 sm:grid-cols-[2fr,2fr,1fr,1fr] sm:items-end"
        >
          <WineFormFields control={form.control} />
          <div className="flex gap-2 sm:col-span-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t('saveButton')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
