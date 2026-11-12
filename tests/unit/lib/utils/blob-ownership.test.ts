/**
 * Security regression (pre-launch audit, H2): a client-supplied Blob URL
 * must be parsed and matched against the caller's own folder before it is
 * stored or passed to del().
 */
import { describe, it, expect } from 'vitest';
import {
  experienceBlobPrefix,
  isOwnedBlobUrl,
  wineryBlobPrefix,
} from '@/lib/utils/blob-ownership';

const HOST = 'https://abc123.public.blob.vercel-storage.com';
const mine = wineryBlobPrefix('user-123');

describe('isOwnedBlobUrl', () => {
  it('accepts a blob inside the owner folder', () => {
    expect(isOwnedBlobUrl(`${HOST}/wineries/user-123/1-cover.jpg`, mine)).toBe(
      true
    );
    expect(
      isOwnedBlobUrl(
        `${HOST}/experiences/winery-9/1-photo.webp`,
        experienceBlobPrefix('winery-9')
      )
    ).toBe(true);
  });

  it("refuses another tenant's folder", () => {
    expect(isOwnedBlobUrl(`${HOST}/wineries/user-999/cover.jpg`, mine)).toBe(
      false
    );
    // prefix collision: user-1234 is not user-123
    expect(isOwnedBlobUrl(`${HOST}/wineries/user-1234/cover.jpg`, mine)).toBe(
      false
    );
    expect(isOwnedBlobUrl(`${HOST}/experiences/winery-9/x.jpg`, mine)).toBe(
      false
    );
  });

  it('refuses the substring tricks that defeated includes()', () => {
    const victim = `${HOST}/wineries/user-999/cover.jpg`;
    expect(isOwnedBlobUrl(`${victim}?wineries/user-123/`, mine)).toBe(false);
    expect(isOwnedBlobUrl(`${victim}#wineries/user-123/`, mine)).toBe(false);
    expect(
      isOwnedBlobUrl(`${HOST}/x/wineries/user-123/../../y.jpg`, mine)
    ).toBe(false);
  });

  it('refuses path traversal out of the owner folder (plain or encoded)', () => {
    expect(
      isOwnedBlobUrl(`${HOST}/wineries/user-123/../user-999/cover.jpg`, mine)
    ).toBe(false);
    expect(
      isOwnedBlobUrl(
        `${HOST}/wineries/user-123/%2e%2e/user-999/cover.jpg`,
        mine
      )
    ).toBe(false);
    expect(
      isOwnedBlobUrl(
        `${HOST}/wineries/user-123/..%2Fuser-999%2Fcover.jpg`,
        mine
      )
    ).toBe(false);
  });

  it('refuses query strings and fragments even on an owned path', () => {
    const owned = `${HOST}/wineries/user-123/cover.jpg`;
    expect(isOwnedBlobUrl(`${owned}?download=1`, mine)).toBe(false);
    expect(isOwnedBlobUrl(`${owned}#x`, mine)).toBe(false);
  });

  it('refuses foreign hosts, look-alike hosts and non-https schemes', () => {
    const path = '/wineries/user-123/cover.jpg';
    expect(isOwnedBlobUrl(`https://example.com${path}`, mine)).toBe(false);
    expect(
      isOwnedBlobUrl(
        `https://public.blob.vercel-storage.com.evil.test${path}`,
        mine
      )
    ).toBe(false);
    expect(
      isOwnedBlobUrl(
        `https://evil.test/${'abc.public.blob.vercel-storage.com'}${path}`,
        mine
      )
    ).toBe(false);
    expect(
      isOwnedBlobUrl(`http://abc.public.blob.vercel-storage.com${path}`, mine)
    ).toBe(false);
    expect(
      isOwnedBlobUrl(
        `https://user:pw@abc.public.blob.vercel-storage.com${path}`,
        mine
      )
    ).toBe(false);
  });

  it('refuses legacy non-blob values (seed covers, local paths) and junk', () => {
    expect(
      isOwnedBlobUrl('https://images.unsplash.com/photo-1?w=800', mine)
    ).toBe(false);
    expect(isOwnedBlobUrl('/images/hero.jpg', mine)).toBe(false);
    expect(isOwnedBlobUrl('', mine)).toBe(false);
    expect(isOwnedBlobUrl(null, mine)).toBe(false);
    expect(isOwnedBlobUrl(undefined, mine)).toBe(false);
    expect(isOwnedBlobUrl({ toString: () => HOST }, mine)).toBe(false);
    // the folder itself is not a blob
    expect(isOwnedBlobUrl(`${HOST}/wineries/user-123/`, mine)).toBe(false);
    // an empty prefix must never match everything
    expect(isOwnedBlobUrl(`${HOST}/wineries/user-123/a.jpg`, '')).toBe(false);
  });
});
