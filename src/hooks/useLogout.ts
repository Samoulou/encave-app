'use client';

import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth-client';

export function useLogout() {
  const router = useRouter();

  async function logout() {
    await signOut();
    router.push('/');
    router.refresh();
  }

  return logout;
}
