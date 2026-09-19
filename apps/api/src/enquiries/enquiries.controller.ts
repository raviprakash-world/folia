import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { EnquiriesService } from './enquiries.service';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { AdminEnquiriesQueryDto } from './dto/admin-enquiries-query.dto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('enquiries')
@Controller()
export class EnquiriesController {
  constructor(private readonly enquiriesService: EnquiriesService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('enquiries')
  create(@Body() dto: CreateEnquiryDto) {
    return this.enquiriesService.create(dto);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Get('admin/enquiries')
  list(@Query() query: AdminEnquiriesQueryDto) {
    return this.enquiriesService.adminList(query);
  }

  @ApiBearerAuth()
  @Roles('admin')
  @Post('admin/enquiries/:id/handled')
  handled(@Param('id') id: string) {
    return this.enquiriesService.markHandled(id);
  }
}
