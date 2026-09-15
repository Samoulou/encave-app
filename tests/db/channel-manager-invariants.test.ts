/** Channel-manager constraints that only exist in the additive SQL migration. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const url = process.env.INVARIANTS_DATABASE_URL;

describe.skipIf(!url)('channel manager database invariants', () => {
  const db = new PrismaClient({ datasourceUrl: url });
  const suffix = `${Date.now()}-${Math.random()}`;
  let userIds: string[] = [];
  let wineryIds: string[] = [];
  let experienceIds: string[] = [];
  let connectionIds: string[] = [];

  beforeAll(async () => {
    for (const n of [1, 2]) {
      const user = await db.user.create({
        data: {
          email: `channel-${n}-${suffix}@test.encave.ch`,
          role: 'WINEMAKER',
        },
      });
      const winery = await db.winery.create({
        data: {
          name: `Channel winery ${n} ${suffix}`,
          slug: `channel-winery-${n}-${suffix}`,
          description: 'DB test fixture',
          address: 'Test 1',
          commune: 'Sion',
          phone: '+41270000000',
          email: `winery-${n}-${suffix}@test.encave.ch`,
          userId: user.id,
        },
      });
      const experience = await db.experience.create({
        data: {
          wineryId: winery.id,
          title: `Channel experience ${n}`,
          slug: `channel-experience-${n}-${suffix}`,
          description: 'Database test fixture',
          type: 'TASTING',
          duration: 60,
          price: 2000,
          minCapacity: 1,
          maxCapacity: 10,
          coverPhoto: 'https://example.com/image.jpg',
        },
      });
      const connection = await db.channelConnection.create({
        data: {
          wineryId: winery.id,
          channel: 'VIATOR',
          name: `Viator ${n}`,
          externalAccountId: `account-${n}-${suffix}`,
        },
      });
      userIds.push(user.id);
      wineryIds.push(winery.id);
      experienceIds.push(experience.id);
      connectionIds.push(connection.id);
    }
  });

  afterAll(async () => {
    await db.booking.deleteMany({ where: { wineryId: { in: wineryIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });

  const bookingData = (reference: string) => ({
    reference,
    visitorEmail: 'visitor@test.ch',
    visitorName: 'Visitor',
    visitorPhone: '+41790000000',
    experienceId: experienceIds[0],
    wineryId: wineryIds[0],
    date: new Date('2027-01-10'),
    timeSlot: '10:00',
    guestCount: 2,
    totalPrice: 4000,
    platformFee: 400,
    wineryPayout: 3600,
  });

  it('keeps existing EnCave bookings compatible through additive defaults', async () => {
    const booking = await db.booking.create({
      data: bookingData(`ENC-CHANNEL-${suffix}`),
    });
    expect(booking).toMatchObject({
      sourceChannel: 'ENCAVE',
      merchantOfRecord: 'ENCAVE',
      channelConnectionId: null,
    });
  });

  it('enforces external booking uniqueness inside a connection, but not across connections', async () => {
    const external = {
      sourceChannel: 'VIATOR' as const,
      externalBookingId: `booking-${suffix}`,
    };
    await db.booking.create({
      data: {
        ...bookingData(`EXT-A-${suffix}`),
        ...external,
        channelConnectionId: connectionIds[0],
      },
    });
    await expect(
      db.booking.create({
        data: {
          ...bookingData(`EXT-B-${suffix}`),
          ...external,
          channelConnectionId: connectionIds[0],
        },
      })
    ).rejects.toThrow(/Unique constraint/);
    await db.booking.create({
      data: {
        ...bookingData(`EXT-C-${suffix}`),
        ...external,
        channelConnectionId: connectionIds[1],
        wineryId: wineryIds[1],
        experienceId: experienceIds[1],
      },
    });
  });

  it('enforces product/option uniqueness, including a null option', async () => {
    const data = {
      channelConnectionId: connectionIds[0],
      experienceId: experienceIds[0],
      externalProductId: `product-${suffix}`,
    };
    await db.channelListing.create({ data });
    await expect(
      db.channelListing.create({
        data: { ...data, experienceId: experienceIds[1] },
      })
    ).rejects.toThrow(/Unique constraint/);
  });

  it('rejects negative quantities and incoherent external amounts', async () => {
    await expect(
      db.channelListing.create({
        data: {
          channelConnectionId: connectionIds[0],
          experienceId: experienceIds[0],
          externalProductId: `negative-${suffix}`,
          capacityMode: 'ALLOCATED',
          capacityQuota: -1,
        },
      })
    ).rejects.toThrow(/channel_listings_capacity_quota_non_negative/);
    await expect(
      db.booking.create({
        data: {
          ...bookingData(`EXT-MONEY-${suffix}`),
          sourceChannel: 'VIATOR',
          channelConnectionId: connectionIds[0],
          externalBookingId: `money-${suffix}`,
          externalGrossAmount: 1000,
          externalCommissionAmount: 200,
          externalNetAmount: 700,
          externalCurrency: 'CHF',
        },
      })
    ).rejects.toThrow(/bookings_external_amounts_coherent/);
  });

  it('prevents cross-winery mappings and cascades connection-owned records', async () => {
    await expect(
      db.channelListing.create({
        data: {
          channelConnectionId: connectionIds[0],
          experienceId: experienceIds[1],
          externalProductId: `foreign-${suffix}`,
        },
      })
    ).rejects.toThrow(/one winery/);
    const event = await db.channelInboxEvent.create({
      data: {
        channelConnectionId: connectionIds[1],
        externalEventId: `event-${suffix}`,
        eventType: 'booking.created',
        payload: {},
      },
    });
    await db.channelConnection.delete({ where: { id: connectionIds[1] } });
    expect(
      await db.channelInboxEvent.findUnique({ where: { id: event.id } })
    ).toBeNull();
  });
});
