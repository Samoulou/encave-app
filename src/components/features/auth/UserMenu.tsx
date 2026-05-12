'use client';

import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Calendar,
  Grape,
  Settings,
  LogOut,
  Shield,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getInitials } from '@/lib/get-initials';
import { useLogout } from '@/hooks/useLogout';

interface UserMenuProps {
  userName: string | null;
  userRole?: string | null;
  userEmail?: string | null;
}

type TranslateFn = ReturnType<typeof useTranslations<'nav'>>;

type MenuItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

function getRoleMenuItems(
  role: string | null | undefined,
  t: TranslateFn
): MenuItem[] {
  switch (role) {
    case 'WINEMAKER':
      return [
        {
          href: '/dashboard',
          label: t('viewDashboard'),
          icon: <LayoutDashboard className="h-4 w-4" />,
        },
        {
          href: '/dashboard/bookings',
          label: t('bookings'),
          icon: <Calendar className="h-4 w-4" />,
        },
        {
          href: '/dashboard/winery-profile',
          label: t('wineryProfile'),
          icon: <Grape className="h-4 w-4" />,
        },
        {
          href: '/dashboard/settings',
          label: t('settings'),
          icon: <Settings className="h-4 w-4" />,
        },
      ];
    case 'ADMIN':
      return [
        {
          href: '/admin',
          label: t('adminPanel'),
          icon: <Shield className="h-4 w-4" />,
        },
        {
          href: '/dashboard',
          label: t('viewDashboard'),
          icon: <LayoutDashboard className="h-4 w-4" />,
        },
      ];
    case 'CLIENT':
      return [
        {
          href: '/dashboard/my-bookings',
          label: t('myBookings'),
          icon: <Calendar className="h-4 w-4" />,
        },
      ];
    default:
      return [];
  }
}

function getRoleBadgeVariant(
  role: string | null | undefined
): 'gold' | 'default' | 'secondary' {
  switch (role) {
    case 'WINEMAKER':
      return 'gold';
    case 'ADMIN':
      return 'default';
    default:
      return 'secondary';
  }
}

function getRoleLabel(role: string | null | undefined, t: TranslateFn): string {
  switch (role) {
    case 'WINEMAKER':
      return t('roleWinemaker');
    case 'ADMIN':
      return t('roleAdmin');
    case 'CLIENT':
      return t('roleClient');
    default:
      return '';
  }
}

export function UserMenu({ userName, userRole, userEmail }: UserMenuProps) {
  const t = useTranslations('nav');
  const logout = useLogout();
  const displayName = userName ?? t('user');
  const initials = getInitials(displayName);
  const menuItems = getRoleMenuItems(userRole, t);
  const badgeVariant = getRoleBadgeVariant(userRole);
  const roleLabel = getRoleLabel(userRole, t);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          aria-label={t('account')}
        >
          <span className="text-sm font-semibold">{initials}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold leading-none">
                {displayName}
              </p>
              {roleLabel && (
                <Badge
                  variant={badgeVariant}
                  className="px-1.5 py-0 text-[10px]"
                >
                  {roleLabel}
                </Badge>
              )}
            </div>
            {userEmail && (
              <p className="truncate text-xs leading-none text-muted-foreground">
                {userEmail}
              </p>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {menuItems.map((item) => (
          <DropdownMenuItem key={item.href} asChild className="cursor-pointer">
            <Link href={item.href} className="flex items-center gap-2">
              {item.icon}
              <span>{item.label}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        {menuItems.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuItem
          onClick={logout}
          className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          <span>{t('signOut')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
