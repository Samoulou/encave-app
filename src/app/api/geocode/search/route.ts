import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, GEOCODE_RATE_LIMIT } from '@/server/services/rate-limit.service';
import { logError } from '@/lib/logger';

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/search';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Simple in-memory cache
const cache = new Map<string, { data: unknown; timestamp: number }>();

// Rate limiting: track last request timestamp
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 100; // 100ms between requests (10 req/sec max)

export async function GET(request: NextRequest) {
  // Per-IP rate limiting
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rateLimitResult = await checkRateLimit(`geocode:${ip}`, GEOCODE_RATE_LIMIT);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || query.length < 3) {
    return NextResponse.json(
      { error: 'Query must be at least 3 characters' },
      { status: 400 }
    );
  }

  // Check cache
  const cacheKey = query.toLowerCase().trim();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  // Rate limiting
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }
  lastRequestTime = Date.now();

  try {
    // Use query as-is, rely on countrycodes=ch for Swiss results
    // Adding ", Valais, Switzerland" suffix was too restrictive for street searches
    const url = new URL(NOMINATIM_BASE_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '8');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('countrycodes', 'ch');

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'EnCave/1.0 (https://encave.ch; contact@encave.ch)',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      logError(`Nominatim error: ${response.status} ${response.statusText}`, undefined, { action: 'geocodeSearch' });
      return NextResponse.json(
        { error: 'Geocoding service unavailable' },
        { status: 502 }
      );
    }

    const data = await response.json();

    // Cache the result
    cache.set(cacheKey, { data, timestamp: Date.now() });

    // Clean old cache entries periodically
    if (cache.size > 100) {
      const cutoff = Date.now() - CACHE_TTL;
      const keysToDelete: string[] = [];
      cache.forEach((value, key) => {
        if (value.timestamp < cutoff) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach((key) => cache.delete(key));
    }

    return NextResponse.json(data);
  } catch (error) {
    logError('Geocode search error', error, { action: 'geocodeSearch' });
    return NextResponse.json(
      { error: 'Failed to search addresses' },
      { status: 500 }
    );
  }
}
