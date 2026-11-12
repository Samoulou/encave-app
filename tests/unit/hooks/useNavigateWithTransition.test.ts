import { describe, expect, it } from 'vitest';
import { splitLocalePrefix } from '@/hooks/useNavigateWithTransition';

describe('splitLocalePrefix', () => {
  it('leaves an unprefixed app path alone (the router adds the locale)', () => {
    expect(splitLocalePrefix('/login')).toEqual({ href: '/login' });
    expect(splitLocalePrefix('/')).toEqual({ href: '/' });
    expect(splitLocalePrefix('/experiences?search=fendant')).toEqual({
      href: '/experiences?search=fendant',
    });
  });

  it('strips an existing locale prefix instead of doubling it', () => {
    expect(splitLocalePrefix('/fr/wineries/cave-a')).toEqual({
      href: '/wineries/cave-a',
      locale: 'fr',
    });
    expect(splitLocalePrefix('/de')).toEqual({ href: '/', locale: 'de' });
    expect(splitLocalePrefix('/en?x=1')).toEqual({
      href: '/?x=1',
      locale: 'en',
    });
  });

  it('does not mistake a path that merely starts with locale letters', () => {
    expect(splitLocalePrefix('/french-wines')).toEqual({
      href: '/french-wines',
    });
    expect(splitLocalePrefix('/dashboard/demandes')).toEqual({
      href: '/dashboard/demandes',
    });
    expect(splitLocalePrefix('/experiences')).toEqual({
      href: '/experiences',
    });
  });
});
