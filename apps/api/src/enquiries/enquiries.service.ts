import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateEnquiryDto } from './dto/create-enquiry.dto';
import type { AdminEnquiriesQueryDto } from './dto/admin-enquiries-query.dto';

/** Only the fields that belong to each enquiry type are kept in `details`. */
function buildDetails(
  dto: CreateEnquiryDto,
): Record<string, string | number> | undefined {
  const pick = (
    fields: (keyof CreateEnquiryDto)[],
  ): Record<string, string | number> | undefined => {
    const entries = fields.flatMap((key) => {
      const value = dto[key];
      return value === undefined || value === '' ? [] : [[key, value] as const];
    });
    return entries.length ? Object.fromEntries(entries) : undefined;
  };
  if (dto.type === 'GARDENING_SERVICE') return pick(['city', 'serviceType']);
  if (dto.type === 'CORPORATE_GIFTING')
    return pick(['company', 'quantity', 'occasion', 'neededBy', 'city']);
  return undefined;
}

@Injectable()
export class EnquiriesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEnquiryDto) {
    await this.prisma.enquiry.create({
      data: {
        type: dto.type,
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        phone: dto.phone?.trim() || null,
        subject: dto.subject?.trim() || null,
        message: dto.message.trim(),
        details: buildDetails(dto),
      },
    });
    return { ok: true };
  }

  async adminList(query: AdminEnquiriesQueryDto) {
    const where = {
      status: query.status,
      ...(query.type ? { type: query.type } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.enquiry.count({ where }),
      this.prisma.enquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return { items, total };
  }

  async markHandled(id: string) {
    const result = await this.prisma.enquiry.updateMany({
      where: { id, status: 'NEW' },
      data: { status: 'HANDLED', handledAt: new Date() },
    });
    if (result.count === 0) {
      const existing = await this.prisma.enquiry.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Enquiry not found.');
    }
    return { ok: true };
  }
}
