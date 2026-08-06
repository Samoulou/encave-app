import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  MapPin,
  Phone,
  Mail,
  Calendar,
  User,
  Building2,
  ImageIcon,
  CheckCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatDateTime } from '@/lib/i18n/formatters';
import type { Locale } from '@/i18n/routing';

interface WineryInfoPanelProps {
  winery: {
    name: string;
    description: string;
    address: string;
    commune: string;
    phone: string;
    email: string;
    coverPhoto: string | null;
    createdAt: Date;
    verifiedAt: Date | null;
    user: {
      name: string | null;
      email: string;
    };
    galleryImages: { id: string; url: string }[];
  };
  locale: string;
}

export function WineryInfoPanel({ winery, locale }: WineryInfoPanelProps) {
  const t = useTranslations('admin');

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Winery Information */}
        <Card className="shadow-warm">
          <CardHeader className="border-b border-stone-100">
            <CardTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-burgundy-100">
                <Building2 className="h-4 w-4 text-burgundy-600" />
              </div>
              <span className="font-display">{t('wineryInformation')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('description')}
              </p>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                {winery.description}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg bg-stone-50 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {t('address')}
                </p>
                <p className="mt-2 font-medium text-foreground">
                  {winery.address}
                </p>
                <p className="text-muted-foreground">
                  {winery.commune}, Valais
                </p>
              </div>
              <div className="rounded-lg bg-stone-50 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" />
                  {t('phone')}
                </p>
                <a
                  href={`tel:${winery.phone}`}
                  className="mt-2 block font-medium text-burgundy-700 hover:underline"
                >
                  {winery.phone}
                </a>
              </div>
            </div>
            <div className="rounded-lg bg-stone-50 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Mail className="h-3.5 w-3.5" />
                {t('wineryEmail')}
              </p>
              <a
                href={`mailto:${winery.email}`}
                className="mt-2 block font-medium text-burgundy-700 hover:underline"
              >
                {winery.email}
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Applicant Information */}
        <Card className="shadow-warm">
          <CardHeader className="border-b border-stone-100">
            <CardTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-100">
                <User className="h-4 w-4 text-stone-600" />
              </div>
              <span className="font-display">{t('applicantInformation')}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="rounded-lg bg-stone-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('name')}
              </p>
              <p className="mt-2 font-medium text-foreground">
                {winery.user.name || t('notProvided')}
              </p>
            </div>
            <div className="rounded-lg bg-stone-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t('accountEmail')}
              </p>
              <p className="mt-2 font-medium text-foreground">
                {winery.user.email}
              </p>
            </div>
            <div className="rounded-lg bg-stone-50 p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {t('registrationDate')}
              </p>
              <p className="mt-2 font-medium text-foreground">
                {formatDateTime(new Date(winery.createdAt), locale as Locale)}
              </p>
            </div>
            {winery.verifiedAt && (
              <div className="rounded-lg bg-green-50 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-green-700">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {t('verifiedAt')}
                </p>
                <p className="mt-2 font-medium text-green-900">
                  {formatDateTime(
                    new Date(winery.verifiedAt),
                    locale as Locale
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Photos Section */}
      {(winery.coverPhoto || winery.galleryImages.length > 0) && (
        <Card className="shadow-warm">
          <CardHeader className="border-b border-stone-100">
            <CardTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold-100">
                <ImageIcon className="h-4 w-4 text-gold-700" />
              </div>
              <span className="font-display">{t('photos')}</span>
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                {t('imageCount', {
                  count:
                    (winery.coverPhoto ? 1 : 0) + winery.galleryImages.length,
                })}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {winery.coverPhoto && (
                <div className="group relative aspect-video overflow-hidden rounded-xl border border-stone-200">
                  <Image
                    src={winery.coverPhoto}
                    alt={t('cover')}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <span className="absolute left-3 top-3 z-10 rounded-full bg-burgundy-600 px-3 py-1 text-xs font-semibold text-white shadow-md">
                    {t('cover')}
                  </span>
                </div>
              )}
              {winery.galleryImages.map((image, index) => (
                <div
                  key={image.id}
                  className="group relative aspect-video overflow-hidden rounded-xl border border-stone-200"
                >
                  <Image
                    src={image.url}
                    alt={`${t('photos')} ${index + 1}`}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
