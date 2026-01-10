import Link from 'next/link';
import { Sparkles, Building2, ArrowRight } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { HealthStatus } from '@/components/shared/HealthStatus';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="min-h-screen bg-cream-50">
      <Header />
      <main id="main-content" className="flex flex-col items-center px-6 py-16 lg:px-8 lg:py-24">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="font-display text-display-lg text-burgundy-800 mb-4">
            Discover Valais Wine Experiences
          </h1>
          <p className="text-lg text-slate-600 mb-8">
            Book unique wine tasting experiences directly with Swiss winemakers.
            Explore cellars, taste exceptional wines, and create unforgettable memories.
          </p>
        </div>

        {/* Discovery Section */}
        <section className="w-full max-w-4xl mx-auto mb-16" aria-labelledby="discover-heading">
          <h2 id="discover-heading" className="sr-only">Discover</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Experiences CTA */}
            <Card className="group overflow-hidden rounded-xl shadow-warm hover:-translate-y-1 hover:shadow-warm-lg transition-all duration-300">
              <CardContent className="p-0">
                <Link href="/experiences" className="block p-8">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-burgundy-100 text-burgundy-600 group-hover:bg-burgundy-600 group-hover:text-white transition-colors">
                      <Sparkles className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3 className="font-display text-xl font-semibold text-slate-900">
                      Wine Experiences
                    </h3>
                  </div>
                  <p className="text-slate-600 mb-6">
                    Explore tastings, cellar visits, workshops, and vineyard tours
                    across the beautiful Valais region.
                  </p>
                  <span className="inline-flex items-center gap-2 text-burgundy-600 font-medium group-hover:gap-3 transition-all">
                    Browse experiences
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
              </CardContent>
            </Card>

            {/* Wineries CTA */}
            <Card className="group overflow-hidden rounded-xl shadow-warm hover:-translate-y-1 hover:shadow-warm-lg transition-all duration-300">
              <CardContent className="p-0">
                <Link href="/wineries" className="block p-8">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-burgundy-100 text-burgundy-600 group-hover:bg-burgundy-600 group-hover:text-white transition-colors">
                      <Building2 className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h3 className="font-display text-xl font-semibold text-slate-900">
                      Our Wineries
                    </h3>
                  </div>
                  <p className="text-slate-600 mb-6">
                    Discover passionate winemakers and their unique stories,
                    traditions, and exceptional wines.
                  </p>
                  <span className="inline-flex items-center gap-2 text-burgundy-600 font-medium group-hover:gap-3 transition-all">
                    Meet our winemakers
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-display text-display-md text-slate-900 mb-4">
            Ready to explore?
          </h2>
          <p className="text-slate-600 mb-8">
            Start your journey through the world of Swiss wines today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/experiences">
                View All Experiences
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/register/winemaker">
                Become a Partner
              </Link>
            </Button>
          </div>
        </section>

        {/* Health Status (for development) */}
        <div className="mt-8">
          <HealthStatus />
        </div>
      </main>
    </div>
  );
}
