import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';
import { ProductsService } from './products.service';

describe('ProductsService recipes', () => {
  let service: ProductsService;

  const mockTx = {
    ingredient: { findMany: jest.fn() },
    product: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    productComponent: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    productIngredient: { create: jest.fn(), deleteMany: jest.fn() },
    productVariantGroup: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    productVariant: { create: jest.fn(), updateMany: jest.fn() },
  };
  const mockPrisma = {
    $transaction: jest.fn((callback) => callback(mockTx)),
    product: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTx.ingredient.findMany.mockResolvedValue([]);
    mockTx.product.findMany.mockResolvedValue([{ id: 'patty' }]);
    mockTx.product.create.mockResolvedValue({ id: 'burger', locationId: 'loc-1' });
    mockTx.productComponent.create.mockResolvedValue({});
    mockTx.product.findUnique.mockResolvedValue({ id: 'burger' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: UploadService,
          useValue: { toPublicModelUrl: (url: string | null) => url },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('creates a recipe that consumes an intermediate product', async () => {
    await service.create(
      {
        name: 'Hamburguesa doble',
        locationId: 'loc-1',
        ingredients: [],
        components: [{ componentId: 'patty', quantity: 2 }],
      },
      'tenant-1',
    );

    expect(mockTx.product.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['patty'] },
        tenantId: 'tenant-1',
        locationId: 'loc-1',
        isIntermediate: true,
      },
      select: { id: true },
    });

    expect(mockTx.productComponent.create).toHaveBeenCalledWith({
      data: {
        productId: 'burger',
        componentId: 'patty',
        quantity: 2,
      },
    });
  });

  it('does not accept AR configuration through the generic product create flow', async () => {
    await service.create(
      {
        name: 'Hamburguesa',
        locationId: 'loc-1',
        arEnabled: true,
        model3dUrl: 'https://example.com/model.glb',
        modelUsdzUrl: 'https://example.com/model.usdz',
      },
      'tenant-1',
    );

    expect(mockTx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          arEnabled: true,
          model3dUrl: 'https://example.com/model.glb',
          modelUsdzUrl: 'https://example.com/model.usdz',
        }),
      }),
    );
  });

  it('does not accept AR configuration through the generic product update flow', async () => {
    mockTx.product.findFirst.mockResolvedValue({
      id: 'burger',
      locationId: 'loc-1',
      ingredients: [],
      components: [],
    });
    mockTx.product.update.mockResolvedValue({ id: 'burger' });

    await service.update(
      'burger',
      {
        arEnabled: true,
        model3dUrl: 'https://example.com/model.glb',
      },
      'tenant-1',
    );

    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: 'burger' },
      data: {},
    });
  });

  it('does not expose AR configuration from the general product listing', async () => {
    mockPrisma.product.findMany.mockResolvedValue([
      {
        id: 'burger',
        name: 'Hamburguesa',
        arEnabled: true,
        model3dUrl: 'https://example.com/model.glb',
        modelUsdzUrl: null,
        modelThumbnailUrl: null,
        modelScale: null,
        arPlacement: 'floor',
        modelFileSize: 1024,
      },
    ]);

    await expect(
      service.findAll({ tenantId: 'tenant-1', locationId: 'loc-1' }),
    ).resolves.toEqual([{ id: 'burger', name: 'Hamburguesa' }]);
  });

  it('rejects intermediate products from a different location', async () => {
    mockTx.product.findMany.mockResolvedValue([]);

    await expect(
      service.create(
        {
          name: 'Hamburguesa',
          locationId: 'loc-1',
          components: [{ componentId: 'patty', quantity: 1 }],
        },
        'tenant-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockTx.product.create).not.toHaveBeenCalled();
  });

  it('rejects cyclic recipes', async () => {
    mockTx.product.findFirst.mockResolvedValue({
      id: 'burger',
      locationId: 'loc-1',
      ingredients: [],
      components: [],
    });
    mockTx.productComponent.findMany.mockResolvedValue([
      { componentId: 'burger' },
    ]);

    await expect(
      service.update(
        'burger',
        { components: [{ componentId: 'patty', quantity: 1 }] },
        'tenant-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockTx.product.update).not.toHaveBeenCalled();
  });
});
