import { Controller, Post, Body } from '@nestjs/common';
import { ProductionService } from './production.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

class ProduceProductDto {
  productId: string;
  quantity: number;
}

@ApiTags('production')
@Controller('production')
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
  async produceProduct(@Body() { productId, quantity }: ProduceProductDto) {
    return this.productionService.produceProduct(productId, quantity);
  }
}