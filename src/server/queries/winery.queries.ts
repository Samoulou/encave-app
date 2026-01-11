import { db } from '@/server/db';

export async function getVerifiedWineries(commune?: string) {
  return db.winery.findMany({
    where: {
      status: 'VERIFIED',
      ...(commune && { commune }),
    },
    orderBy: { name: 'asc' },
  });
}

export async function getWineryBySlug(slug: string) {
  return db.winery.findUnique({
    where: { slug, status: 'VERIFIED' },
    include: {
      galleryImages: {
        orderBy: { order: 'asc' },
      },
    },
  });
}

export async function getDistinctCommunes() {
  const wineries = await db.winery.findMany({
    where: { status: 'VERIFIED' },
    select: { commune: true },
    distinct: ['commune'],
    orderBy: { commune: 'asc' },
  });
  return wineries.map((w) => w.commune);
}

export async function getWineryByUserId(userId: string) {
  return db.winery.findUnique({
    where: { userId },
    select: { name: true },
  });
}

export async function getAllVerifiedWinerySlugs(): Promise<string[]> {
  const wineries = await db.winery.findMany({
    where: { status: 'VERIFIED' },
    select: { slug: true },
  });
  return wineries.map((w) => w.slug);
}
