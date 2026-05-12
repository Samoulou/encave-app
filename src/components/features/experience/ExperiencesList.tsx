'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  MoreHorizontal,
  Edit,
  Eye,
  Send,
  EyeOff,
  Archive,
  Copy,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusBadge } from './StatusBadge';
import { ArchiveConfirmModal } from './ArchiveConfirmModal';
import {
  publishExperience,
  unpublishExperience,
  archiveExperience,
  duplicateExperience,
} from '@/server/actions/experience';
import type { ExperienceType, ExperienceStatus } from '@prisma/client';

const TYPE_LABELS: Record<ExperienceType, string> = {
  TASTING: 'Tasting',
  CELLAR_VISIT: 'Cellar Visit',
  WORKSHOP: 'Workshop',
  VINEYARD_TOUR: 'Vineyard Tour',
  FOOD_PAIRING: 'Food Pairing',
};

interface Experience {
  id: string;
  title: string;
  slug: string;
  type: ExperienceType;
  duration: number;
  price: number;
  status: ExperienceStatus;
  coverPhoto: string;
  updatedAt: Date;
}

interface ExperiencesListProps {
  experiences: Experience[];
}

export function ExperiencesList({ experiences }: ExperiencesListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [experienceToArchive, setExperienceToArchive] =
    useState<Experience | null>(null);

  const handlePublish = async (experienceId: string) => {
    startTransition(async () => {
      const result = await publishExperience(experienceId);
      if (result.success) {
        toast.success('Experience published', {
          description: 'Your experience is now visible to visitors.',
        });
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  };

  const handleUnpublish = async (experienceId: string) => {
    startTransition(async () => {
      const result = await unpublishExperience(experienceId);
      if (result.success) {
        toast.success('Experience unpublished', {
          description: 'Your experience is now a draft.',
        });
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  };

  const handleArchiveClick = (experience: Experience) => {
    setExperienceToArchive(experience);
    setArchiveModalOpen(true);
  };

  const handleArchiveConfirm = async () => {
    if (!experienceToArchive) return;

    startTransition(async () => {
      const result = await archiveExperience(experienceToArchive.id);
      if (result.success) {
        toast.success('Experience archived', {
          description: 'Your experience has been archived.',
        });
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
      setArchiveModalOpen(false);
      setExperienceToArchive(null);
    });
  };

  const handleDuplicate = async (experienceId: string) => {
    startTransition(async () => {
      const result = await duplicateExperience(experienceId);
      if (result.success) {
        toast.success('Experience duplicated', {
          description: 'A copy has been created as a draft.',
        });
        router.refresh();
      } else {
        toast.error(result.error.message);
      }
    });
  };

  const formatDuration = (minutes: number): string => {
    if (minutes >= 60) {
      const hours = minutes / 60;
      return hours === 1 ? '1 hour' : `${hours} hours`;
    }
    return `${minutes} min`;
  };

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {experiences.map((experience) => (
          <Card
            key={experience.id}
            className="group overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-warm-lg"
          >
            {/* Cover Photo */}
            <div className="relative aspect-video bg-slate-100">
              {experience.coverPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={experience.coverPhoto}
                  alt={experience.title}
                  className="h-full w-full object-cover"
                />
              )}
              {/* Status Badge */}
              <div className="absolute left-2 top-2">
                <StatusBadge status={experience.status} />
              </div>
              {/* Type Badge */}
              <div className="absolute right-2 top-2">
                <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-slate-700 shadow-sm">
                  {TYPE_LABELS[experience.type]}
                </span>
              </div>
            </div>

            {/* Content */}
            <CardContent className="p-4">
              <h3 className="line-clamp-1 font-display text-lg font-semibold text-slate-900">
                {experience.title}
              </h3>

              <div className="mt-2 flex items-center gap-3 text-sm text-slate-600">
                <span className="font-medium">
                  CHF {(experience.price / 100).toFixed(0)}
                </span>
                <span className="text-slate-400">·</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(experience.duration)}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Updated {formatDistanceToNow(new Date(experience.updatedAt))}{' '}
                ago
              </p>

              {/* Actions */}
              <div className="mt-4 flex items-center gap-2">
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <Link href={`/dashboard/experiences/${experience.id}/edit`}>
                    <Edit className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Link>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 w-9 p-0"
                      disabled={isPending}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">More actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link
                        href={`/dashboard/experiences/${experience.id}/preview`}
                        target="_blank"
                        className="cursor-pointer"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Preview
                      </Link>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    {experience.status === 'DRAFT' && (
                      <DropdownMenuItem
                        onClick={() => handlePublish(experience.id)}
                        disabled={isPending}
                        className="cursor-pointer text-green-600 focus:text-green-600"
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Publish
                      </DropdownMenuItem>
                    )}

                    {experience.status === 'PUBLISHED' && (
                      <DropdownMenuItem
                        onClick={() => handleUnpublish(experience.id)}
                        disabled={isPending}
                        className="cursor-pointer"
                      >
                        <EyeOff className="mr-2 h-4 w-4" />
                        Unpublish
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem
                      onClick={() => handleDuplicate(experience.id)}
                      disabled={isPending}
                      className="cursor-pointer"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate
                    </DropdownMenuItem>

                    {experience.status !== 'ARCHIVED' && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleArchiveClick(experience)}
                          disabled={isPending}
                          className="cursor-pointer text-amber-600 focus:text-amber-600"
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          Archive
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Archive Confirmation Modal */}
      <ArchiveConfirmModal
        open={archiveModalOpen}
        onOpenChange={setArchiveModalOpen}
        experienceTitle={experienceToArchive?.title ?? ''}
        onConfirm={handleArchiveConfirm}
        isPending={isPending}
      />
    </>
  );
}
