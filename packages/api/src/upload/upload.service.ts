import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Express } from 'express';
import * as path from 'path';
import * as heicConvert from 'heic-convert';
import * as sharp from 'sharp';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private configService: ConfigService) {
    // Log the configuration for debugging
    this.logger.log('Cloudinary Config:');
    this.logger.log(`Cloud Name: ${this.configService.get('CLOUDINARY_CLOUD_NAME')}`);
    this.logger.log(`API Key: ${this.configService.get('CLOUDINARY_API_KEY')}`);
    this.logger.log(`API Secret: ${this.configService.get('CLOUDINARY_API_SECRET')}`);

    // Verify all required environment variables are present
    const cloudName = this.configService.get('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get('CLOUDINARY_API_SECRET');

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Missing required Cloudinary configuration');
    }

    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    this.logger.log(
      `Attempting to upload file: ${file.originalname}, mimetype: ${file.mimetype}, size: ${file.size} bytes`,
    );

    let fileBuffer = file.buffer;
    let originalName = file.originalname;

    // Convert HEIC/HEIF to JPEG
    if (file.mimetype === 'image/heic' || file.mimetype === 'image/heif') {
      this.logger.log(`Converting HEIC/HEIF file: ${file.originalname}`);
      try {
        fileBuffer = await heicConvert({
          buffer: file.buffer,
          format: 'JPEG',
          quality: 0.9,
        });
        originalName = `${path.parse(file.originalname).name}.jpg`;
        this.logger.log(`Successfully converted ${file.originalname} to JPEG.`);
      } catch (conversionError) {
        this.logger.error('Error converting HEIC/HEIF file:', conversionError);
        throw new Error('Failed to convert HEIC image.');
      }
    }

    // Sanitize the filename to create a safe public_id for Cloudinary
    const parsedName = path.parse(originalName).name;
    const sanitizedName = parsedName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const publicId = `${sanitizedName}_${Date.now()}`;

    try {
      const result = await new Promise((resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
          {
            resource_type: 'auto',
            folder: 'restaurant',
            public_id: publicId,
          },
          (error, result) => {
            if (error) {
              this.logger.error('Error from Cloudinary stream:', error);
              reject(error);
            } else {
              this.logger.log('Successfully uploaded to Cloudinary');
              resolve(result);
            }
          },
        );

        upload.end(fileBuffer);
      });

      const secureUrl = (result as any).secure_url;
      this.logger.log(`Upload successful. Cloudinary URL: ${secureUrl}`);
      return { url: secureUrl };
    } catch (error) {
      this.logger.error('Error uploading to Cloudinary:', error);
      throw error;
    }
  }
} 