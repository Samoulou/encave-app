import { Header } from '@/components/layout/Header';
import { HealthStatus } from '@/components/shared/HealthStatus';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <main id="main-content" className="flex flex-col items-center justify-center px-8 py-24">
        <div className="text-center">
          <h1 className="mb-4 text-5xl font-bold text-burgundy-700">EnCave</h1>
          <p className="mb-8 text-xl text-slate-600">Coming Soon</p>
          <p className="mb-12 max-w-md text-slate-500">
            Book unique wine tasting experiences directly with Swiss winemakers
          </p>
          <HealthStatus />
        </div>
      </main>
    </div>
  );
}
