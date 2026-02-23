'use client';

import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';

/**
 * Navigation progress bar provider for visual feedback during route transitions.
 * Uses burgundy color from the EnCave design system.
 */
export function ProgressBarProvider() {
  return (
    <ProgressBar
      height="3px"
      color="#962a48"
      options={{
        showSpinner: false,
        easing: 'ease',
        speed: 300,
        minimum: 0.08,
        trickle: true,
        trickleSpeed: 200,
      }}
      shallowRouting
    />
  );
}
