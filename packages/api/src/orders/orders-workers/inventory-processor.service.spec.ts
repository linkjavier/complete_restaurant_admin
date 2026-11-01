import { Test, TestingModule } from '@nestjs/testing';
import { NotificationType } from '@prisma/client';
import { InventoryProcessorService } from './inventory-processor.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  InsufficientStockError,
  StockSyncService,
} from '../../inventory/stock-sync.service';

describe('InventoryProcessorService', () => {
  let service: InventoryProcessorService;

  const mockStockSync = {
    deductSyncedStock: jest.fn(),
  };

  const mockPrisma = {
    order: { findUnique: jest.fn() },
    ingredient: { findMany: jest.fn() },
    user: { findMany: jest.fn() },
    notification: { create: jest.fn() },
    $transaction: jest.fn((callback) => callback({})),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryProcessorService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StockSyncService, useValue: mockStockSync },
      ],
    }).compile();

    service = module.get<InventoryProcessorService>(InventoryProcessorService);
  });

  describe('updateInventoryForOrder', () => {
    const orderId = 'order-1';
    const ingredientId = 'ing-1';
    const productId = 'prod-1';
    const locationId = 'loc-1';

    const baseOrder = {
      id: orderId,
      locationId,
      items: [
        {
          quantity: 2,
          product: {
            id: productId,
            name: 'Burger',
            locationId,
            ingredients: [
              {
                quantity: 3,
                ingredient: { id: ingredientId, name: 'Beef', locationId },
              },
            ],
          },
        },
      ],
    };

    it('decrements synced stock when sufficient', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(baseOrder);
      mockStockSync.deductSyncedStock.mockResolvedValue({
        previousQuantity: 10,
        newQuantity: 4,
      });

      const result = await service.updateInventoryForOrder({
        data: { orderId },
      } as any);

      expect(mockStockSync.deductSyncedStock).toHaveBeenCalledWith(
        {},
        {
          ingredientId,
          locationId,
          amount: 6,
        },
      );
      expect(result).toEqual({
        success: true,
        orderId,
        updatedIngredients: 1,
      });
    });

    it('logs warning and skips decrement when stock is insufficient', async () => {
      const warnSpy = jest.spyOn(service['logger'], 'warn');

      mockPrisma.order.findUnique.mockResolvedValue(baseOrder);
      mockStockSync.deductSyncedStock.mockRejectedValue(
        new InsufficientStockError({
          name: 'Beef',
          required: 6,
          available: 2,
        }),
      );

      const result = await service.updateInventoryForOrder({
        data: { orderId },
      } as any);

      expect(warnSpy).toHaveBeenCalledWith(
        'Insufficient inventory for ingredient Beef: needed 6, available 2',
      );
      expect(result.updatedIngredients).toBe(0);
    });

    it('continues processing remaining ingredients after insufficient stock', async () => {
      const orderWithTwoIngredients = {
        id: orderId,
        locationId,
        items: [
          {
            quantity: 1,
            product: {
              id: productId,
              name: 'Combo',
              locationId,
              ingredients: [
                {
                  quantity: 10,
                  ingredient: { id: 'ing-low', name: 'Cheese', locationId },
                },
                {
                  quantity: 1,
                  ingredient: { id: 'ing-ok', name: 'Bun', locationId },
                },
              ],
            },
          },
        ],
      };

      mockPrisma.order.findUnique.mockResolvedValue(orderWithTwoIngredients);
      mockStockSync.deductSyncedStock
        .mockRejectedValueOnce(
          new InsufficientStockError({
            name: 'Cheese',
            required: 10,
            available: 1,
          }),
        )
        .mockResolvedValueOnce({
          previousQuantity: 5,
          newQuantity: 4,
        });

      const result = await service.updateInventoryForOrder({
        data: { orderId },
      } as any);

      expect(mockStockSync.deductSyncedStock).toHaveBeenCalledTimes(2);
      expect(result.updatedIngredients).toBe(1);
    });

    it('throws when order is not found', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        service.updateInventoryForOrder({ data: { orderId } } as any),
      ).rejects.toThrow(`Order ${orderId} not found`);
    });
  });

  describe('checkLowInventory', () => {
    const locationId = 'loc-1';

    it('creates LOW_STOCK notifications for managers when ingredients are below minimum', async () => {
      mockPrisma.ingredient.findMany.mockResolvedValue([
        { id: 'ing-1', name: 'Tomato', quantity: 2, minQuantity: 5, unit: 'kg' },
        { id: 'ing-2', name: 'Onion', quantity: 10, minQuantity: 5, unit: 'kg' },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', role: 'ADMIN' },
        { id: 'user-2', role: 'MANAGER' },
      ]);
      mockPrisma.notification.create.mockResolvedValue({});

      const result = await service.checkLowInventory({
        data: { locationId },
      } as any);

      expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2);
      expect(mockPrisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          type: NotificationType.LOW_STOCK,
          message: expect.stringContaining('Tomato'),
        },
      });
      expect(result).toEqual({
        success: true,
        lowInventoryCount: 1,
        items: [
          {
            ingredientId: 'ing-1',
            name: 'Tomato',
            quantity: 2,
            minQuantity: 5,
          },
        ],
      });
    });

    it('returns empty items when all ingredients are above minimum', async () => {
      mockPrisma.ingredient.findMany.mockResolvedValue([
        { id: 'ing-1', name: 'Tomato', quantity: 10, minQuantity: 5, unit: 'kg' },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.checkLowInventory({
        data: { locationId },
      } as any);

      expect(mockPrisma.notification.create).not.toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        lowInventoryCount: 0,
        items: [],
      });
    });
  });
});
