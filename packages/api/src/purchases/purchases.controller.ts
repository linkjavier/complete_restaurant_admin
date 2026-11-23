import { Controller, Get, Post, Body, Query, UseGuards, Req, BadRequestException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { Request } from 'express'
import { PurchasesService } from './purchases.service'
import { CreatePurchaseDto } from './dto/create-purchase.dto'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentTenant } from '../auth/decorators/tenant.decorator'

@ApiTags('purchases')
@Controller('purchases')
@UseGuards(JwtAuthGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  create(
    @Body() createPurchaseDto: CreatePurchaseDto,
    @CurrentTenant() tenantId: string,
    @Req() req: Request,
  ) {
    const createdById = (req.user as any)?.id
    if (!createdById) {
      throw new BadRequestException('Usuario no autenticado')
    }

    return this.purchasesService.create(createPurchaseDto, tenantId, createdById)
  }

  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('ingredientId') ingredientId?: string,
    @Query('locationId') locationId?: string,
  ) {
    return this.purchasesService.findAll(tenantId, {
      fromDate,
      toDate,
      ingredientId,
      locationId,
    })
  }
}
