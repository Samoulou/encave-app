'use client';

import { useState, useTransition } from 'react';
import { XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cancelEventSession } from '@/server/actions/event-detail';

interface CancelSessionButtonProps {
  experienceId: string;
  sessionId: string;
}

export function CancelSessionButton({
  experienceId,
  sessionId,
}: CancelSessionButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onCancel = () => {
    const reason = window.prompt(
      'Pourquoi annulez-vous cette session ? Ce motif sera transmis aux clients.'
    );
    if (!reason) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelEventSession({
        experienceId,
        sessionId,
        reason,
      });
      if (!result.success) {
        setError(result.error.message);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isPending}
        onClick={onCancel}
        className="border-red-200 text-red-700 hover:bg-red-50"
      >
        <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
        Annuler la session
      </Button>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
    </div>
  );
}
