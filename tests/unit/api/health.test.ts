import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('/api/health', () => {
  it('returns status ok with 200', async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
  });

  it('returns a valid ISO timestamp', async () => {
    const response = await GET();
    const data = await response.json();

    expect(data.timestamp).toBeDefined();
    expect(() => new Date(data.timestamp)).not.toThrow();
    expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
  });
});
