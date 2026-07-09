import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { QRCodeCard } from './QRCodeCard';

interface ExperienceVisualProps {
  coverPhoto: string;
  experienceTitle: string;
  ticketUrl?: string;
}

export function ExperienceVisual({
  coverPhoto,
  experienceTitle,
  ticketUrl,
}: ExperienceVisualProps) {
  const t = useTranslations('confirmation');

  return (
    <div className="flex flex-col gap-4">
      <div className="group relative aspect-video w-full overflow-hidden rounded-lg">
        <Image
          src={coverPhoto}
          alt={experienceTitle}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/10" />
        <div className="absolute bottom-3 left-3 rounded bg-white/90 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur-sm">
          {t('valaisSwitzerland')}
        </div>
      </div>
      <QRCodeCard ticketUrl={ticketUrl} />
    </div>
  );
}
