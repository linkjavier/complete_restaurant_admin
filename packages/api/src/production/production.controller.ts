import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Query,
  ForbiddenException,
} from '@nestjs/common';
import { ProductionService } from './production.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProduceProductDto } from './dto/produce-product.dto';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { User, UserRole } from '@prisma/client';

@ApiTags('production')
@Controller('production')
@UseGuards(JwtAuthGuard)
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

@Get()
findHistory(
  @CurrentTenant() tenantId: string,
  @CurrentUser() user: User,
  @Query('locationId') requestedLocationId?: string,
) {
  if (user.role !== UserRole.SUPER_ADMIN && !user.locationId) {
    throw new ForbiddenException('Your user does not have an assigned location');
  }

  return this.productionService.findProductionHistory(
    tenantId,
    user.role === UserRole.SUPER_ADMIN
      ? requestedLocationId
      : user.locationId ?? undefined,
  );
}

  @Post('produce')
  @ApiOperation({ summary: 'Produce a processed product' })
  @ApiResponse({
    status: 200,
    description: 'Product successfully produced',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request or insufficient ingredients',
  })
  async produceProduct(
    @Body() { productId, quantity, wasteQuantity, wasteNotes }: ProduceProductDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    if (user.role !== UserRole.SUPER_ADMIN && !user.locationId) {
      throw new ForbiddenException('Your user does not have an assigned location');
    }

    return this.productionService.produceProduct(
      productId,
      quantity,
      tenantId,
      user.id,
      user.role === UserRole.SUPER_ADMIN ? undefined : user.locationId ?? undefined,
      wasteQuantity ?? 0,
      wasteNotes,
    );
  }
}
