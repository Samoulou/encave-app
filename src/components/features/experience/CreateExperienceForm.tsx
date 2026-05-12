'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Info,
  SlidersHorizontal,
  ImageIcon,
  CalendarClock,
  MapPin,
  AlertTriangle,
  Send,
  Save,
} from 'lucide-react';
import {
  createExperienceSchema,
  type CreateExperienceInput,
} from '@/lib/validators/experience';
import {
  createExperience,
  uploadExperienceImage,
  deleteUploadedImage,
  publishExperience,
} from '@/server/actions/experience';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Form } from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  BasicInfoSection,
  DetailsSection,
  MediaSection,
  AvailabilitySection,
  LocationSection,
} from './form-sections';
import type {
  GalleryImage,
  AddressData,
  AvailabilitySlot,
  DayOfWeek,
} from './form-sections';

// Form sections for navigation
const FORM_SECTIONS = [
  { id: 'general', label: 'General Info', icon: Info },
  { id: 'details', label: 'Details', icon: SlidersHorizontal },
  { id: 'media', label: 'Media', icon: ImageIcon },
  { id: 'availability', label: 'Availability', icon: CalendarClock },
  { id: 'location', label: 'Location', icon: MapPin },
] as const;

export function CreateExperienceForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [createdExperienceId, setCreatedExperienceId] = useState<string | null>(
    null
  );
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublishEnabled, setIsPublishEnabled] = useState(false);
  const [activeSection, setActiveSection] = useState('general');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [availabilitySlots, setAvailabilitySlots] = useState<
    AvailabilitySlot[]
  >([
    {
      id: '1',
      days: ['MON', 'WED', 'FRI'],
      timeSlots: [
        { start: '09:00', end: '11:30' },
        { start: '14:00', end: '16:30' },
      ],
    },
  ]);

  // Track which time slot is being edited: { slotId, timeSlotIndex }
  const [editingTimeSlot, setEditingTimeSlot] = useState<{
    slotId: string;
    timeSlotIndex: number;
  } | null>(null);

  // Location state
  const [location, setLocation] = useState<AddressData>({
    street: '',
    city: '',
    zipCode: '',
    latitude: null,
    longitude: null,
    fullAddress: '',
  });

  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const form = useForm<CreateExperienceInput>({
    resolver: zodResolver(createExperienceSchema),
    defaultValues: {
      title: '',
      type: undefined,
      description: '',
      duration: 150, // 2.5 hours in minutes
      price: undefined,
      minCapacity: 1,
      maxCapacity: 12,
    },
  });

  // Track form changes
  useEffect(() => {
    const subscription = form.watch(() => {
      setHasUnsavedChanges(true);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Intersection observer for active section tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0 }
    );

    Object.values(sectionRefs.current).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, []);

  const handleImageUpload = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const result = await uploadExperienceImage(formData);

    if (!result.success) {
      throw new Error(result.error.message);
    }

    return result.data.url;
  };

  const handleGalleryUpload = async (
    file: File,
    index: number
  ): Promise<void> => {
    setUploadingIndex(index);
    try {
      const url = await handleImageUpload(file);
      setGalleryImages((prev) => [
        ...prev,
        {
          id: `temp-${Date.now()}`,
          url,
          order: prev.length,
          isCover: prev.length === 0,
        },
      ]);
      setHasUnsavedChanges(true);
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleRemoveGalleryImage = async (
    imageId: string,
    imageUrl: string
  ) => {
    await deleteUploadedImage(imageUrl);
    setGalleryImages((prev) => {
      const filtered = prev.filter((img) => img.id !== imageId);
      // If removed image was cover, make first remaining image the cover
      const firstImage = filtered[0];
      if (firstImage && !filtered.some((img) => img.isCover)) {
        firstImage.isCover = true;
      }
      return filtered;
    });
    setHasUnsavedChanges(true);
  };

  const handleSaveDraft = useCallback(async () => {
    const data = form.getValues();

    // Basic validation for draft
    if (!data.title) {
      toast.error('Please enter a title');
      return;
    }

    setIsSubmitting(true);

    try {
      const coverPhoto =
        galleryImages.find((img) => img.isCover)?.url || galleryImages[0]?.url;
      const galleryUrls = galleryImages
        .filter((img) => !img.isCover)
        .map((img) => img.url);

      if (!coverPhoto) {
        toast.error('Please upload at least one image');
        setIsSubmitting(false);
        return;
      }

      // Add location and availability to the data
      const dataWithExtras = {
        ...data,
        location: {
          street: location.street,
          city: location.city,
          zipCode: location.zipCode,
          latitude: location.latitude,
          longitude: location.longitude,
        },
        availabilitySlots: availabilitySlots
          .filter((slot) => slot.days.length > 0 && slot.timeSlots.length > 0)
          .map(({ days, timeSlots }) => ({ days, timeSlots })),
      };

      const result = await createExperience(
        dataWithExtras,
        coverPhoto,
        galleryUrls
      );

      if (result.success) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        setCreatedExperienceId(result.data.experienceId);
        toast.success('Draft saved');
      } else {
        toast.error(result.error.message);
      }
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, galleryImages, location, availabilitySlots]);

  const onSubmit = useCallback(
    async (data: CreateExperienceInput) => {
      const coverPhoto =
        galleryImages.find((img) => img.isCover)?.url || galleryImages[0]?.url;

      if (!coverPhoto) {
        toast.error('Please upload at least one image');
        return;
      }

      setIsSubmitting(true);

      try {
        const galleryUrls = galleryImages
          .filter((img) => !img.isCover)
          .map((img) => img.url);

        // Add location and availability to the data
        const dataWithExtras = {
          ...data,
          location: {
            street: location.street,
            city: location.city,
            zipCode: location.zipCode,
            latitude: location.latitude,
            longitude: location.longitude,
          },
          availabilitySlots: availabilitySlots
            .filter((slot) => slot.days.length > 0 && slot.timeSlots.length > 0)
            .map(({ days, timeSlots }) => ({ days, timeSlots })),
        };

        const result = await createExperience(
          dataWithExtras,
          coverPhoto,
          galleryUrls
        );

        if (result.success) {
          toast.success('Experience created successfully');
          setHasUnsavedChanges(false);
          setCreatedExperienceId(result.data.experienceId);

          if (isPublishEnabled) {
            // Auto-publish if toggle is on
            const publishResult = await publishExperience(
              result.data.experienceId
            );
            if (publishResult.success) {
              toast.success('Experience published!');
              router.push('/dashboard/experiences');
            } else {
              setShowPublishDialog(true);
            }
          } else {
            router.push('/dashboard/experiences');
          }
        } else {
          toast.error(result.error.message);
        }
      } catch {
        toast.error('Something went wrong. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [galleryImages, isPublishEnabled, router, location, availabilitySlots]
  );

  const handlePublishNow = async () => {
    if (!createdExperienceId) return;

    setIsPublishing(true);
    try {
      const result = await publishExperience(createdExperienceId);
      if (result.success) {
        toast.success('Experience published!');
      } else {
        toast.error(result.error.message);
      }
    } catch {
      toast.error('Failed to publish.');
    } finally {
      setIsPublishing(false);
      setShowPublishDialog(false);
      router.push('/dashboard/experiences');
    }
  };

  const scrollToSection = (sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ===== Availability Handlers =====

  const handleDayToggle = (
    slotId: string,
    dayValue: string,
    isSelected: boolean
  ) => {
    setAvailabilitySlots((prev) =>
      prev.map((s) =>
        s.id === slotId
          ? {
              ...s,
              days: isSelected
                ? s.days.filter((d) => d !== dayValue)
                : [...s.days, dayValue as DayOfWeek],
            }
          : s
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleEditTimeSlot = (slotId: string, timeSlotIndex: number) => {
    setEditingTimeSlot({ slotId, timeSlotIndex });
  };

  const handleSaveTimeSlot = (start: string, end: string) => {
    if (!editingTimeSlot) return;

    setAvailabilitySlots((prev) =>
      prev.map((slot) =>
        slot.id === editingTimeSlot.slotId
          ? {
              ...slot,
              timeSlots: slot.timeSlots.map((ts, idx) =>
                idx === editingTimeSlot.timeSlotIndex ? { start, end } : ts
              ),
            }
          : slot
      )
    );
    setEditingTimeSlot(null);
    setHasUnsavedChanges(true);
  };

  const handleCancelEdit = () => {
    setEditingTimeSlot(null);
  };

  const handleDeleteTimeSlot = (slotId: string, timeSlotIndex: number) => {
    setAvailabilitySlots((prev) => {
      const slot = prev.find((s) => s.id === slotId);
      if (!slot) return prev;

      // If only one time slot, remove entire pattern
      if (slot.timeSlots.length === 1) {
        // If this is the last pattern, show warning and keep it
        if (prev.length === 1) {
          toast.error('At least one schedule pattern is required');
          return prev;
        }
        return prev.filter((s) => s.id !== slotId);
      }

      // Otherwise, just remove the time slot
      return prev.map((s) =>
        s.id === slotId
          ? {
              ...s,
              timeSlots: s.timeSlots.filter((_, idx) => idx !== timeSlotIndex),
            }
          : s
      );
    });
    setHasUnsavedChanges(true);
  };

  const handleAddTimeSlot = (slotId: string) => {
    setAvailabilitySlots((prev) =>
      prev.map((slot) => {
        if (slot.id !== slotId) return slot;

        // Calculate a sensible default time based on existing slots
        const lastSlot = slot.timeSlots[slot.timeSlots.length - 1];
        let newStart = '10:00';
        let newEnd = '12:00';

        if (lastSlot) {
          // Try to add 2 hours after the last slot's end time
          const [hours, minutes] = lastSlot.end.split(':').map(Number);
          const newStartHours = (hours ?? 0) + 1;
          if (newStartHours < 22) {
            newStart = `${newStartHours.toString().padStart(2, '0')}:${(minutes ?? 0).toString().padStart(2, '0')}`;
            const newEndHours = newStartHours + 2;
            newEnd = `${Math.min(newEndHours, 23).toString().padStart(2, '0')}:${(minutes ?? 0).toString().padStart(2, '0')}`;
          }
        }

        return {
          ...slot,
          timeSlots: [...slot.timeSlots, { start: newStart, end: newEnd }],
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleDeletePattern = (slotId: string) => {
    if (availabilitySlots.length === 1) {
      toast.error('At least one schedule pattern is required');
      return;
    }
    setAvailabilitySlots((prev) => prev.filter((s) => s.id !== slotId));
    setHasUnsavedChanges(true);
  };

  const handleAddPattern = () => {
    setAvailabilitySlots((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        days: [],
        timeSlots: [{ start: '10:00', end: '12:00' }],
      },
    ]);
    setHasUnsavedChanges(true);
  };

  const maxGalleryImages = 5;
  const canAddMoreImages = galleryImages.length < maxGalleryImages;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Page Header */}
      <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-10">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <h1 className="mb-2 font-display text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
              Create New Experience
            </h1>
            <p className="text-base text-slate-500">
              Fill in the details to list your wine experience on the
              marketplace.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {lastSaved && (
              <div className="hidden items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-slate-400 sm:flex">
                <span className="block size-2 rounded-full bg-emerald-500" />
                Draft Auto-Saved
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="h-10 gap-2"
            >
              <Save className="h-4 w-4" />
              Save Draft
            </Button>
            <Button
              type="button"
              onClick={form.handleSubmit(onSubmit)}
              disabled={isSubmitting || galleryImages.length === 0}
              className="h-10 gap-2"
            >
              <Send className="h-4 w-4" />
              Publish
            </Button>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Left Column: Form Sections */}
          <div className="flex flex-col gap-8 lg:col-span-8">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8"
              >
                <BasicInfoSection
                  form={form}
                  sectionRef={(el) => {
                    sectionRefs.current['general'] = el;
                  }}
                />

                <DetailsSection
                  form={form}
                  sectionRef={(el) => {
                    sectionRefs.current['details'] = el;
                  }}
                />

                <MediaSection
                  galleryImages={galleryImages}
                  canAddMoreImages={canAddMoreImages}
                  uploadingIndex={uploadingIndex}
                  onGalleryUpload={handleGalleryUpload}
                  onRemoveGalleryImage={handleRemoveGalleryImage}
                  sectionRef={(el) => {
                    sectionRefs.current['media'] = el;
                  }}
                />

                <AvailabilitySection
                  availabilitySlots={availabilitySlots}
                  editingTimeSlot={editingTimeSlot}
                  onDayToggle={handleDayToggle}
                  onEditTimeSlot={handleEditTimeSlot}
                  onSaveTimeSlot={handleSaveTimeSlot}
                  onCancelEdit={handleCancelEdit}
                  onDeleteTimeSlot={handleDeleteTimeSlot}
                  onAddTimeSlot={handleAddTimeSlot}
                  onDeletePattern={handleDeletePattern}
                  onAddPattern={handleAddPattern}
                  sectionRef={(el) => {
                    sectionRefs.current['availability'] = el;
                  }}
                />

                <LocationSection
                  location={location}
                  onLocationChange={setLocation}
                  sectionRef={(el) => {
                    sectionRefs.current['location'] = el;
                  }}
                />
              </form>
            </Form>
          </div>

          {/* Right Column: Sticky Sidebar */}
          <div className="space-y-6 lg:sticky lg:top-24 lg:col-span-4">
            {/* Publish Status Card */}
            <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                Publish Status
              </h3>
              <div className="mb-4 flex items-center justify-between">
                <span className="font-medium text-slate-900">
                  Visible on marketplace
                </span>
                <Switch
                  checked={isPublishEnabled}
                  onCheckedChange={setIsPublishEnabled}
                />
              </div>
              <div className="flex items-start gap-2 rounded border border-amber-100 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Your experience is currently in <strong>Draft</strong> mode.
                  Publish to start accepting bookings.
                </span>
              </div>
            </div>

            {/* Section Navigation */}
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
              <div className="border-b border-stone-100 bg-stone-50/50 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Form Sections
                </h3>
              </div>
              <div className="flex flex-col">
                {FORM_SECTIONS.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      className={cn(
                        'flex items-center gap-3 border-l-2 px-4 py-3 text-left text-sm font-medium transition-colors',
                        isActive
                          ? 'border-primary bg-stone-50 text-slate-700'
                          : 'border-transparent text-slate-500 hover:bg-stone-50 hover:text-slate-900'
                      )}
                    >
                      <Icon
                        className={cn('h-4 w-4', isActive && 'text-primary')}
                        aria-hidden="true"
                      />
                      {section.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Help Widget */}
            <div className="group relative cursor-pointer overflow-hidden rounded-xl bg-indigo-900 p-5 text-white">
              <div className="absolute -right-4 -top-4 size-24 rounded-full bg-white/10 transition-transform group-hover:scale-110" />
              <h3 className="relative z-10 mb-1 font-bold">Need Help?</h3>
              <p className="relative z-10 mb-3 text-sm text-indigo-200">
                Check our guide on how to create the perfect wine experience
                listing.
              </p>
              <span className="relative z-10 text-xs font-bold underline">
                Read Guide →
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Publish Prompt Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Experience Created!</DialogTitle>
            <DialogDescription>
              Your experience has been saved as a draft. Would you like to
              publish it now so visitors can see it?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setShowPublishDialog(false);
                router.push('/dashboard/experiences');
              }}
              disabled={isPublishing}
              className="w-full sm:w-auto"
            >
              Keep as Draft
            </Button>
            <Button
              onClick={handlePublishNow}
              disabled={isPublishing}
              className="w-full sm:w-auto"
            >
              {isPublishing ? 'Publishing...' : 'Publish Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
