import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  BadRequestException,
  ForbiddenException,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseEnumPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProductsService } from './products.service';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { CreateProductDto, UpdateProductDto } from './product.dto';
import { CurrentTenant } from '../auth/decorators/tenant.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { User } from '@prisma/client';
import { UploadService } from '../upload/upload.service';
import { UpdateProductArDto } from './product-ar.dto';

enum ProductArAssetType {
  GLB = 'glb',
  USDZ = 'usdz',
  THUMBNAIL = 'thumbnail',
}

const arAssetFileFilter = (
  _request: Express.Request,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  const extension = file.originalname.split('.').pop()?.toLowerCase();
  const allowedExtensions: Record<ProductArAssetType, string[]> = {
    [ProductArAssetType.GLB]: ['glb'],
    [ProductArAssetType.USDZ]: ['usdz'],
    [ProductArAssetType.THUMBNAIL]: ['jpg', 'jpeg', 'png', 'webp'],
  };
  if (!extension || !Object.values(allowedExtensions).some((extensions) => extensions.includes(extension))) {
    callback(new BadRequestException('Formato de archivo AR no permitido'), false);
    return;
  }
  callback(null, true);
};

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly uploadService: UploadService,
  ) {}

  @Get(':id/ar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async getProductAr(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    await this.assertProductLocationAccess(id, tenantId, user);
    return this.productsService.getArConfiguration(id, tenantId);
  }

  @Patch(':id/ar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  async updateProductAr(
    @Param('id') id: string,
    @Body() data: UpdateProductArDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    await this.assertProductLocationAccess(id, tenantId, user);
    return this.productsService.updateArConfiguration(id, tenantId, data);
  }

  @Post(':id/ar/assets/:assetType')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN', 'MANAGER')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 40 * 1024 * 1024, files: 1 },
      fileFilter: arAssetFileFilter,
    }),
  )
  async uploadProductArAsset(
    @Param('id') id: string,
    @Param('assetType', new ParseEnumPipe(ProductArAssetType)) assetType: ProductArAssetType,
    @UploadedFile() file: Express.Multer.File,
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
  ) {
    await this.assertProductLocationAccess(id, tenantId, user);
    if (!file) {
      throw new BadRequestException('Selecciona un archivo para cargar');
    }
    this.validateArAssetContent(assetType, file);
    const uploaded = await this.uploadService.uploadArAsset(
      file,
      tenantId,
      id,
      assetType,
    );
    return this.productsService.setArAsset(
      id,
      tenantId,
      assetType,
      uploaded.url,
      file.size,
    );
  }

  private async assertProductLocationAccess(
    id: string,
    tenantId: string,
    user: User,
  ) {
    if (user.role === 'MANAGER' && !user.locationId) {
      throw new ForbiddenException('El gerente no tiene una sede asignada');
    }
    if (user.role !== 'SUPER_ADMIN' && user.locationId) {
      return this.productsService.assertProductInLocation(
        id,
        tenantId,
        user.locationId,
      );
    }
    return this.productsService.assertProductInTenant(id, tenantId);
  }

  private validateArAssetContent(
    assetType: ProductArAssetType,
    file: Express.Multer.File,
  ) {
    const extension = file.originalname.split('.').pop()?.toLowerCase();
    if (assetType === ProductArAssetType.GLB) {
      if (
        extension !== 'glb' ||
        file.buffer.length < 12 ||
        file.buffer.toString('ascii', 0, 4) !== 'glTF' ||
        file.buffer.readUInt32LE(4) !== 2 ||
        file.buffer.readUInt32LE(8) !== file.buffer.length
      ) {
        throw new BadRequestException('El archivo no es un modelo GLB 2.0 válido');
      }
      return;
    }
    if (assetType === ProductArAssetType.USDZ) {
      if (
        extension !== 'usdz' ||
        file.buffer.length < 30 ||
        file.buffer.toString('ascii', 0, 4) !== 'PK\u0003\u0004' ||
        file.buffer.readUInt16LE(8) !== 0
      ) {
        throw new BadRequestException('El archivo no es un paquete USDZ válido');
      }
      return;
    }
    const isJpeg = file.buffer.length >= 3 &&
      file.buffer[0] === 0xff &&
      file.buffer[1] === 0xd8 &&
      file.buffer[2] === 0xff;
    const isPng = file.buffer.length >= 8 &&
      file.buffer.toString('hex', 0, 8) === '89504e470d0a1a0a';
    const isWebp = file.buffer.length >= 12 &&
      file.buffer.toString('ascii', 0, 4) === 'RIFF' &&
      file.buffer.toString('ascii', 8, 12) === 'WEBP';
    const matchesMime =
      (file.mimetype === 'image/jpeg' && isJpeg) ||
      (file.mimetype === 'image/png' && isPng) ||
      (file.mimetype === 'image/webp' && isWebp);
    if (file.size > 5 * 1024 * 1024 || !matchesMime) {
      throw new BadRequestException(
        'La miniatura debe ser JPG, PNG o WebP y no superar 5 MB',
      );
    }
  }

  @Post()
  create(@Body() createProductDto: CreateProductDto, @CurrentTenant() tenantId: string) {
    return this.productsService.create(createProductDto, tenantId);
  }

  @Public()
  @Get()
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('locationId') locationId: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    return this.productsService.findAll({
      tenantId,
      locationId,
      categoryId,
      search,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentTenant() tenantId: string,
  ) {
    if (updateProductDto.quantity !== undefined) {
      throw new BadRequestException(
        'Para modificar existencias, crea una modificación desde el módulo Inventarios.',
      );
    }
    return this.productsService.update(id, updateProductDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }
}
