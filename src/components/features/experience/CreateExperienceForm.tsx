'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Image from 'next/image';
import {
  Upload,
  Info,
  SlidersHorizontal,
  ImageIcon,
  CalendarClock,
  MapPin,
  Wine,
  Compass,
  UtensilsCrossed,
  GraduationCap,
  Plus,
  Trash2,
  Eye,
  Clock,
  Users,
  AlertTriangle,
  Send,
  Save,
} from 'lucide-react';
import {
  createExperienceSchema,
  type CreateExperienceInput,
  DURATION_OPTIONS,
} from '@/lib/validators/experience';
import {
  createExperience,
  uploadExperienceImage,
  deleteUploadedImage,
  publishExperience,
} from '@/server/actions/experience';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { AddressAutocomplete } from './AddressAutocomplete';

interface AddressData {
  street: string;
  city: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
  fullAddress: string;
}

// Experience type options with icons
const EXPERIENCE_TYPES = [
  { value: 'TASTING', label: 'Tasting', icon: Wine },
  { value: 'VINEYARD_TOUR', label: 'Tour', icon: Compass },
  { value: 'FOOD_PAIRING', label: 'Dinner', icon: UtensilsCrossed },
  { value: 'WORKSHOP', label: 'Class', icon: GraduationCap },
] as const;

// Form sections for navigation
const FORM_SECTIONS = [
  { id: 'general', label: 'General Info', icon: Info },
  { id: 'details', label: 'Details', icon: SlidersHorizontal },
  { id: 'media', label: 'Media', icon: ImageIcon },
  { id: 'availability', label: 'Availability', icon: CalendarClock },
  { id: 'location', label: 'Location', icon: MapPin },
] as const;

// Days of week
const DAYS_OF_WEEK = [
  { value: 'MON', label: 'Mon' },
  { value: 'TUE', label: 'Tue' },
  { value: 'WED', label: 'Wed' },
  { value: 'THU', label: 'Thu' },
  { value: 'FRI', label: 'Fri' },
  { value: 'SAT', label: 'Sat' },
  { value: 'SUN', label: 'Sun' },
] as const;

interface GalleryImage {
  id: string;
  url: string;
  order: number;
  isCover?: boolean;
}

interface AvailabilitySlot {
  id: string;
  days: string[];
  timeSlots: { start: string; end: string }[];
}

// Section Header Component matching mockup style
function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
      <span className="bg-primary/10 text-primary p-1.5 rounded-md flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </span>
      {title}
    </h2>
  );
}

export function CreateExperienceForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [createdExperienceId, setCreatedExperienceId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublishEnabled, setIsPublishEnabled] = useState(false);
  const [activeSection, setActiveSection] = useState('general');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([
    {
      id: '1',
      days: ['MON', 'WED', 'FRI'],
      timeSlots: [
        { start: '09:00', end: '11:30' },
        { start: '14:00', end: '16:30' },
      ],
    },
  ]);

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

  const handleGalleryUpload = async (file: File, index: number): Promise<void> => {
    setUploadingIndex(index);
    try {
      const url = await handleImageUpload(file);
      setGalleryImages((prev) => [
        ...prev,
        { id: `temp-${Date.now()}`, url, order: prev.length, isCover: prev.length === 0 },
      ]);
      setHasUnsavedChanges(true);
    } catch {
      toast.error('Failed to upload image');
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleRemoveGalleryImage = async (imageId: string, imageUrl: string) => {
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
      const coverPhoto = galleryImages.find((img) => img.isCover)?.url || galleryImages[0]?.url;
      const galleryUrls = galleryImages.filter((img) => !img.isCover).map((img) => img.url);

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
        availabilitySlots: availabilitySlots.filter((slot) => slot.days.length > 0 && slot.timeSlots.length > 0),
      };

      const result = await createExperience(dataWithExtras, coverPhoto, galleryUrls);

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
      const coverPhoto = galleryImages.find((img) => img.isCover)?.url || galleryImages[0]?.url;

      if (!coverPhoto) {
        toast.error('Please upload at least one image');
        return;
      }

      setIsSubmitting(true);

      try {
        const galleryUrls = galleryImages.filter((img) => !img.isCover).map((img) => img.url);

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
          availabilitySlots: availabilitySlots.filter((slot) => slot.days.length > 0 && slot.timeSlots.length > 0),
        };

        const result = await createExperience(dataWithExtras, coverPhoto, galleryUrls);

        if (result.success) {
          toast.success('Experience created successfully');
          setHasUnsavedChanges(false);
          setCreatedExperienceId(result.data.experienceId);

          if (isPublishEnabled) {
            // Auto-publish if toggle is on
            const publishResult = await publishExperience(result.data.experienceId);
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

  const maxGalleryImages = 5;
  const canAddMoreImages = galleryImages.length < maxGalleryImages;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Page Header */}
      <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div className="max-w-xl">
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
              Create New Experience
            </h1>
            <p className="text-slate-500 text-base">
              Fill in the details to list your wine experience on the marketplace.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {lastSaved && (
              <div className="hidden sm:flex text-xs text-slate-400 font-medium items-center gap-1.5 bg-stone-100 px-3 py-1.5 rounded-full">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Form Sections */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                {/* Section 1: General Info */}
                <section
                  ref={(el) => {
                    sectionRefs.current['general'] = el;
                  }}
                  id="general"
                  className="bg-white border border-stone-200 rounded-xl p-6 md:p-8 scroll-mt-24 shadow-sm"
                >
                  <SectionHeader icon={Info} title="General Info" />
                  <div className="space-y-6">
                    {/* Title */}
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Experience Title
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g. Sunset Vineyard Tasting & Tour"
                              className="bg-slate-50 border-stone-200 rounded-lg px-4 py-3 h-auto focus:ring-2 focus:ring-primary focus:border-primary"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Experience Type - Radio Cards */}
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Experience Type
                          </FormLabel>
                          <FormControl>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {EXPERIENCE_TYPES.map((type) => {
                                const Icon = type.icon;
                                const isSelected = field.value === type.value;
                                return (
                                  <label key={type.value} className="cursor-pointer">
                                    <input
                                      type="radio"
                                      className="peer sr-only"
                                      name="type"
                                      value={type.value}
                                      checked={isSelected}
                                      onChange={() => field.onChange(type.value)}
                                    />
                                    <div
                                      className={cn(
                                        'border rounded-lg p-3 text-center transition-all',
                                        isSelected
                                          ? 'bg-primary text-white border-primary'
                                          : 'border-stone-200 bg-slate-50 hover:bg-slate-100'
                                      )}
                                    >
                                      <Icon className="h-5 w-5 mx-auto mb-1" />
                                      <span className="text-sm font-medium">{type.label}</span>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Description */}
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Description
                          </FormLabel>
                          <FormControl>
                            <div className="border border-stone-200 rounded-lg bg-slate-50 overflow-hidden focus-within:ring-2 focus-within:ring-primary focus-within:border-primary transition-all">
                              {/* Rich Text Toolbar */}
                              <div className="flex items-center gap-1 border-b border-stone-200 p-2 bg-white">
                                <button
                                  type="button"
                                  className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                  title="Bold"
                                >
                                  <span className="font-bold text-sm">B</span>
                                </button>
                                <button
                                  type="button"
                                  className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                  title="Italic"
                                >
                                  <span className="italic text-sm">I</span>
                                </button>
                                <button
                                  type="button"
                                  className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                  title="Underline"
                                >
                                  <span className="underline text-sm">U</span>
                                </button>
                                <div className="w-px h-4 bg-stone-300 mx-1" />
                                <button
                                  type="button"
                                  className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                  title="Bullet List"
                                >
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                  </svg>
                                </button>
                              </div>
                              <Textarea
                                placeholder="Describe the experience in detail. What can guests expect?"
                                className="w-full bg-transparent border-none p-4 min-h-[140px] outline-none text-sm leading-relaxed resize-none focus-visible:ring-0"
                                {...field}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </section>

                {/* Section 2: Details */}
                <section
                  ref={(el) => {
                    sectionRefs.current['details'] = el;
                  }}
                  id="details"
                  className="bg-white border border-stone-200 rounded-xl p-6 md:p-8 scroll-mt-24 shadow-sm"
                >
                  <SectionHeader icon={SlidersHorizontal} title="Details" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Duration */}
                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Duration
                          </FormLabel>
                          <FormControl>
                            <Select
                              onValueChange={(value) => field.onChange(parseInt(value))}
                              value={field.value?.toString()}
                            >
                              <SelectTrigger className="bg-slate-50 border-stone-200 h-12">
                                <SelectValue placeholder="Select duration" />
                              </SelectTrigger>
                              <SelectContent>
                                {DURATION_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value.toString()}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Price */}
                    <FormField
                      control={form.control}
                      name="price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Price per Person
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">
                                CHF
                              </span>
                              <Input
                                type="number"
                                placeholder="45.00"
                                className="bg-slate-50 border-stone-200 h-12 pl-12"
                                {...field}
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || undefined)}
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Max Capacity */}
                    <FormField
                      control={form.control}
                      name="maxCapacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            Max Capacity
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input
                                type="number"
                                placeholder="12"
                                className="bg-slate-50 border-stone-200 h-12 pr-10"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              />
                              <Users className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </section>

                {/* Section 3: Media */}
                <section
                  ref={(el) => {
                    sectionRefs.current['media'] = el;
                  }}
                  id="media"
                  className="bg-white border border-stone-200 rounded-xl p-6 md:p-8 scroll-mt-24 shadow-sm"
                >
                  <div className="flex justify-between items-center mb-6">
                    <SectionHeader icon={ImageIcon} title="Media" />
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      Max 5MB per file
                    </span>
                  </div>

                  {/* Upload Zone */}
                  <label className="border-2 border-dashed border-stone-300 rounded-xl p-10 flex flex-col items-center justify-center text-center bg-stone-50/50 hover:bg-stone-50 hover:border-primary/50 transition-colors cursor-pointer group">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={!canAddMoreImages || uploadingIndex !== null}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          await handleGalleryUpload(file, galleryImages.length);
                        }
                        e.target.value = '';
                      }}
                    />
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="text-primary h-10 w-10" />
                    </div>
                    <p className="text-slate-900 font-bold mb-1">Click to upload or drag and drop</p>
                    <p className="text-slate-500 text-sm">SVG, PNG, JPG or GIF (max. 800x400px)</p>
                  </label>

                  {/* Gallery Preview */}
                  {galleryImages.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                      {galleryImages.map((image, index) => (
                        <div
                          key={image.id}
                          className="relative aspect-[4/3] rounded-lg overflow-hidden group border border-stone-200"
                        >
                          <Image
                            src={image.url}
                            alt={`Gallery image ${index + 1}`}
                            fill
                            className="object-cover"
                            sizes="200px"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              type="button"
                              className="p-1.5 bg-white text-rose-600 rounded-full hover:bg-rose-50"
                              onClick={() => handleRemoveGalleryImage(image.id, image.url)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 bg-white text-slate-700 rounded-full hover:bg-slate-50"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                          {image.isCover && (
                            <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                              COVER
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Section 4: Availability */}
                <section
                  ref={(el) => {
                    sectionRefs.current['availability'] = el;
                  }}
                  id="availability"
                  className="bg-white border border-stone-200 rounded-xl p-6 md:p-8 scroll-mt-24 shadow-sm"
                >
                  <SectionHeader icon={CalendarClock} title="Availability" />
                  <div className="space-y-4">
                    {/* Availability Slots */}
                    {availabilitySlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="bg-slate-50 rounded-lg p-4 border border-stone-200"
                      >
                        {/* Day Selector */}
                        <div className="flex flex-wrap gap-2 mb-4">
                          {DAYS_OF_WEEK.map((day) => {
                            const isSelected = slot.days.includes(day.value);
                            return (
                              <button
                                key={day.value}
                                type="button"
                                className={cn(
                                  'px-3 py-1 text-xs font-bold rounded transition-colors',
                                  isSelected
                                    ? 'bg-primary text-white'
                                    : 'bg-white text-slate-400 border border-stone-200'
                                )}
                                onClick={() => {
                                  setAvailabilitySlots((prev) =>
                                    prev.map((s) =>
                                      s.id === slot.id
                                        ? {
                                            ...s,
                                            days: isSelected
                                              ? s.days.filter((d) => d !== day.value)
                                              : [...s.days, day.value],
                                          }
                                        : s
                                    )
                                  );
                                }}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Time Slots */}
                        <div className="flex items-center gap-4">
                          {slot.timeSlots.map((timeSlot, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 bg-white px-3 py-2 rounded border border-stone-200"
                            >
                              <Clock className="h-4 w-4 text-slate-400" />
                              <span className="text-sm font-medium">{timeSlot.start}</span>
                              <span className="text-slate-300">-</span>
                              <span className="text-sm font-medium">{timeSlot.end}</span>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="ml-auto text-primary text-sm font-bold hover:underline"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Add Schedule Button */}
                    <button
                      type="button"
                      className="w-full py-3 border-2 border-dashed border-stone-300 rounded-lg text-slate-500 font-bold text-sm flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition-colors"
                      onClick={() => {
                        setAvailabilitySlots((prev) => [
                          ...prev,
                          {
                            id: Date.now().toString(),
                            days: [],
                            timeSlots: [{ start: '10:00', end: '12:00' }],
                          },
                        ]);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Add Schedule Pattern
                    </button>
                  </div>
                </section>

                {/* Section 5: Location */}
                <section
                  ref={(el) => {
                    sectionRefs.current['location'] = el;
                  }}
                  id="location"
                  className="bg-white border border-stone-200 rounded-xl p-6 md:p-8 scroll-mt-24 shadow-sm"
                >
                  <SectionHeader icon={MapPin} title="Location" />
                  <div className="flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-4">
                      {/* Address Autocomplete */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                          Address
                        </label>
                        <AddressAutocomplete
                          value={location}
                          onChange={setLocation}
                          placeholder="Search for an address in Valais..."
                        />
                        <p className="text-xs text-slate-400 mt-1">
                          Start typing to search for an address
                        </p>
                      </div>

                      {/* Display selected address details */}
                      {location.street && (
                        <div className="bg-slate-50 rounded-lg p-4 border border-stone-200">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                            Selected Address
                          </h4>
                          <div className="space-y-1 text-sm text-slate-700">
                            {location.street && <p>{location.street}</p>}
                            <p>
                              {[location.zipCode, location.city].filter(Boolean).join(' ')}
                            </p>
                            {location.latitude && location.longitude && (
                              <p className="text-xs text-slate-400">
                                Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Map Preview */}
                    <div className="w-full md:w-1/3 aspect-video md:aspect-square bg-slate-200 rounded-lg overflow-hidden border border-stone-200 relative">
                      {location.latitude && location.longitude ? (
                        <iframe
                          title="Location preview"
                          src={`https://maps.google.com/maps?q=${location.latitude},${location.longitude}&z=15&output=embed`}
                          className="w-full h-full border-0"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-green-100 to-green-200 flex items-center justify-center">
                          <div className="text-center">
                            <div className="bg-primary text-white p-2 rounded-full shadow-lg mx-auto mb-2">
                              <MapPin className="h-5 w-5" />
                            </div>
                            <p className="text-xs text-slate-500">Select an address to preview</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </form>
            </Form>
          </div>

          {/* Right Column: Sticky Sidebar */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
            {/* Publish Status Card */}
            <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
                Publish Status
              </h3>
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-slate-900">Visible on marketplace</span>
                <Switch
                  checked={isPublishEnabled}
                  onCheckedChange={setIsPublishEnabled}
                />
              </div>
              <div className="p-3 bg-amber-50 border border-amber-100 rounded text-amber-800 text-xs leading-relaxed flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Your experience is currently in <strong>Draft</strong> mode. Publish to start
                  accepting bookings.
                </span>
              </div>
            </div>

            {/* Section Navigation */}
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-stone-100 bg-stone-50/50">
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
                        'flex items-center gap-3 px-4 py-3 text-sm font-medium border-l-2 transition-colors text-left',
                        isActive
                          ? 'text-slate-700 bg-stone-50 border-primary'
                          : 'text-slate-500 hover:bg-stone-50 hover:text-slate-900 border-transparent'
                      )}
                    >
                      <Icon className={cn('h-4 w-4', isActive && 'text-primary')} />
                      {section.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Help Widget */}
            <div className="rounded-xl p-5 bg-indigo-900 text-white relative overflow-hidden group cursor-pointer">
              <div className="absolute -right-4 -top-4 bg-white/10 size-24 rounded-full group-hover:scale-110 transition-transform" />
              <h3 className="font-bold relative z-10 mb-1">Need Help?</h3>
              <p className="text-indigo-200 text-sm relative z-10 mb-3">
                Check our guide on how to create the perfect wine experience listing.
              </p>
              <span className="text-xs font-bold underline relative z-10">Read Guide →</span>
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
              Your experience has been saved as a draft. Would you like to publish it now so
              visitors can see it?
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
            <Button onClick={handlePublishNow} disabled={isPublishing} className="w-full sm:w-auto">
              {isPublishing ? 'Publishing...' : 'Publish Now'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
