import { useTranslations } from 'next-intl';
import { MapPin, Phone, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { DynamicMap } from '@/components/features/map/DynamicMap';
import type { MapWinery } from '@/components/features/map/types';

interface WineryInfoCardProps {
  winery: MapWinery;
  address: string;
  commune: string;
  phone: string;
  email: string;
}

export function WineryInfoCard({
  winery,
  address,
  commune,
  phone,
  email,
}: WineryInfoCardProps) {
  const t = useTranslations('confirmation');
  const hasCoordinates = winery.latitude != null && winery.longitude != null;
  const googleMapsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${winery.latitude},${winery.longitude}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${address}, ${commune}, Switzerland`)}`;

  return (
    <Card className="hover:translate-y-0 hover:shadow-card">
      <CardContent className="p-6">
        <h3 className="mb-4 text-lg font-bold text-foreground">
          {t('wineryInformation')}
        </h3>

        {hasCoordinates && (
          <div className="mb-4 h-48 overflow-hidden rounded-lg border border-border">
            <DynamicMap
              wineries={[winery]}
              singleWinery
              className="h-full w-full rounded-none"
            />
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t('address')}
              </p>
              <p className="text-sm text-muted-foreground">
                {address}
                <br />
                {commune}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Phone className="size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t('phone')}
              </p>
              <a
                href={`tel:${phone}`}
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                {phone}
              </a>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Mail className="size-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t('email')}
              </p>
              <a
                href={`mailto:${email}`}
                className="break-all text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                {email}
              </a>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-6">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center text-sm font-semibold text-primary transition-colors hover:text-[hsl(var(--primary-hover))]"
          >
            {t('getDirections')}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
