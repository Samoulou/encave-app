import dynamic from 'next/dynamic';
import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { Skeleton } from '@/components/shared/Skeleton';

// Dynamic import for heavy form component (990 lines)
const CreateExperienceForm = dynamic(
  () => import('@/components/features/experience/CreateExperienceForm').then(mod => mod.CreateExperienceForm),
  {
    loading: () => (
      <div className="space-y-6 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    ),
  }
);

export default async function NewExperiencePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <WineryAccessGuard>
      <CreateExperienceForm />
    </WineryAccessGuard>
  );
}
