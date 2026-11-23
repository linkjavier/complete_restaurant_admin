import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { UpdateProductArDto } from './product-ar.dto';
import { UploadService } from '../upload/upload.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(
    private prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  async assertProductInTenant(id: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
  }

  async assertProductInLocation(
    id: string,
    tenantId: string,
    locationId: string,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, locationId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado en esta sede');
    }
  }

  async getArConfiguration(id: string, tenantId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        arEnabled: true,
        model3dUrl: true,
        modelUsdzUrl: true,
        modelThumbnailUrl: true,
        modelScale: true,
        arPlacement: true,
        modelFileSize: true,
      },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    return this.mapPublicModelUrls(product);
  }

  async updateArConfiguration(
    id: string,
    tenantId: string,
    input: UpdateProductArDto,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      select: { id: true, model3dUrl: true },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }

    const model3dUrl = input.model3dUrl === undefined
      ? product.model3dUrl
      : input.model3dUrl;
    if (input.enabled && !model3dUrl) {
      throw new BadRequestException(
        'Carga un modelo GLB antes de activar la experiencia AR',
      );
    }
    this.validateModelUrl(input.model3dUrl, ['glb']);
    this.validateModelUrl(input.modelUsdzUrl, ['usdz']);
    this.validateModelUrl(input.modelThumbnailUrl, [
      'jpg',
      'jpeg',
      'png',
      'webp',
    ]);

    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: {
        arEnabled: input.enabled,
        ...(input.model3dUrl !== undefined && {
          model3dUrl: input.model3dUrl || null,
        }),
        ...(input.modelUsdzUrl !== undefined && {
          modelUsdzUrl: input.modelUsdzUrl || null,
        }),
        ...(input.modelThumbnailUrl !== undefined && {
          modelThumbnailUrl: input.modelThumbnailUrl || null,
        }),
        ...(input.modelScale !== undefined && {
          modelScale:
            input.modelScale === null
              ? Prisma.DbNull
              : {
                  x: input.modelScale.x,
                  y: input.modelScale.y,
                  z: input.modelScale.z,
                },
        }),
        ...(input.arPlacement !== undefined && {
          arPlacement: input.arPlacement,
        }),
      },
      select: {
        id: true,
        arEnabled: true,
        model3dUrl: true,
        modelUsdzUrl: true,
        modelThumbnailUrl: true,
        modelScale: true,
        arPlacement: true,
        modelFileSize: true,
      },
    });
    return this.mapPublicModelUrls(updatedProduct);
  }

  async setArAsset(
    id: string,
    tenantId: string,
    assetType: 'glb' | 'usdz' | 'thumbnail',
    url: string,
    fileSize: number,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado');
    }
    const field = {
      glb: 'model3dUrl',
      usdz: 'modelUsdzUrl',
      thumbnail: 'modelThumbnailUrl',
    } as const;
    const updatedProduct = await this.prisma.product.update({
      where: { id },
      data: {
        [field[assetType]]: url,
        ...(assetType === 'glb' && { modelFileSize: fileSize }),
      },
      select: {
        id: true,
        arEnabled: true,
        model3dUrl: true,
        modelUsdzUrl: true,
        modelThumbnailUrl: true,
        modelScale: true,
        arPlacement: true,
        modelFileSize: true,
      },
    });
    return this.mapPublicModelUrls(updatedProduct);
  }

  private mapPublicModelUrls<
    T extends { model3dUrl: string | null; modelUsdzUrl: string | null },
  >(product: T): T {
    return {
      ...product,
      model3dUrl: this.uploadService.toPublicModelUrl(product.model3dUrl),
      modelUsdzUrl: this.uploadService.toPublicModelUrl(product.modelUsdzUrl),
    };
  }

  private validateModelUrl(value: string | null | undefined, extensions: string[]) {
    if (value == null) {
      return;
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('La URL del modelo no es válida');
    }
    if (
      url.protocol !== 'https:' ||
      !extensions.includes(url.pathname.split('.').pop()?.toLowerCase() || '')
    ) {
      throw new BadRequestException(
        `La URL del archivo debe usar HTTPS y una extensión válida (${extensions.join(', ')})`,
      );
    }
  }

  async create(data: any, tenantId: string): Promise<any> {
    try {
      this.logger.debug(`Creating product with data: ${JSON.stringify(data)}`);
      const {
        code: _code,
        ingredients,
        components,
        variantGroups,
        categoryName,
        arEnabled: _arEnabled,
        model3dUrl: _model3dUrl,
        modelUsdzUrl: _modelUsdzUrl,
        modelThumbnailUrl: _modelThumbnailUrl,
        modelScale: _modelScale,
        arPlacement: _arPlacement,
        modelFileSize: _modelFileSize,
        ...productData
      } = data;
      const createdProduct = await this.prisma.$transaction(async (tx) => {
        await this.validateRecipe(tx, {
          tenantId,
          locationId: productData.locationId,
          ingredients: ingredients ?? [],
          components: components ?? [],
        });

        // 1. Crear el producto base
        const product = await tx.product.create({
          data: {
            ...productData,
            tenantId: tenantId
          },
        });
        // 2. Ingredientes
        if (ingredients && ingredients.length > 0) {
          for (const ingredient of ingredients) {
            await tx.productIngredient.create({
              data: {
                productId: product.id,
                ingredientId: ingredient.ingredientId,
                quantity: ingredient.quantity
              }
            });
          }
        }
        for (const component of components ?? []) {
          await tx.productComponent.create({
            data: {
              productId: product.id,
              componentId: component.componentId,
              quantity: component.quantity,
            },
          });
        }
        // 3. Crear grupos de variantes si existen
        if (variantGroups && variantGroups.length > 0) {
          for (const groupData of variantGroups) {
            const group = await tx.productVariantGroup.create({
              data: {
                name: groupData.name,
                order: groupData.order,
                product: { connect: { id: product.id } },
                tenant: { connect: { id: tenantId } }
              } as any,
            });

            // 4. Crear variantes para cada grupo
            if (groupData.variants && groupData.variants.length > 0) {
              for (const variantData of groupData.variants) {
                await tx.productVariant.create({
                  data: {
                    name: variantData.name,
                    price: variantData.price,
                    image: variantData.image,
                    isActive: variantData.isActive,
                    group: { connect: { id: group.id } },
                    product: { connect: { id: product.id } },
                    tenant: { connect: { id: tenantId } }
                  } as any,
                });
              }
            }
          }
        }
        // 5. Obtener el producto completo con ingredientes y grupos/variantes
        return await tx.product.findUnique({
          where: { id: product.id },
          include: {
            category: true,
            ingredients: {
              include: {
                ingredient: true,
              },
            },
            components: { include: { component: true } },
            variantGroups: {
              include: {
                variants: true,
              },
            },
          },
        });
      });
      if (!createdProduct) {
        return null;
      }
      const {
        arEnabled: _arEnabledResponse,
        model3dUrl: _model3dUrlResponse,
        modelUsdzUrl: _modelUsdzUrlResponse,
        modelThumbnailUrl: _modelThumbnailUrlResponse,
        modelScale: _modelScaleResponse,
        arPlacement: _arPlacementResponse,
        modelFileSize: _modelFileSizeResponse,
        ...safeProduct
      } = createdProduct;
      return safeProduct;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error creating product: ${error.message}`);
      this.logger.error(error.stack);
      throw new InternalServerErrorException(`Error creating product: ${error.message}`);
    }
  }

  async findAll({ tenantId, locationId, categoryId, search }: { tenantId: string; locationId: string; categoryId?: string; search?: string; }) {
    try {
      const products = await this.prisma.product.findMany({
        where: {
          tenantId,
          locationId,
          categoryId: categoryId,
          OR: search
            ? [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ]
            : undefined,
        },
        include: {
          category: true,
          location: {
            select: { id: true, name: true },
          },
          variantGroups: {
            where: { isActive: true },
            include: {
              variants: { where: { isActive: true } }
            },
            orderBy: { order: 'asc' }
          },
          ingredients: { include: { ingredient: true } },
          components: { include: { component: true } },
        },
      });
      return products.map((product) => {
        const safeProduct = { ...product };
        delete safeProduct.arEnabled;
        delete safeProduct.model3dUrl;
        delete safeProduct.modelUsdzUrl;
        delete safeProduct.modelThumbnailUrl;
        delete safeProduct.modelScale;
        delete safeProduct.arPlacement;
        delete safeProduct.modelFileSize;
        return safeProduct;
      });
    } catch (error) {
      this.logger.error(`Error finding products: ${error.message}`);
      throw new InternalServerErrorException(`Error finding products: ${error.message}`);
    }
  }

  async findOne(id: string): Promise<any> {
    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
        include: {
          category: true,
          ingredients: { include: { ingredient: true } },
          components: { include: { component: true } },
          variantGroups: {
            where: { isActive: true },
            include: {
              variants: { where: { isActive: true } }
            },
            orderBy: { order: 'asc' }
          },
        },
      });
      if (!product) {
        return null;
      }
      const {
        arEnabled,
        model3dUrl,
        modelUsdzUrl,
        modelThumbnailUrl,
        modelScale,
        arPlacement,
        modelFileSize,
        ...publicProduct
      } = product;
      return publicProduct;
    } catch (error) {
      this.logger.error(`Error finding product ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error finding product: ${error.message}`);
    }
  }

  async update(id: string, data: any, tenantId: string): Promise<any> {
    try {
      const {
        ingredients,
        components,
        variantGroups,
        categoryId,
        locationId,
        code: _code,
        id: _id,
        tenantId: _tenantId,
        createdAt,
        updatedAt,
        arEnabled: _arEnabled,
        model3dUrl: _model3dUrl,
        modelUsdzUrl: _modelUsdzUrl,
        modelThumbnailUrl: _modelThumbnailUrl,
        modelScale: _modelScale,
        arPlacement: _arPlacement,
        modelFileSize: _modelFileSize,
        ...productData
      } = data;
      if (categoryId) productData.category = { connect: { id: categoryId } };
      if (locationId) productData.location = { connect: { id: locationId } };
      const updatedProduct = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.product.findFirst({
          where: { id, tenantId },
          include: { ingredients: true, components: true },
        });
        if (!existing) {
          throw new NotFoundException('Product not found');
        }

        if (data.isIntermediate === false) {
          const usedInRecipes = await tx.productComponent.count({
            where: { componentId: id },
          });
          if (usedInRecipes > 0) {
            throw new BadRequestException(
              'A product used in another recipe must remain an intermediate product',
            );
          }
        }

        await this.validateRecipe(tx, {
          productId: id,
          tenantId,
          locationId: locationId ?? existing.locationId,
          ingredients:
            ingredients ??
            existing.ingredients.map(({ ingredientId, quantity }) => ({
              ingredientId,
              quantity,
            })),
          components:
            components ??
            existing.components.map(({ componentId, quantity }) => ({
              componentId,
              quantity,
            })),
        });

        // 1. Actualizar el producto
        const product = await tx.product.update({ where: { id }, data: productData });
        // 2. Ingredientes
        if (ingredients) {
          await tx.productIngredient.deleteMany({ where: { productId: id } });
          for (const ingredient of ingredients) {
            await tx.productIngredient.create({
              data: {
                productId: product.id,
                ingredientId: ingredient.ingredientId,
                quantity: ingredient.quantity
              }
            });
          }
        }
        if (components) {
          await tx.productComponent.deleteMany({ where: { productId: id } });
          for (const component of components) {
            await tx.productComponent.create({
              data: {
                productId: product.id,
                componentId: component.componentId,
                quantity: component.quantity,
              },
            });
          }
        }
        // 3. Grupos de variantes y variantes
        if (variantGroups) {
          // Borrado lógico de variantes y grupos de variantes
          const oldGroups = await tx.productVariantGroup.findMany({ where: { productId: id } });
          for (const group of oldGroups) {
            await tx.productVariant.updateMany({ where: { groupId: group.id }, data: { isActive: false } });
          }
          await tx.productVariantGroup.updateMany({ where: { productId: id }, data: { isActive: false } });
          // Crear nuevos grupos y variantes
          for (const groupData of variantGroups) {
            const group = await tx.productVariantGroup.create({
              data: {
                name: groupData.name,
                order: groupData.order,
                product: { connect: { id: product.id } },
                tenant: { connect: { id: tenantId } }
              } as any,
            });
            if (groupData.variants && groupData.variants.length > 0) {
              for (const variantData of groupData.variants) {
                await tx.productVariant.create({
                  data: {
                    name: variantData.name,
                    price: variantData.price,
                    image: variantData.image,
                    isActive: variantData.isActive,
                    group: { connect: { id: group.id } },
                    product: { connect: { id: product.id } },
                    tenant: { connect: { id: tenantId } }
                  } as any,
                });
              }
            }
          }
        }
        // 4. Obtener el producto actualizado
        return await tx.product.findUnique({
          where: { id: product.id },
          include: {
            category: true,
            ingredients: { include: { ingredient: true } },
            components: { include: { component: true } },
            variantGroups: {
              include: { variants: true },
              orderBy: { order: 'asc' }
            },
          },
        });
      });
      if (!updatedProduct) {
        return null;
      }
      const {
        arEnabled: _arEnabledResponse,
        model3dUrl: _model3dUrlResponse,
        modelUsdzUrl: _modelUsdzUrlResponse,
        modelThumbnailUrl: _modelThumbnailUrlResponse,
        modelScale: _modelScaleResponse,
        arPlacement: _arPlacementResponse,
        modelFileSize: _modelFileSizeResponse,
        ...safeProduct
      } = updatedProduct;
      return safeProduct;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error updating product ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error updating product: ${error.message}`);
    }
  }

  async remove(id: string): Promise<any> {
    try {
      // Obtener el producto antes de eliminarlo
      const product = await this.findOne(id);

      if (!product) {
        throw new Error(`Product with id ${id} not found`);
      }

      // Transacción para eliminar el producto y sus relaciones
      await this.prisma.$transaction(async (tx) => {
        // 1. Eliminar las relaciones de ingredientes
        await tx.productIngredient.deleteMany({
          where: {
            productId: id
          }
        });

        const usedInRecipes = await tx.productComponent.count({
          where: { componentId: id },
        });
        if (usedInRecipes > 0) {
          throw new BadRequestException(
            'Remove this product from other recipes before deleting it',
          );
        }
        await tx.productComponent.deleteMany({ where: { productId: id } });

        // 2. Eliminar las relaciones de variantes
        await tx.productVariant.deleteMany({
          where: {
            productId: id
          }
        });

        // 3. Eliminar el producto
        await tx.product.delete({
          where: { id },
        });
      });

      return product;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error removing product ${id}: ${error.message}`);
      throw new InternalServerErrorException(`Error removing product: ${error.message}`);
    }
  }

  private async validateRecipe(
    tx: Prisma.TransactionClient,
    params: {
      productId?: string;
      tenantId: string;
      locationId?: string;
      ingredients: { ingredientId: string; quantity: number }[];
      components: { componentId: string; quantity: number }[];
    },
  ) {
    const { productId, tenantId, locationId, ingredients, components } = params;
    if (!locationId) {
      throw new BadRequestException('A location is required to configure a recipe');
    }

    const ingredientIds = ingredients.map(({ ingredientId }) => ingredientId);
    const componentIds = components.map(({ componentId }) => componentId);

    if (new Set(ingredientIds).size !== ingredientIds.length) {
      throw new BadRequestException('A recipe cannot contain duplicate ingredients');
    }
    if (new Set(componentIds).size !== componentIds.length) {
      throw new BadRequestException('A recipe cannot contain duplicate products');
    }
    if (
      [...ingredients, ...components].some(
        ({ quantity }) => !Number.isFinite(quantity) || quantity <= 0,
      )
    ) {
      throw new BadRequestException('Recipe quantities must be greater than zero');
    }

    const [validIngredients, validComponents] = await Promise.all([
      ingredientIds.length
        ? tx.ingredient.findMany({
            where: { id: { in: ingredientIds }, tenantId, locationId },
            select: { id: true },
          })
        : [],
      componentIds.length
        ? tx.product.findMany({
            where: {
              id: { in: componentIds },
              tenantId,
              locationId,
              isIntermediate: true,
            },
            select: { id: true },
          })
        : [],
    ]);

    if (validIngredients.length !== ingredientIds.length) {
      throw new BadRequestException(
        'Recipe ingredients must belong to the same business and location',
      );
    }
    if (validComponents.length !== componentIds.length) {
      throw new BadRequestException(
        'Recipe products must be intermediate products in the same business and location',
      );
    }

    if (productId && componentIds.length) {
      const visited = new Set<string>();
      let pending = componentIds;
      while (pending.length) {
        if (pending.includes(productId)) {
          throw new BadRequestException('Product recipes cannot contain a cycle');
        }
        const next = pending.filter((id) => !visited.has(id));
        if (!next.length) break;
        next.forEach((id) => visited.add(id));
        const descendants = await tx.productComponent.findMany({
          where: { productId: { in: next } },
          select: { componentId: true },
        });
        pending = descendants.map(({ componentId }) => componentId);
      }
    }
  }
}