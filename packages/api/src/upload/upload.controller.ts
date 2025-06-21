import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Multer } from 'multer';

@ApiTags('Upload')
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @ApiOperation({ summary: 'Upload an image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    console.log(`[Backend] Received image: ${file.originalname}, type: ${file.mimetype}`);
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Validar el tipo de archivo
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type. Allowed types: jpg, jpeg, png, gif, webp, avif');
    }

    // Validar el tamaño del archivo (15MB)
    const maxSize = 15 * 1024 * 1024; // 15MB en bytes
    if (file.size > maxSize) {
      throw new BadRequestException('File size too large. Maximum size is 15MB');
    }

    return this.uploadService.uploadImage(file);
  }
} 