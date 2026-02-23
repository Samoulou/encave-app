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
        <h3 className="text-lg font-bold text-foreground mb-4">
          {t('wineryInformation')}
        </h3>

        {/* Map Placeholder */}
        <div className="w-full aspect-[4/3] rounded-lg bg-muted overflow-hidden mb-4 relative">
          <div
            className="absolute inset-0 bg-cover bg-center grayscale-[20%]"
            style={{
              backgroundImage: `url('https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(`${address}, ${commune}, Switzerland`)}&zoom=14&size=400x300&maptype=roadmap&key=placeholder')`,
              backgroundColor: '#e5e7eb',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
            <div className="size-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg transform -translate-y-2">
              <MapPin className="size-4" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex gap-3 items-start">
            <MapPin className="size-5 text-primary mt-0.5 shrink-0" />
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

          <div className="flex gap-3 items-center">
            <Phone className="size-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t('phone')}
              </p>
              <a
                href={`tel:${phone}`}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {phone}
              </a>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <Mail className="size-5 text-primary shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t('email')}
              </p>
              <a
                href={`mailto:${email}`}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {email}
              </a>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full text-center text-sm font-semibold text-primary hover:text-[hsl(var(--primary-hover))] transition-colors block"
          >
            {t('getDirections')}
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
