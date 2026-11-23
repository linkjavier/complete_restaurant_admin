import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { InventoryModule } from '../inventory/inventory.module'
import { PurchasesController } from './purchases.controller'
import { PurchasesService } from './purchases.service'

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [PurchasesController],
  providers: [PurchasesService],
})
export class PurchasesModule {}
