import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ProductionService } from './production.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { ProduceProductDto } from './dto/produce-product.dto';

@ApiTags('production')
@Controller('production')
@UseGuards(JwtAuthGuard)
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

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
    @Req() req: Request,
  ) {
    const tenantId = (req as any).tenantId;
    return this.productionService.produceProduct(
      productId,
      quantity,
      tenantId,
      wasteQuantity ?? 0,
      wasteNotes,
    );
  }
}
