import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { CreateExperienceForm } from '@/components/features/experience/CreateExperienceForm';

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
