import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Express } from 'express';

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
    try {
      const result = await new Promise((resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
          {
            resource_type: 'auto',
            folder: 'restaurant',
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          },
        );

        upload.end(file.buffer);
      });

      return { url: (result as any).secure_url };
    } catch (error) {
      this.logger.error('Error uploading to Cloudinary:', error);
      throw error;
    }
  }
} 