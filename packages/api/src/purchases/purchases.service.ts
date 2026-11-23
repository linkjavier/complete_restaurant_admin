import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { StockSyncService } from '../inventory/stock-sync.service'
import { CreatePurchaseDto } from './dto/create-purchase.dto'
import { Prisma, Purchase } from '@prisma/client'

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockSync: StockSyncService,
  ) {}

  async create(
    createPurchaseDto: CreatePurchaseDto,
    tenantId: string,
    createdById: string,
  ): Promise<Purchase> {
    if (!tenantId) {
      throw new BadRequestException('tenantId es requerido')
    }

    if (!createPurchaseDto.items || createPurchaseDto.items.length === 0) {
      throw new BadRequestException('La compra debe incluir al menos un ítem')
    }

    const purchaseDate = new Date(createPurchaseDto.purchaseDate)
    if (Number.isNaN(purchaseDate.getTime())) {
      throw new BadRequestException('purchaseDate inválida')
    }

    return this.prisma.$transaction(async (tx) => {
      const location = await tx.location.findFirst({
        where: { id: createPurchaseDto.locationId, tenantId },
      })

      if (!location) {
        throw new BadRequestException('Ubicación inválida')
      }

      const purchase = await tx.purchase.create({
        data: {
          tenant: { connect: { id: tenantId } },
          location: { connect: { id: location.id } },
          supplierName: createPurchaseDto.supplierName,
          purchaseDate,
          totalCost: createPurchaseDto.totalCost ?? undefined,
          createdBy: { connect: { id: createdById } },
        },
      })

      for (const item of createPurchaseDto.items) {
        const ingredient = await tx.ingredient.findUnique({
          where: { id: item.ingredientId },
        })

        if (!ingredient || ingredient.tenantId !== tenantId) {
          throw new BadRequestException(`Ingrediente inválido: ${item.ingredientId}`)
        }

        if (ingredient.locationId !== createPurchaseDto.locationId) {
          throw new BadRequestException(
            `El ingrediente ${ingredient.name} no pertenece a la ubicación seleccionada`,
          )
        }

        const updatedIngredient = await tx.ingredient.update({
          where: { id: item.ingredientId },
          data: {
            quantity: { increment: item.quantity },
          },
        })

        await tx.inventoryItem.upsert({
          where: {
            ingredientId_locationId: {
              ingredientId: item.ingredientId,
              locationId: createPurchaseDto.locationId,
            },
          },
          create: {
            ingredientId: item.ingredientId,
            locationId: createPurchaseDto.locationId,
            quantity: updatedIngredient.quantity,
            minQuantity: ingredient.minQuantity,
          },
          update: {
            quantity: { increment: item.quantity },
          },
        })

        await tx.purchaseItem.create({
          data: {
            purchase: { connect: { id: purchase.id } },
            ingredient: { connect: { id: item.ingredientId } },
            quantity: item.quantity,
            unitCost: item.unitCost,
          },
        })
      }

      const result = await tx.purchase.findUnique({
        where: { id: purchase.id },
        include: {
          items: { include: { ingredient: true } },
          location: true,
          createdBy: true,
        },
      })

      if (!result) {
        throw new BadRequestException('Error al crear la compra')
      }

      return result
    })
  }

  async findAll(
    tenantId: string,
    filters: {
      fromDate?: string
      toDate?: string
      ingredientId?: string
      locationId?: string
    },
  ): Promise<Purchase[]> {
    const where: Prisma.PurchaseWhereInput = { tenantId }

    if (filters.locationId) {
      where.locationId = filters.locationId
    }

    if (filters.ingredientId) {
      where.items = {
        some: {
          ingredientId: filters.ingredientId,
        },
      }
    }

    if (filters.fromDate || filters.toDate) {
      const dateFilter: Prisma.DateTimeFilter = {}

      if (filters.fromDate) {
        const fromDate = new Date(filters.fromDate)
        if (Number.isNaN(fromDate.getTime())) {
          throw new BadRequestException('fromDate inválida')
        }
        dateFilter.gte = fromDate
      }

      if (filters.toDate) {
        const toDate = new Date(filters.toDate)
        if (Number.isNaN(toDate.getTime())) {
          throw new BadRequestException('toDate inválida')
        }
        dateFilter.lte = toDate
      }

      where.purchaseDate = dateFilter
    }

    try {
      return await this.prisma.purchase.findMany({
        where,
        orderBy: { purchaseDate: 'desc' },
        include: {
          items: { include: { ingredient: true } },
          location: true,
          createdBy: true,
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new BadRequestException('Error al recuperar las compras. Por favor, intenta de nuevo.')
      }
      throw error
    }
  }
}
