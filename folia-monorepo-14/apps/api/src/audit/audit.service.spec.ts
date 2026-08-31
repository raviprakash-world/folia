import { AuditService } from './audit.service';

function createDeps() {
  const prisma = {
    auditLog: {
      create: jest.fn<
        Promise<unknown>,
        [{ data: { metadata?: Record<string, unknown> } }]
      >(),
      findMany: jest.fn(),
    },
  };
  const service = new AuditService(prisma as never);
  return { prisma, service };
}

describe('AuditService.log', () => {
  it('writes the log entry with all provided fields', async () => {
    const { prisma, service } = createDeps();
    prisma.auditLog.create.mockResolvedValue({});

    await service.log({
      actorId: 'admin-1',
      action: 'PRODUCT_UPDATE',
      resource: 'product',
      resourceId: 'prod-1',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'admin-1',
        action: 'PRODUCT_UPDATE',
        resource: 'product',
        resourceId: 'prod-1',
        metadata: undefined,
        ipAddress: undefined,
      },
    });
  });

  it('never throws, even when the underlying write fails — audit logging must not break the real action being audited', async () => {
    const { prisma, service } = createDeps();
    prisma.auditLog.create.mockRejectedValue(new Error('db unavailable'));

    await expect(
      service.log({ actorId: 'admin-1', action: 'x', resource: 'y' }),
    ).resolves.toBeUndefined();
  });

  it('redacts a password field in metadata before writing, real defense-in-depth', async () => {
    const { prisma, service } = createDeps();
    prisma.auditLog.create.mockResolvedValue({});

    await service.log({
      actorId: 'admin-1',
      action: 'USER_UPDATE',
      resource: 'user',
      metadata: { password: 'supersecret123', email: 'sam@example.com' },
    });

    const callArg = prisma.auditLog.create.mock.calls[0][0];
    expect(callArg.data.metadata!.password).toBe('[redacted]');
    expect(callArg.data.metadata!.email).toBe('sam@example.com'); // non-sensitive fields pass through untouched
  });

  it('redacts tokens and card-related fields too, matching by substring not exact key name', async () => {
    const { prisma, service } = createDeps();
    prisma.auditLog.create.mockResolvedValue({});

    await service.log({
      actorId: 'admin-1',
      action: 'x',
      resource: 'y',
      metadata: {
        accessToken: 'abc',
        refreshToken: 'def',
        cardNumber: '4111111111111111',
        cvv: '123',
      },
    });

    const callArg = prisma.auditLog.create.mock.calls[0][0];
    expect(callArg.data.metadata!.accessToken).toBe('[redacted]');
    expect(callArg.data.metadata!.refreshToken).toBe('[redacted]');
    expect(callArg.data.metadata!.cardNumber).toBe('[redacted]');
    expect(callArg.data.metadata!.cvv).toBe('[redacted]');
  });

  it('does not choke on missing metadata', async () => {
    const { prisma, service } = createDeps();
    prisma.auditLog.create.mockResolvedValue({});
    await service.log({ actorId: 'admin-1', action: 'x', resource: 'y' });
    const callArg = prisma.auditLog.create.mock.calls[0][0];
    expect(callArg.data.metadata).toBeUndefined();
  });
});

describe('AuditService.findForResource', () => {
  it('orders results most-recent first', async () => {
    const { prisma, service } = createDeps();
    prisma.auditLog.findMany.mockResolvedValue([]);
    await service.findForResource('product', 'prod-1');
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { resource: 'product', resourceId: 'prod-1' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });
});
