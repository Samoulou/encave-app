'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { ImageWithFallback } from '@/components/shared/ImageWithFallback';
import { uploadExperienceImage } from '@/server/actions/experience';
import {
  addEventParticipant,
  removeEventParticipant,
  reorderEventParticipants,
} from '@/server/actions/eventParticipant';
import type {
  ManageableParticipantDTO,
  SelectableWineryDTO,
} from '@/server/queries/event-participant.queries';

interface EventParticipantsPanelProps {
  experienceId: string;
  initialParticipants: ManageableParticipantDTO[];
  selectableWineries: SelectableWineryDTO[];
}

/**
 * Organizer-side management of a collective event's participating wineries
 * (P-11 / L-100). Separate from the react-hook-form editor — it owns its own
 * server actions (add/remove/reorder) and refreshes the server-rendered list
 * after each mutation, mirroring AvailabilityScheduleBuilder /
 * WineryMonetizationPanel.
 */
export function EventParticipantsPanel({
  experienceId,
  initialParticipants,
  selectableWineries,
}: EventParticipantsPanelProps) {
  const t = useTranslations('experience.collective.panel');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [wineryId, setWineryId] = useState('');
  const [description, setDescription] = useState('');
  const [logo, setLogo] = useState<string | null>(null);

  const addedWineryIds = useMemo(
    () => new Set(initialParticipants.map((p) => p.wineryId)),
    [initialParticipants]
  );
  const availableWineries = useMemo(
    () => selectableWineries.filter((w) => !addedWineryIds.has(w.id)),
    [selectableWineries, addedWineryIds]
  );

  function resetAddForm() {
    setWineryId('');
    setDescription('');
    setLogo(null);
  }

  function handleAdd() {
    if (!wineryId) {
      toast.error(t('selectWineryFirst'));
      return;
    }
    startTransition(async () => {
      const result = await addEventParticipant({
        experienceId,
        wineryId,
        description: description.trim() || undefined,
        logo: logo ?? undefined,
      });
      if (result.success) {
        toast.success(t('added'));
        resetAddForm();
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  function handleRemove(participantId: string) {
    startTransition(async () => {
      const result = await removeEventParticipant({ participantId });
      if (result.success) {
        toast.success(t('removed'));
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  function handleMove(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= initialParticipants.length) return;
    const reordered = [...initialParticipants];
    const [moved] = reordered.splice(index, 1);
    if (!moved) return;
    reordered.splice(target, 0, moved);
    const items = reordered.map((participant, order) => ({
      participantId: participant.id,
      order,
    }));
    startTransition(async () => {
      const result = await reorderEventParticipants({ experienceId, items });
      if (result.success) {
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Current participants */}
      {initialParticipants.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 p-6 text-center text-sm text-slate-600">
          {t('empty')}
        </div>
      ) : (
        <ul className="space-y-3" data-testid="participants-list">
          {initialParticipants.map((participant, index) => (
            <li
              key={participant.id}
              className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-3"
            >
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-cream-200">
                <ImageWithFallback
                  src={participant.logoUrl ?? ''}
                  alt={participant.wineryName}
                  fill
                  className="object-cover"
                  sizes="44px"
                  unoptimized
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">
                  {participant.wineryName}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {participant.commune}
                  {participant.description
                    ? ` · ${participant.description}`
                    : ''}
                </p>
                {!participant.wineryVisible && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    {t('hiddenWarning')}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending || index === 0}
                  onClick={() => handleMove(index, -1)}
                  aria-label={t('moveUp')}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={
                    isPending || index === initialParticipants.length - 1
                  }
                  onClick={() => handleMove(index, 1)}
                  aria-label={t('moveDown')}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isPending}
                  onClick={() => handleRemove(participant.id)}
                  aria-label={t('remove')}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add participant */}
      <div className="space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
        <p className="font-medium text-slate-900">{t('addTitle')}</p>
        {availableWineries.length === 0 ? (
          <p className="text-sm text-slate-500">{t('noWineriesLeft')}</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Select value={wineryId} onValueChange={setWineryId}>
                <SelectTrigger data-testid="participant-winery-select">
                  <SelectValue placeholder={t('selectWinery')} />
                </SelectTrigger>
                <SelectContent>
                  {availableWineries.map((winery) => (
                    <SelectItem key={winery.id} value={winery.id}>
                      {winery.name} · {winery.commune}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-stone-200 bg-white">
                <ImageUpload
                  value={logo}
                  onChange={setLogo}
                  onUpload={async (file) => {
                    const formData = new FormData();
                    formData.append('file', file);
                    const result = await uploadExperienceImage(formData);
                    if (!result.success) {
                      throw new Error(result.error.message);
                    }
                    setLogo(result.data.url);
                    return result.data.url;
                  }}
                  aspectRatio="1/1"
                  placeholder={t('logo')}
                  variant="empty"
                  className="h-full w-full"
                />
              </div>
            </div>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('descriptionPlaceholder')}
              maxLength={500}
              className="min-h-[80px] resize-none bg-white"
            />
            <Button type="button" onClick={handleAdd} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('adding')}
                </>
              ) : (
                t('add')
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
