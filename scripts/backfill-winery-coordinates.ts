/**
 * Backfill script to geocode existing winery addresses
 * Run with: npx tsx scripts/backfill-winery-coordinates.ts
 *
 * Uses Nominatim API with 1 second delay between requests to respect rate limits.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface GeocodingResult {
  latitude: number;
  longitude: number;
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
}

async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const searchQuery = address.includes('Switzerland')
      ? address
      : `${address}, Switzerland`;

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
        new URLSearchParams({
          q: searchQuery,
          format: 'json',
          limit: '1',
          addressdetails: '1',
        }),
      {
        headers: {
          'User-Agent': 'EnCave/1.0 (https://encave.ch)',
        },
      }
    );

    if (!response.ok) {
      console.error(`Geocoding API error: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as NominatimResponse[];

    if (data.length === 0 || !data[0]) {
      return null;
    }

    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('Starting winery coordinates backfill...\n');

  // Get all wineries without coordinates
  const wineries = await prisma.winery.findMany({
    where: {
      OR: [{ latitude: null }, { longitude: null }],
    },
    select: {
      id: true,
      name: true,
      address: true,
      commune: true,
      latitude: true,
      longitude: true,
    },
  });

  console.log(`Found ${wineries.length} wineries without coordinates.\n`);

  let successCount = 0;
  let failCount = 0;

  for (const winery of wineries) {
    console.log(`Processing: ${winery.name}`);
    console.log(`  Address: ${winery.address}, ${winery.commune}`);

    const fullAddress = `${winery.address}, ${winery.commune}, Valais, Switzerland`;
    const coordinates = await geocodeAddress(fullAddress);

    if (coordinates) {
      await prisma.winery.update({
        where: { id: winery.id },
        data: {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
        },
      });

      console.log(`  ✓ Success: ${coordinates.latitude}, ${coordinates.longitude}`);
      successCount++;
    } else {
      // Try with just commune as fallback
      const fallbackAddress = `${winery.commune}, Valais, Switzerland`;
      const fallbackCoordinates = await geocodeAddress(fallbackAddress);

      if (fallbackCoordinates) {
        await prisma.winery.update({
          where: { id: winery.id },
          data: {
            latitude: fallbackCoordinates.latitude,
            longitude: fallbackCoordinates.longitude,
          },
        });

        console.log(
          `  ⚠ Fallback (commune center): ${fallbackCoordinates.latitude}, ${fallbackCoordinates.longitude}`
        );
        successCount++;
      } else {
        console.log(`  ✗ Failed: Could not geocode address`);
        failCount++;
      }
    }

    // Rate limiting: wait 1 second between requests (Nominatim requirement)
    await sleep(1000);
    console.log('');
  }

  console.log('\n=== Backfill Complete ===');
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`Total: ${wineries.length}`);
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
