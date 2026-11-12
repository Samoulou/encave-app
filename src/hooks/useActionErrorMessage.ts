'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

/**
 * Minimal shape of a failed `ActionResult` error. `message` is the server's
 * English diagnostic — meant for logs, never for the UI.
 */
interface ActionErrorLike {
  code?: string | null;
}

/**
 * Translate a server-action error for display.
 *
 * Server actions return `{ code, message }` where `message` is a hardcoded
 * English string. Rendering it leaked English into the FR/DE UI; the stable
 * part is the `code`, which maps to `errors.codes.*` (a namespace served on
 * every route — `errors` is part of the public base subset).
 *
 * `overrides` lets a call site give a code a more specific, already
 * translated message (e.g. NO_CAPACITY in the booking widget).
 *
 * @example
 * const actionError = useActionErrorMessage();
 * if (!result.success) toast.error(actionError(result.error));
 */
export function useActionErrorMessage() {
  const t = useTranslations('errors.codes');

  return useCallback(
    (
      error: ActionErrorLike | null | undefined,
      overrides?: Partial<Record<string, string>>
    ): string => {
      const code = error?.code ?? undefined;
      if (code !== undefined) {
        const override = overrides?.[code];
        if (override !== undefined) return override;
        if (t.has(code)) return t(code);
      }
      return t('INTERNAL_ERROR');
    },
    [t]
  );
}
