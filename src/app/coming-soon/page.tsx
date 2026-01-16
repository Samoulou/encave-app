import { Wine } from 'lucide-react';

export default function ComingSoonPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-cream-50 via-cream-100 to-burgundy-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-burgundy-600 to-burgundy-700 shadow-warm">
            <Wine className="h-7 w-7 text-white" />
          </div>
          <span className="font-display text-3xl font-semibold text-burgundy-700">
            EnCave
          </span>
        </div>

        {/* Main content */}
        <div className="space-y-4">
          <h1 className="font-display text-display-md text-slate-900">
            Bientôt disponible
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            Nous préparons quelque chose de spécial pour vous faire découvrir
            les trésors viticoles du Valais.
          </p>
        </div>

        {/* Decorative element */}
        <div className="flex items-center justify-center gap-2 text-burgundy-400">
          <span className="h-px w-12 bg-burgundy-300" />
          <Wine className="h-5 w-5" />
          <span className="h-px w-12 bg-burgundy-300" />
        </div>

        {/* Footer text */}
        <p className="text-sm text-slate-500">
          Expériences viticoles authentiques au cœur du Valais
        </p>
      </div>
    </main>
  );
}
