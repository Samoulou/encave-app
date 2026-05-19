'use client';

import { Button } from '@/components/ui/button';

export default function ScanError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-xl font-semibold">Impossible de charger le scan</h2>
      <Button onClick={reset}>Reessayer</Button>
    </div>
  );
}
