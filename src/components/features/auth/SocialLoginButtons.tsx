'use client';

import { useTranslations } from 'next-intl';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.78 1.18-.19 2.31-.89 3.51-.84 1.54.06 2.7.79 3.44 1.92-3.04 1.8-2.53 6.64.49 7.84-.25.75-.58 1.5-.95 2.22-.36.73-.78 1.37-1.57 2.05zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

interface SocialLoginButtonsProps {
  showApple?: boolean;
}

export function SocialLoginButtons({ showApple = true }: SocialLoginButtonsProps) {
  const t = useTranslations('auth.login');

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: '/' });
  };

  const handleAppleSignIn = () => {
    signIn('apple', { callbackUrl: '/' });
  };

  return (
    <>
      {/* Divider */}
      <div className="relative flex py-2 items-center">
        <div className="flex-grow border-t border-[#e5d2d7]" />
        <span className="flex-shrink-0 mx-4 text-sm text-slate-400">
          {t('orContinueWith')}
        </span>
        <div className="flex-grow border-t border-[#e5d2d7]" />
      </div>

      {/* Social Login Buttons */}
      <div className={cn('grid gap-3', showApple ? 'grid-cols-2' : 'grid-cols-1')}>
        <Button
          type="button"
          variant="outline"
          className="flex items-center justify-center gap-2 h-11 px-4 border border-[#e5d2d7] rounded-lg hover:bg-slate-50 transition-colors bg-white"
          onClick={handleGoogleSignIn}
        >
          <GoogleIcon className="w-5 h-5" />
          <span className="text-sm font-medium text-slate-900">Google</span>
        </Button>

        {showApple && (
          <Button
            type="button"
            variant="outline"
            className="flex items-center justify-center gap-2 h-11 px-4 border border-[#e5d2d7] rounded-lg hover:bg-slate-50 transition-colors bg-white"
            onClick={handleAppleSignIn}
          >
            <AppleIcon className="w-5 h-5 text-black" />
            <span className="text-sm font-medium text-slate-900">Apple</span>
          </Button>
        )}
      </div>
    </>
  );
}
