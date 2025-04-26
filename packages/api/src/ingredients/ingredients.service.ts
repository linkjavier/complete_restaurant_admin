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

  async create(createIngredientDto: CreateIngredientDto) {
    try {
      // Depurar los valores recibidos
      this.logger.debug(`Creating ingredient with data: ${JSON.stringify(createIngredientDto)}`);
      
      // Verificar y asignar valores por defecto si es necesario
      const unit = createIngredientDto.unit || 'unidad';
      const quantity = typeof createIngredientDto.quantity === 'number' ? createIngredientDto.quantity : 0;
      const minQuantity = typeof createIngredientDto.minQuantity === 'number' ? createIngredientDto.minQuantity : 0;
      
      this.logger.debug(`Processed values: unit=${unit}, quantity=${quantity}, minQuantity=${minQuantity}`);
      
      // Crear el ingrediente solo con los campos básicos
      const ingredient = await this.prisma.$queryRaw`
        INSERT INTO "Ingredient" ("id", "name", "unit", "locationId", "quantity", "minQuantity", "description", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid(), 
          ${createIngredientDto.name}, 
          ${unit}, 
          ${createIngredientDto.locationId}, 
          ${quantity}, 
          ${minQuantity}, 
          ${createIngredientDto.description || null}, 
          now(), 
          now()
        )
        RETURNING *
      ` as any;

      // Obtener el ID del nuevo ingrediente (los resultados de queryRaw vienen como array)
      const newIngredient = Array.isArray(ingredient) ? ingredient[0] : ingredient;
      
      this.logger.debug(`Created ingredient with ID: ${newIngredient.id}`);

      // Recuperar el ingrediente con su información de ubicación manualmente
      const location = await this.prisma.location.findUnique({
        where: { id: createIngredientDto.locationId }
      });

      return {
        ...newIngredient,
        location
      };
    } catch (error) {
      this.logger.error(`Error creating ingredient: ${error.message}`);
      this.logger.error(error.stack);
      throw new InternalServerErrorException(`Error creating ingredient: ${error.message}`);
    }
  }

  async findAll() {
    try {
      // Obtener todos los ingredientes
      const ingredients = await this.prisma.$queryRaw`
        SELECT i.*, l.name as "locationName"
        FROM "Ingredient" i
        LEFT JOIN "Location" l ON i."locationId" = l.id
      ` as any[];
      
      // Transformar los resultados para tener la estructura adecuada
      return ingredients.map(ingredient => ({
        ...ingredient,
        location: {
          id: ingredient.locationId,
          name: ingredient.locationName
        }
      }));
    } catch (error) {
      this.logger.error(`Error finding all ingredients: ${error.message}`);
      throw new InternalServerErrorException(`Error finding all ingredients: ${error.message}`);
    }
  }

  async findOne(id: string) {
    try {
      // Obtener el ingrediente
      const ingredients = await this.prisma.$queryRaw`
        SELECT i.*, l.name as "locationName"
        FROM "Ingredient" i
        LEFT JOIN "Location" l ON i."locationId" = l.id
        WHERE i.id = ${id}
      ` as any[];
      
      if (!ingredients.length) {
        return null;
      }
      
      const ingredient = ingredients[0];
      
      return {
        ...ingredient,
        location: {
          id: ingredient.locationId,
          name: ingredient.locationName
        }
      };
    } catch (error) {
      this.logger.error(`Error finding ingredient ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error finding ingredient: ${error.message}`);
    }
  }

  async update(id: string, updateIngredientDto: UpdateIngredientDto) {
    try {
      this.logger.debug(`Updating ingredient ${id} with data: ${JSON.stringify(updateIngredientDto)}`);
      
      // Construir la consulta SQL dinámicamente
      let setClauses = [];
      const params = [];
      
      if (updateIngredientDto.name) {
        setClauses.push(`"name" = $${params.length + 1}`);
        params.push(updateIngredientDto.name);
      }
      
      if (updateIngredientDto.description !== undefined) {
        setClauses.push(`"description" = $${params.length + 1}`);
        params.push(updateIngredientDto.description);
      }
      
      if (updateIngredientDto.quantity !== undefined) {
        setClauses.push(`"quantity" = $${params.length + 1}`);
        params.push(updateIngredientDto.quantity);
      }
      
      if (updateIngredientDto.unit) {
        setClauses.push(`"unit" = $${params.length + 1}`);
        params.push(updateIngredientDto.unit);
      }
      
      if (updateIngredientDto.minQuantity !== undefined) {
        setClauses.push(`"minQuantity" = $${params.length + 1}`);
        params.push(updateIngredientDto.minQuantity);
      }
      
      if (updateIngredientDto.locationId) {
        setClauses.push(`"locationId" = $${params.length + 1}`);
        params.push(updateIngredientDto.locationId);
      }
      
      // Añadir la fecha de actualización
      setClauses.push(`"updatedAt" = now()`);
      
      // Solo actualizar si hay algo que actualizar
      if (setClauses.length === 0) {
        return await this.findOne(id);
      }
      
      // Construir y ejecutar la consulta SQL
      const setClause = setClauses.join(', ');
      params.push(id); // Añadir el ID al final para la cláusula WHERE
      
      const queryStr = `
        UPDATE "Ingredient" 
        SET ${setClause} 
        WHERE id = $${params.length} 
        RETURNING *
      `;
      
      this.logger.debug(`Executing SQL: ${queryStr} with params: ${params}`);
      
      const updatedIngredients = await this.prisma.$queryRawUnsafe(queryStr, ...params) as any[];
      
      if (!updatedIngredients.length) {
        throw new Error(`Ingredient with id ${id} not found`);
      }
      
      // Obtener el ingrediente actualizado con su ubicación
      return await this.findOne(id);
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
      
      // Eliminar el ingrediente
      await this.prisma.$queryRaw`
        DELETE FROM "Ingredient"
        WHERE id = ${id}
      `;
      
      return ingredient;
    } catch (error) {
      this.logger.error(`Error removing ingredient ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error removing ingredient: ${error.message}`);
    }
  }
} 