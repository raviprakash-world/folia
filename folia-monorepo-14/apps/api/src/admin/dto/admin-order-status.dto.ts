import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ADMIN_SETTABLE_STATUSES } from '../../orders/order-status.util';

export class AdminOrderStatusDto {
  @ApiProperty({ enum: ADMIN_SETTABLE_STATUSES })
  @IsIn(ADMIN_SETTABLE_STATUSES)
  status!: (typeof ADMIN_SETTABLE_STATUSES)[number];
}
