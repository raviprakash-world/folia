import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AddressesService } from './addresses.service';
import { AddressInputDto } from './dto/address-input.dto';
import { toPublicAddress } from './address.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../users/user.types';

@ApiTags('addresses')
@ApiBearerAuth()
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  async findAll(@CurrentUser() user: AuthenticatedUser) {
    const addresses = await this.addressesService.findAllForUser(user.id);
    return addresses.map(toPublicAddress);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddressInputDto,
  ) {
    const created = await this.addressesService.create(user.id, dto);
    return toPublicAddress(created);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddressInputDto,
  ) {
    const updated = await this.addressesService.update(user.id, id, dto);
    return toPublicAddress(updated);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.addressesService.remove(user.id, id);
    return { ok: true };
  }
}
