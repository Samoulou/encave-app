'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Clock,
  Users,
  Copy,
  Trash2,
  Edit,
  MoreVertical,
  Send,
  EyeOff,
  Archive,
  ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from './StatusBadge';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import {
  duplicateExperience,
  deleteExperience,
  publishExperience,
  unpublishExperience,
  archiveExperience,
} from '@/server/actions/experience';
import type { ExperienceStatus } from '@prisma/client';
import { cn } from '@/lib/utils';

interface ExperienceManagementCardProps {
  experience: {
    id: string;
    title: string;
    duration: number;
    price: number;
    maxCapacity: number;
    status: ExperienceStatus;
    coverPhoto: string;
  };
}

export function ExperienceManagementCard({
  experience,
}: ExperienceManagementCardProps) {
  const router = useRouter();
  const t = useTranslations('experience');
  const tCommon = useTranslations('common.buttons');
  const [isPending, startTransition] = useTransition();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const formatDuration = (minutes: number): string => {
    if (minutes >= 60) {
      const hours = minutes / 60;
      if (hours === 1) return '1 hr';
      if (Number.isInteger(hours)) return `${hours} hrs`;
      return `${hours.toFixed(1)} hrs`;
    }
    return `${minutes} min`;
  };

  const formatPrice = (cents: number): string => {
    return `CHF ${(cents / 100).toFixed(2)}`;
  };

  const handlePublish = async () => {
    startTransition(async () => {
      const result = await publishExperience(experience.id);
      if (result.success) {
        toast.success(t('publishedSuccess'), {
          description: t('publishedDescription'),
        });
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  };

  const handleUnpublish = async () => {
    startTransition(async () => {
      const result = await unpublishExperience(experience.id);
      if (result.success) {
        toast.success(t('unpublishedSuccess'), {
          description: t('unpublishedDescription'),
        });
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  };

  const handleArchive = async () => {
    startTransition(async () => {
      const result = await archiveExperience(experience.id);
      if (result.success) {
        toast.success(t('archivedSuccess'), {
          description: t('archivedDescription'),
        });
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  };

  const handleDuplicate = async () => {
    startTransition(async () => {
      const result = await duplicateExperience(experience.id);
      if (result.success) {
        toast.success(t('duplicatedSuccess'), {
          description: t('duplicatedDescription'),
        });
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  };

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteExperience(experience.id);
      if (result.success) {
        toast.success(t('deletedSuccess'), {
          description: t('deletedDescription'),
        });
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
      setDeleteModalOpen(false);
    });
  };

  const isDraft = experience.status === 'DRAFT';

  return (
    <>
      <div
        className={cn(
          'group relative flex flex-col overflow-hidden rounded-xl border border-transparent bg-white',
          'transition-all duration-300 hover:-translate-y-1 hover:border-primary/20',
          'shadow-card hover:shadow-card-hover'
        )}
      >
        {/* Image Area */}
        <div className="relative aspect-[3/2] w-full overflow-hidden">
          <div
            className={cn(
              'absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105',
              isDraft && 'grayscale-[30%]'
            )}
            style={{
              backgroundImage: experience.coverPhoto
                ? `url("${experience.coverPhoto}")`
                : 'linear-gradient(135deg, #f5f5f4 0%, #e7e5e4 100%)',
            }}
          />
          {/* Status Badge */}
          <div className="absolute left-3 top-3">
            <StatusBadge status={experience.status} />
          </div>
          {/* More Menu */}
          <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 bg-white/90 text-gray-700 shadow-sm backdrop-blur-sm hover:bg-white"
                  disabled={isPending}
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">{t('moreActions')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {experience.status === 'DRAFT' && (
                  <DropdownMenuItem
                    onClick={handlePublish}
                    disabled={isPending}
                    className="cursor-pointer text-green-600 focus:text-green-600"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {t('publish')}
                  </DropdownMenuItem>
                )}
                {experience.status === 'PUBLISHED' && (
                  <DropdownMenuItem
                    onClick={handleUnpublish}
                    disabled={isPending}
                    className="cursor-pointer"
                  >
                    <EyeOff className="mr-2 h-4 w-4" />
                    {t('unpublish')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleDuplicate}
                  disabled={isPending}
                  className="cursor-pointer"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  {t('duplicate')}
                </DropdownMenuItem>
                {experience.status !== 'ARCHIVED' && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleArchive}
                      disabled={isPending}
                      className="cursor-pointer text-amber-600 focus:text-amber-600"
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      {t('archive')}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDeleteModalOpen(true)}
                  disabled={isPending}
                  className="cursor-pointer text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {tCommon('delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-3 p-5">
          <h3 className="line-clamp-1 text-lg font-bold leading-tight text-foreground transition-colors group-hover:text-primary">
            {experience.title}
          </h3>

          {/* Meta Info */}
          <div className="mb-2 flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {formatDuration(experience.duration)}
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" aria-hidden="true" />
              {t('maxGuests2', { count: experience.maxCapacity })}
            </div>
          </div>

          {/* Footer with Price and Actions */}
          <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="text-xl font-bold text-foreground">
              {formatPrice(experience.price)}
              <span className="ml-1 text-xs font-normal text-gray-500">
                {t('perPerson')}
              </span>
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:bg-primary/5 hover:text-primary"
                onClick={handleDuplicate}
                disabled={isPending}
                title={t('duplicate')}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:bg-red-50 hover:text-red-500"
                onClick={() => setDeleteModalOpen(true)}
                disabled={isPending}
                title={tCommon('delete')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                asChild
                size="sm"
                className="ml-1 bg-primary font-bold text-white shadow-lg shadow-primary/20 hover:bg-[hsl(var(--primary-hover))]"
              >
                <Link href={`/dashboard/experiences/${experience.id}/sessions`}>
                  <ClipboardList className="mr-1 h-3.5 w-3.5" />
                  Inscrits
                </Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="font-bold"
              >
                <Link href={`/dashboard/experiences/${experience.id}/edit`}>
                  {tCommon('edit')}
                  <Edit className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        experienceTitle={experience.title}
        onConfirm={handleDeleteConfirm}
        isPending={isPending}
      />
    </>
  );
}
