import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type StockTx = Prisma.TransactionClient;

export class InsufficientStockError extends Error {
  constructor(
    public readonly detail: {
      name: string;
      required: number;
      available: number;
    },
  ) {
    super('Insufficient stock');
    this.name = 'InsufficientStockError';
  }
}

export interface DeductStockSuccess {
  previousQuantity: number;
  newQuantity: number;
}

@Injectable()
export class StockSyncService {
  /**
   * Stock is mirrored in Ingredient.quantity and InventoryItem.quantity for the same
   * ingredient + location pair. Both admin screens (Ingredientes and Inventario) read
   * from these tables, so every write updates both to keep them aligned.
   */

  async ensureInventoryItem(
    tx: StockTx,
    ingredientId: string,
    locationId: string,
  ) {
    const ingredient = await tx.ingredient.findUnique({
      where: { id: ingredientId },
    });

    if (!ingredient) {
      return null;
    }

    return tx.inventoryItem.upsert({
      where: {
        ingredientId_locationId: { ingredientId, locationId },
      },
      create: {
        ingredientId,
        locationId,
        quantity: ingredient.quantity,
        minQuantity: ingredient.minQuantity,
      },
      update: {},
    });
  }

  async syncFromIngredient(
    tx: StockTx,
    ingredient: {
      id: string;
      locationId: string;
      quantity: number;
      minQuantity: number;
    },
  ) {
    return tx.inventoryItem.upsert({
      where: {
        ingredientId_locationId: {
          ingredientId: ingredient.id,
          locationId: ingredient.locationId,
        },
      },
      create: {
        ingredientId: ingredient.id,
        locationId: ingredient.locationId,
        quantity: ingredient.quantity,
        minQuantity: ingredient.minQuantity,
      },
      update: {
        quantity: ingredient.quantity,
        minQuantity: ingredient.minQuantity,
      },
    });
  }

  async syncFromInventoryItem(
    tx: StockTx,
    item: {
      ingredientId: string;
      quantity: number;
      minQuantity: number;
    },
  ) {
    return tx.ingredient.update({
      where: { id: item.ingredientId },
      data: {
        quantity: item.quantity,
        minQuantity: item.minQuantity,
      },
    });
  }

  async deductSyncedStock(
    tx: StockTx,
    params: { ingredientId: string; locationId: string; amount: number },
  ): Promise<DeductStockSuccess> {
    const { ingredientId, locationId, amount } = params;

    const currentIngredient = await tx.ingredient.findUnique({
      where: { id: ingredientId },
    });

    if (!currentIngredient) {
      throw new InsufficientStockError({
        name: ingredientId,
        required: amount,
        available: 0,
      });
    }

    await this.ensureInventoryItem(tx, ingredientId, locationId);

    const ingredientResult = await tx.ingredient.updateMany({
      where: {
        id: ingredientId,
        quantity: { gte: amount },
      },
      data: {
        quantity: { decrement: amount },
      },
    });

    if (ingredientResult.count === 0) {
      throw new InsufficientStockError({
        name: currentIngredient.name,
        required: amount,
        available: currentIngredient.quantity,
      });
    }

    const inventoryResult = await tx.inventoryItem.updateMany({
      where: {
        ingredientId,
        locationId,
        quantity: { gte: amount },
      },
      data: {
        quantity: { decrement: amount },
      },
    });

    if (inventoryResult.count === 0) {
      const inventoryItem = await tx.inventoryItem.findUnique({
        where: {
          ingredientId_locationId: { ingredientId, locationId },
        },
      });

      throw new InsufficientStockError({
        name: currentIngredient.name,
        required: amount,
        available: inventoryItem?.quantity ?? 0,
      });
    }

    const updatedIngredient = await tx.ingredient.findUnique({
      where: { id: ingredientId },
    });

    return {
      previousQuantity: currentIngredient.quantity,
      newQuantity: updatedIngredient!.quantity,
    };
  }
}
