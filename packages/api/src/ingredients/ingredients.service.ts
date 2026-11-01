import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { StockSyncService } from '../inventory/stock-sync.service';

@Injectable()
export class IngredientsService {
  private readonly logger = new Logger(IngredientsService.name);

  constructor(
    private prisma: PrismaService,
    private stockSync: StockSyncService,
  ) {}

  async create(createIngredientDto: CreateIngredientDto & { tenantId: string }) {
    try {
      this.logger.debug(`Creating ingredient with data: ${JSON.stringify(createIngredientDto)}`);

      const unit = createIngredientDto.unit || 'unidad';
      const quantity = typeof createIngredientDto.quantity === 'number' ? createIngredientDto.quantity : 0;
      const minQuantity = typeof createIngredientDto.minQuantity === 'number' ? createIngredientDto.minQuantity : 0;

      const ingredient = await this.prisma.$transaction(async (tx) => {
        const created = await tx.ingredient.create({
          data: {
            name: createIngredientDto.name,
            description: createIngredientDto.description,
            quantity,
            unit,
            minQuantity,
            location: { connect: { id: createIngredientDto.locationId } },
            tenant: { connect: { id: createIngredientDto.tenantId } },
          },
          include: {
            location: true,
          },
        });

        await this.stockSync.syncFromIngredient(tx, created);

        return created;
      });

      this.logger.debug(`Created ingredient with ID: ${ingredient.id}`);

      return ingredient;
    } catch (error) {
      this.logger.error(`Error creating ingredient: ${error.message}`);
      this.logger.error(error.stack);
      throw new InternalServerErrorException(`Error creating ingredient: ${error.message}`);
    }
  }

  async findAll(params?: { where?: any }) {
    try {
      return this.prisma.ingredient.findMany({
        where: params?.where,
        include: {
          location: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error finding all ingredients: ${error.message}`);
      throw new InternalServerErrorException(`Error finding all ingredients: ${error.message}`);
    }
  }

  async findOne(id: string) {
    try {
      return this.prisma.ingredient.findUnique({
        where: { id },
        include: {
          location: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error finding ingredient ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error finding ingredient: ${error.message}`);
    }
  }

  async update(id: string, updateIngredientDto: UpdateIngredientDto) {
    try {
      this.logger.debug(`Updating ingredient ${id} with data: ${JSON.stringify(updateIngredientDto)}`);

      return this.prisma.$transaction(async (tx) => {
        const ingredient = await tx.ingredient.update({
          where: { id },
          data: updateIngredientDto,
          include: {
            location: true,
          },
        });

        if (
          updateIngredientDto.quantity !== undefined ||
          updateIngredientDto.minQuantity !== undefined
        ) {
          await this.stockSync.syncFromIngredient(tx, ingredient);
        }

        return ingredient;
      });
    } catch (error) {
      this.logger.error(`Error updating ingredient ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error updating ingredient: ${error.message}`);
    }
  }

  async remove(id: string) {
    try {
      const ingredient = await this.findOne(id);

      if (!ingredient) {
        throw new Error(`Ingredient with id ${id} not found`);
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.inventoryItem.deleteMany({
          where: { ingredientId: id },
        });

        await tx.ingredient.delete({
          where: { id },
        });
      });

      return ingredient;
    } catch (error) {
      this.logger.error(`Error removing ingredient ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error removing ingredient: ${error.message}`);
    }
  }
}
