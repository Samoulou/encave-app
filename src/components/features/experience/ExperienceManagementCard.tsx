'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Clock, Users, Copy, Trash2, Edit, MoreVertical, Send, EyeOff, Archive } from 'lucide-react';
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
        toast.success('Experience published', {
          description: 'Your experience is now visible to visitors.',
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
        toast.success('Experience unpublished', {
          description: 'Your experience is now a draft.',
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
        toast.success('Experience archived', {
          description: 'Your experience has been archived.',
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
        toast.success('Experience duplicated', {
          description: 'A copy has been created as a draft.',
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
        toast.success('Experience deleted', {
          description: 'Your experience has been permanently deleted.',
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
          'group relative flex flex-col bg-white rounded-xl overflow-hidden border border-transparent',
          'hover:border-primary/20 transition-all duration-300 hover:-translate-y-1',
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
          <div className="absolute top-3 left-3">
            <StatusBadge status={experience.status} />
          </div>
          {/* More Menu */}
          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-white/90 hover:bg-white text-gray-700 backdrop-blur-sm shadow-sm h-8 w-8"
                  disabled={isPending}
                >
                  <MoreVertical className="h-4 w-4" />
                  <span className="sr-only">More actions</span>
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
                    Publish
                  </DropdownMenuItem>
                )}
                {experience.status === 'PUBLISHED' && (
                  <DropdownMenuItem
                    onClick={handleUnpublish}
                    disabled={isPending}
                    className="cursor-pointer"
                  >
                    <EyeOff className="mr-2 h-4 w-4" />
                    Unpublish
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleDuplicate}
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
                      onClick={handleArchive}
                      disabled={isPending}
                      className="cursor-pointer text-amber-600 focus:text-amber-600"
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
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
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col flex-1 gap-3">
          <h3 className="text-lg font-bold text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-1">
            {experience.title}
          </h3>

          {/* Meta Info */}
          <div className="flex items-center text-sm text-gray-500 gap-4 mb-2">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {formatDuration(experience.duration)}
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4" aria-hidden="true" />
              Max {experience.maxCapacity}
            </div>
          </div>

          {/* Footer with Price and Actions */}
          <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xl font-bold text-foreground">
              {formatPrice(experience.price)}
              <span className="text-xs font-normal text-gray-500 ml-1">/ pp</span>
            </span>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-primary hover:bg-primary/5"
                onClick={handleDuplicate}
                disabled={isPending}
                title="Duplicate"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50"
                onClick={() => setDeleteModalOpen(true)}
                disabled={isPending}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                asChild
                size="sm"
                className="ml-1 bg-primary/10 hover:bg-primary text-primary hover:text-white font-bold"
              >
                <Link href={`/dashboard/experiences/${experience.id}/edit`}>
                  Edit
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
