import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { QRCodeCard } from './QRCodeCard';

interface ExperienceVisualProps {
  coverPhoto: string;
  experienceTitle: string;
  bookingId: string;
}

export function ExperienceVisual({
  coverPhoto,
  experienceTitle,
  bookingId,
}: ExperienceVisualProps) {
  const t = useTranslations('confirmation');

  return (
    <div className="flex flex-col gap-4">
      <div className="w-full aspect-video rounded-lg overflow-hidden relative group">
        <Image
          src={coverPhoto}
          alt={experienceTitle}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded text-xs font-semibold text-foreground">
          {t('valaisSwitzerland')}
        </div>
      </div>
      <QRCodeCard bookingId={bookingId} />
    </div>
  );
}
