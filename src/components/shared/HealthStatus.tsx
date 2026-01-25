'use client';

import { useEffect, useState } from 'react';

interface HealthResponse {
  status: string;
  timestamp: string;
}

export function HealthStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = (await res.json()) as HealthResponse;
          setHealth(data);
          setError(false);
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-red-700">
        <span className="h-2 w-2 rounded-full bg-red-600" />
        <span>Service unavailable</span>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
        <span>Checking status...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-green-700">
      <span className="h-2 w-2 rounded-full bg-green-600" />
      <span>All systems operational</span>
    </div>
  );
}
