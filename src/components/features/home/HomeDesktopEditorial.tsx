import {
  ArrowRight,
  Check,
  Clock,
  Lock,
  MapPin,
  Search,
  Users,
  Wine,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ImageWithFallback } from '@/components/shared/ImageWithFallback';
import { formatCHF } from '@/lib/utils/currency';
import type { ExperienceCardData } from '@/components/features/experience/ExperienceCard';

const categories = [
  ['Degustations', 'Experiences oenologiques', '🍷'],
  ['Visites de cave', 'Dans les domaines', '🏛'],
  ['Vendanges', 'Saisonnier', '🍇'],
  ['Repas vignerons', 'Accords locaux', '🥖'],
  ['Balades', 'Dans les vignes', '🥾'],
  ['Ateliers', 'Savoir-faire', '🔬'],
];

function formatDuration(minutes: number) {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining ? `${hours}h ${remaining}` : `${hours}h`;
  }

  return `${minutes} min`;
}

function ExperienceVisual({
  experience,
  className = '',
  label,
  priority = false,
}: {
  experience?: ExperienceCardData;
  className?: string;
  label?: string;
  priority?: boolean;
}) {
  return (
    <div
      className={`relative h-full overflow-hidden bg-cream-200 ${className}`}
    >
      {experience?.coverPhoto ? (
        <ImageWithFallback
          src={experience.coverPhoto}
          alt={experience.title}
          fill
          priority={priority}
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-burgundy-900 via-burgundy-600 to-gold-400" />
      )}
      <div className="absolute inset-0 bg-gradient-to-br from-burgundy-900/45 via-burgundy-600/20 to-gold-400/20" />
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgba(255,255,255,.52) 1px, transparent 0)',
          backgroundSize: '18px 18px',
        }}
      />
      {label && (
        <span className="absolute bottom-2 right-2 rounded bg-black/25 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-white/80">
          {label}
        </span>
      )}
    </div>
  );
}

function SearchField({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <div
      className={`flex-1 px-[18px] py-3 ${last ? '' : 'border-r border-stone-200'}`}
    >
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-burgundy-700">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-ink-900">{value}</div>
    </div>
  );
}

export function HomeDesktopEditorial({
  experiences,
}: {
  experiences: ExperienceCardData[];
}) {
  const featured = experiences[0];
  const cards = experiences.slice(0, 4);
  const mapExperiences = experiences.slice(0, 6);

  return (
    <div className="bg-cream-50 text-ink-900">
      <section className="grid min-h-[600px] grid-cols-[1.15fr_1fr] border-b border-stone-200">
        <div className="flex flex-col justify-between px-14 py-[72px]">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-burgundy-700">
              • Experiences disponibles en Valais
            </div>
            <h1 className="mt-[18px] max-w-[560px] font-display text-[80px] font-light leading-[0.98] tracking-[-0.025em] text-ink-900">
              Le Valais,
              <br />
              une <em className="font-normal italic text-burgundy-700">cave</em>
              <br />a ciel ouvert.
            </h1>
            <p className="mt-[22px] max-w-[480px] text-[17px] leading-[1.55] text-ink-700">
              Degustations privees, visites de cave et ateliers proposes par les
              domaines valaisans disponibles sur EnCave.
            </p>
          </div>

          <div className="flex max-w-[620px] items-center rounded-[18px] bg-white p-1.5 shadow-[0_18px_50px_-12px_rgba(58,14,31,.25),0_0_0_1px_rgba(154,42,72,.08)]">
            <SearchField label="Ou" value="Tout le Valais" />
            <SearchField label="Quand" value="Voir les dates" />
            <SearchField label="Combien" value="2 personnes" last />
            <Link
              href="/experiences"
              className="ml-1.5 inline-flex h-[62px] items-center gap-2 rounded-[14px] bg-burgundy-600 px-7 text-sm font-semibold text-white transition-colors hover:bg-burgundy-700"
            >
              <Search className="h-[15px] w-[15px]" aria-hidden="true" />
              Explorer
            </Link>
          </div>
        </div>

        <div className="relative">
          <ExperienceVisual
            experience={featured}
            priority
            label={
              featured
                ? `${featured.winery.name} · ${featured.winery.commune}`
                : undefined
            }
          />
          {featured && (
            <div className="absolute bottom-8 left-8 right-8 rounded-[14px] bg-ink-900/80 p-[18px] text-white shadow-audit-elevated backdrop-blur-xl">
              <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold-400">
                • En vedette · {formatDuration(featured.duration)}
              </div>
              <div className="mt-1.5 font-display text-[22px] font-semibold">
                {featured.title}
              </div>
              <div className="mt-1 flex justify-between text-[13px] text-white/80">
                <span>
                  {featured.winery.name} · {featured.winery.commune}
                </span>
                <span className="font-mono text-gold-400">
                  {formatCHF(featured.price)}
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="px-14 pb-4 pt-10">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-burgundy-700">
              • Experiences disponibles
            </div>
            <h2 className="mt-2 font-display text-[34px] font-medium tracking-[-0.01em]">
              Reservez maintenant, partez selon vos disponibilites.
            </h2>
          </div>
          <Link
            href="/experiences"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-burgundy-700"
          >
            Voir la carte interactive
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-[18px]">
          {cards.map((experience, index) => (
            <Link
              href={`/experiences/${experience.slug}`}
              key={experience.id}
              className="group overflow-hidden rounded-[14px] border border-stone-200 bg-white transition-all hover:-translate-y-0.5 hover:border-burgundy-200 hover:shadow-audit-card"
            >
              <div className="relative h-[200px]">
                <ExperienceVisual
                  experience={experience}
                  priority={index === 0}
                />
                <span className="absolute left-3 top-3 rounded bg-white/95 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-burgundy-700">
                  {formatDuration(experience.duration)}
                </span>
              </div>
              <div className="p-4">
                <h3 className="font-display text-[17px] font-semibold leading-[1.2]">
                  {experience.title}
                </h3>
                <p className="mt-1 text-xs text-ink-500">
                  {experience.winery.name} · {experience.winery.commune}
                </p>
                <div className="mt-3 flex items-baseline justify-between border-t border-dashed border-stone-200 pt-2.5">
                  <span className="font-mono text-[11px] text-ink-500">
                    {formatCHF(experience.price)}
                  </span>
                  <span className="text-xs font-bold text-burgundy-700">
                    Reserver →
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-[1.2fr_1fr] gap-8 px-14 py-12">
        <div className="relative h-[340px] overflow-hidden rounded-[18px] bg-gradient-to-br from-[#d8dfc6] to-[#a7b08b]">
          <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(120deg,transparent_35%,rgba(122,138,58,.28)_35%,rgba(122,138,58,.28)_55%,transparent_55%)]" />
          {mapExperiences.map((experience, index) => {
            const positions = [
              ['18%', '42%'],
              ['34%', '58%'],
              ['48%', '34%'],
              ['62%', '52%'],
              ['74%', '40%'],
              ['86%', '60%'],
            ];
            const [left, top] = positions[index] ?? ['50%', '50%'];

            return (
              <div
                key={experience.id}
                className="absolute rounded-full border-2 border-burgundy-700 bg-white px-2.5 py-1 font-mono text-[11px] font-bold shadow-md"
                style={{ left, top, transform: 'translate(-50%, -50%)' }}
              >
                {formatCHF(experience.price).replace('CHF ', '')}
              </div>
            );
          })}
          <div className="absolute left-[18px] top-[18px] rounded-lg bg-white/95 px-3.5 py-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-burgundy-700">
              • Valais
            </div>
            <div className="mt-0.5 font-display text-lg font-semibold">
              {mapExperiences.length} experiences
            </div>
          </div>
          <Link
            href="/experiences"
            className="absolute bottom-[18px] right-[18px] inline-flex h-10 items-center gap-1.5 rounded-full bg-ink-900 px-[18px] text-[13px] font-semibold text-white"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            Explorer la carte
          </Link>
        </div>

        <div>
          <h2 className="mb-3.5 font-display text-2xl font-semibold">
            Par envie
          </h2>
          <div className="grid grid-cols-2 gap-2.5">
            {categories.map(([title, description, icon]) => (
              <Link
                href="/experiences"
                key={title}
                className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3.5 transition-colors hover:bg-cream-100"
              >
                <span className="text-[22px] grayscale-[.3]">{icon}</span>
                <span>
                  <span className="block font-display text-[15px] font-semibold">
                    {title}
                  </span>
                  <span className="block font-mono text-[11px] text-ink-500">
                    {description}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-14 mt-8 flex items-center justify-between border-t border-stone-200 py-6 text-[13px] text-ink-500">
        <span className="inline-flex items-center gap-2">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          Annulation selon politique du domaine
        </span>
        <span className="inline-flex items-center gap-2">
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          Paiement securise Stripe
        </span>
        <span className="inline-flex items-center gap-2">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          Durees et horaires affiches par experience
        </span>
        <span className="inline-flex items-center gap-2">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          Capacites indiquees par les domaines
        </span>
        <span className="inline-flex items-center gap-2">
          <Wine className="h-3.5 w-3.5" aria-hidden="true" />
          Experiences viticoles en Valais
        </span>
      </section>
    </div>
  );
}
