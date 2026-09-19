/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// expect.objectContaining/any matchers are typed `any` by jest.
import { NotFoundException } from '@nestjs/common';
import { EnquiriesService } from './enquiries.service';

function makePrisma() {
  return {
    enquiry: {
      create: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn().mockResolvedValue([0, []]),
  };
}

const base = {
  name: '  Asha  ',
  email: ' Asha@Example.COM ',
  message: 'Please get in touch about this.',
};

describe('EnquiriesService.create', () => {
  it('trims and lowercases, and keeps only gardening fields for a gardening enquiry', async () => {
    const prisma = makePrisma();
    const service = new EnquiriesService(prisma as never);

    await service.create({
      ...base,
      type: 'GARDENING_SERVICE',
      city: 'Bengaluru',
      serviceType: 'Balcony garden setup',
      company: 'ignored for this type',
    });

    expect(prisma.enquiry.create).toHaveBeenCalledWith({
      data: {
        type: 'GARDENING_SERVICE',
        name: 'Asha',
        email: 'asha@example.com',
        phone: null,
        subject: null,
        message: 'Please get in touch about this.',
        details: { city: 'Bengaluru', serviceType: 'Balcony garden setup' },
      },
    });
  });

  it('keeps the corporate-gifting fields, including the quantity', async () => {
    const prisma = makePrisma();
    const service = new EnquiriesService(prisma as never);

    await service.create({
      ...base,
      type: 'CORPORATE_GIFTING',
      company: 'Acme Pvt Ltd',
      quantity: 120,
      occasion: 'Diwali',
      neededBy: '2026-11-01',
    });

    expect(prisma.enquiry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'CORPORATE_GIFTING',
        details: {
          company: 'Acme Pvt Ltd',
          quantity: 120,
          occasion: 'Diwali',
          neededBy: '2026-11-01',
        },
      }),
    });
  });

  it('stores no details for a general (contact-form) enquiry', async () => {
    const prisma = makePrisma();
    const service = new EnquiriesService(prisma as never);

    await service.create({
      ...base,
      type: 'GENERAL',
      city: 'x',
    });

    expect(prisma.enquiry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ details: undefined }),
    });
  });
});

describe('EnquiriesService admin', () => {
  it('lists by status (newest first) with paging', async () => {
    const prisma = makePrisma();
    const service = new EnquiriesService(prisma as never);

    await service.adminList({ status: 'NEW', page: 2, pageSize: 20 });

    expect(prisma.enquiry.findMany).toHaveBeenCalledWith({
      where: { status: 'NEW' },
      orderBy: { createdAt: 'desc' },
      skip: 20,
      take: 20,
    });
  });

  it('marks a NEW enquiry handled', async () => {
    const prisma = makePrisma();
    const service = new EnquiriesService(prisma as never);

    await expect(service.markHandled('e1')).resolves.toEqual({ ok: true });
    expect(prisma.enquiry.updateMany).toHaveBeenCalledWith({
      where: { id: 'e1', status: 'NEW' },
      data: { status: 'HANDLED', handledAt: expect.any(Date) },
    });
  });

  it('404s for an enquiry that does not exist, but is idempotent for one already handled', async () => {
    const prisma = makePrisma();
    const service = new EnquiriesService(prisma as never);
    prisma.enquiry.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.markHandled('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.enquiry.findUnique.mockResolvedValue({
      id: 'e2',
      status: 'HANDLED',
    });
    await expect(service.markHandled('e2')).resolves.toEqual({ ok: true });
  });
});
