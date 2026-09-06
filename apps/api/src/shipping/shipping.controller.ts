import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import { EstimateShippingDto } from './dto/estimate-shipping.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('shipping')
@Public()
@Controller('shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('estimate')
  estimate(@Body() dto: EstimateShippingDto) {
    return this.shippingService.estimate(dto.pincode, dto.subtotal);
  }
}
