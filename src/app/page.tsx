import { HealthStatus } from '@/components/shared/HealthStatus';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-8">
      <div className="text-center">
        <h1 className="mb-4 text-5xl font-bold text-burgundy-700">EnCave</h1>
        <p className="mb-8 text-xl text-slate-600">Coming Soon</p>
        <p className="mb-12 max-w-md text-slate-500">
          Book unique wine tasting experiences directly with Swiss winemakers
        </p>
        <HealthStatus />
      </div>
    </main>
  );
}
