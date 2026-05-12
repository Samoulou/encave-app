import { useTranslations } from 'next-intl';
import { MapPin, Phone, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface WineryInfoCardProps {
  address: string;
  commune: string;
  phone: string;
  email: string;
}

export function WineryInfoCard({
  address,
  commune,
  phone,
  email,
}: WineryInfoCardProps) {
  const t = useTranslations('confirmation');
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${address}, ${commune}, Switzerland`)}`;

  return (
    <Card className="hover:translate-y-0 hover:shadow-card">
      <CardContent className="p-6">
        <h3 className="mb-4 text-lg font-bold text-foreground">
          {t('wineryInformation')}
        </h3>

        {/* Map Placeholder */}
        <div className="relative mb-4 aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
          <div
            className="absolute inset-0 bg-cover bg-center grayscale-[20%]"
            style={{
              backgroundImage: `url('https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(`${address}, ${commune}, Switzerland`)}&zoom=14&size=400x300&maptype=roadmap&key=placeholder')`,
              backgroundColor: '#e5e7eb',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
            <div className="flex size-8 -translate-y-2 transform items-center justify-center rounded-full bg-primary text-white shadow-lg">
              <MapPin className="size-4" />
            </div>
          </div>
        </div>

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
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
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
