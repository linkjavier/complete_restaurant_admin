import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';

// Definir una interfaz para el ingrediente con todos los campos necesarios
interface IngredientWithRelations {
  id: string;
  name: string;
  description?: string | null;
  quantity: number;
  unit: string;
  minQuantity: number;
  locationId: string;
  createdAt: Date;
  updatedAt: Date;
  location?: any;
}

@Injectable()
export class IngredientsService {
  private readonly logger = new Logger(IngredientsService.name);
  
  constructor(private prisma: PrismaService) {}

  async create(createIngredientDto: CreateIngredientDto & { tenantId: string }) {
    try {
      // Depurar los valores recibidos
      this.logger.debug(`Creating ingredient with data: ${JSON.stringify(createIngredientDto)}`);
      
      // Verificar y asignar valores por defecto si es necesario
      const unit = createIngredientDto.unit || 'unidad';
      const quantity = typeof createIngredientDto.quantity === 'number' ? createIngredientDto.quantity : 0;
      const minQuantity = typeof createIngredientDto.minQuantity === 'number' ? createIngredientDto.minQuantity : 0;
      
      this.logger.debug(`Processed values: unit=${unit}, quantity=${quantity}, minQuantity=${minQuantity}`);
      
      // Crear el ingrediente usando Prisma ORM
      const ingredient = await this.prisma.ingredient.create({
        data: {
          name: createIngredientDto.name,
          description: createIngredientDto.description,
          quantity: quantity,
          unit: unit,
          minQuantity: minQuantity,
          location: { connect: { id: createIngredientDto.locationId } },
          tenant: { connect: { id: createIngredientDto.tenantId } },
        },
        include: {
          location: true,
        },
      });

      this.logger.debug(`Created ingredient with ID: ${ingredient.id}`);

      return ingredient;
    } catch (error) {
      this.logger.error(`Error creating ingredient: ${error.message}`);
      this.logger.error(error.stack);
      throw new InternalServerErrorException(`Error creating ingredient: ${error.message}`);
    }
  }

  async findAll() {
    try {
      // Obtener todos los ingredientes usando Prisma ORM
      const ingredients = await this.prisma.ingredient.findMany({
        include: {
          location: true,
        },
      });
      
      return ingredients;
    } catch (error) {
      this.logger.error(`Error finding all ingredients: ${error.message}`);
      throw new InternalServerErrorException(`Error finding all ingredients: ${error.message}`);
    }
  }

  async findOne(id: string) {
    try {
      // Obtener el ingrediente usando Prisma ORM
      const ingredient = await this.prisma.ingredient.findUnique({
        where: { id },
        include: {
          location: true,
        },
      });
      
      return ingredient;
    } catch (error) {
      this.logger.error(`Error finding ingredient ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error finding ingredient: ${error.message}`);
    }
  }

  async update(id: string, updateIngredientDto: UpdateIngredientDto) {
    try {
      this.logger.debug(`Updating ingredient ${id} with data: ${JSON.stringify(updateIngredientDto)}`);
      
      // Actualizar el ingrediente usando Prisma ORM
      const ingredient = await this.prisma.ingredient.update({
        where: { id },
        data: updateIngredientDto,
        include: {
          location: true,
        },
      });
      
      return ingredient;
    } catch (error) {
      this.logger.error(`Error updating ingredient ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error updating ingredient: ${error.message}`);
    }
  }

  async remove(id: string) {
    try {
      // Primero obtenemos el ingrediente para devolver su info completa
      const ingredient = await this.findOne(id);
      
      if (!ingredient) {
        throw new Error(`Ingredient with id ${id} not found`);
      }
      
      // Eliminar el ingrediente usando Prisma ORM
      await this.prisma.ingredient.delete({
        where: { id },
      });
      
      return ingredient;
    } catch (error) {
      this.logger.error(`Error removing ingredient ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error removing ingredient: ${error.message}`);
    }
  }
} 