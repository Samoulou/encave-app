import { auth } from '@/server/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { WineryAccessGuard } from '@/components/features/winery/WineryAccessGuard';
import { ExperienceForm } from '@/components/features/experience/ExperienceForm';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default async function NewExperiencePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return (
    <WineryAccessGuard>
      <div className="container max-w-4xl py-12">
        {/* Page Header */}
        <div className="mb-10">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2 text-slate-600 hover:text-slate-900"
          >
            <Link href="/dashboard/experiences" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Experiences
            </Link>
          </Button>

          <div className="space-y-3">
            <h1 className="font-display text-display-md text-slate-900">
              Create Experience
            </h1>
            <p className="text-slate-600">
              Create a new wine experience for visitors to book. Your experience
              will be saved as a draft until you publish it.
            </p>
          </div>
        </div>

        <ExperienceForm />
      </div>
    </WineryAccessGuard>
  );
}
