import Image from 'next/image';

export function ComingSoonFooter() {
  return (
    <footer className="bg-[#1a1215] text-cream-100">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-8 sm:grid-cols-2">
          {/* Brand */}
          <div>
            <Image
              src="/icons/encave-logo.png"
              alt="EnCave"
              width={160}
              height={46}
              className="h-11 w-auto brightness-0 invert"
            />
            <p className="mt-4 max-w-xs text-sm text-stone-400">
              Réservez des expériences viticoles uniques directement auprès des
              encaveurs valaisans.
            </p>
          </div>

          {/* Découvrir */}
          <div>
            <h3 className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-gold-400">
              Découvrir
            </h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="/fr/degustation-vin-valais"
                  className="transition-colors duration-200 hover:text-white"
                >
                  Dégustation en Valais
                </a>
              </li>
              <li>
                <a
                  href="/fr/cepages-valaisans"
                  className="transition-colors duration-200 hover:text-white"
                >
                  Cépages Valaisans
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row">
          <p className="text-sm text-stone-400">
            © {new Date().getFullYear()} EnCave. Tous droits réservés.
          </p>
          <a
            href="mailto:samuel@encave.ch"
            className="flex items-center gap-2 text-sm text-stone-400 transition-colors duration-200 hover:text-white"
          >
            samuel@encave.ch
          </a>
        </div>
      </div>
    </footer>
  );
}
