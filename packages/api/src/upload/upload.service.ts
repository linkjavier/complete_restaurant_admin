import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiOptions } from 'cloudinary';
import { Express } from 'express';
import { randomUUID } from 'crypto';
import * as path from 'path';
import heicConvert from 'heic-convert';
import * as sharp from 'sharp';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly r2Client: S3Client | null;
  private readonly r2Bucket: string | null;
  private readonly r2PublicBaseUrl: string | null;
  private readonly r2S3EndpointHost: string | null;
  private readonly missingR2Configuration: string[];

  constructor(private configService: ConfigService) {
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

    const accountId = this.configService.get<string>('CLOUDFLARE_R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>(
      'CLOUDFLARE_R2_ACCESS_KEY_ID',
    );
    const secretAccessKey = this.configService.get<string>(
      'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    );
    const bucket = this.configService.get<string>(
      'CLOUDFLARE_R2_BUCKET_NAME',
    );
    const publicBaseUrl = this.configService
      .get<string>('CLOUDFLARE_R2_PUBLIC_BASE_URL')
      ?.replace(/\/+$/, '');
    const r2Configuration = {
      CLOUDFLARE_R2_ACCOUNT_ID: accountId,
      CLOUDFLARE_R2_ACCESS_KEY_ID: accessKeyId,
      CLOUDFLARE_R2_SECRET_ACCESS_KEY: secretAccessKey,
      CLOUDFLARE_R2_BUCKET_NAME: bucket,
      CLOUDFLARE_R2_PUBLIC_BASE_URL: publicBaseUrl,
    };

    this.missingR2Configuration = Object.entries(r2Configuration)
      .filter(([, value]) => !value)
      .map(([name]) => name);
    this.r2Bucket = bucket || null;
    this.r2PublicBaseUrl = publicBaseUrl || null;
    this.r2S3EndpointHost = accountId
      ? `${accountId}.r2.cloudflarestorage.com`
      : null;
    if (
      this.missingR2Configuration.length === 0 &&
      accountId &&
      accessKeyId &&
      secretAccessKey
    ) {
      this.r2Client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        forcePathStyle: true,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.r2Client = null;
    }
  }

  toPublicModelUrl(modelUrl: string | null): string | null {
    if (
      !modelUrl ||
      !this.r2S3EndpointHost ||
      !this.r2Bucket ||
      !this.r2PublicBaseUrl
    ) {
      return modelUrl;
    }

    try {
      const storedUrl = new URL(modelUrl);
      if (storedUrl.hostname !== this.r2S3EndpointHost) {
        return modelUrl;
      }

      const pathSegments = storedUrl.pathname
        .split('/')
        .filter(Boolean)
        .map(decodeURIComponent);
      if (pathSegments[0] === this.r2Bucket) {
        pathSegments.shift();
      }
      if (pathSegments.length === 0) {
        return modelUrl;
      }

      const objectKey = pathSegments.map(encodeURIComponent).join('/');
      return `${this.r2PublicBaseUrl}/${objectKey}`;
    } catch {
      return modelUrl;
    }
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

  async uploadArAsset(
    file: Express.Multer.File,
    tenantId: string,
    productId: string,
    assetType: 'glb' | 'usdz' | 'thumbnail',
  ): Promise<{ url: string }> {
    if (assetType !== 'thumbnail') {
      return this.uploadArModelToR2(file, tenantId, productId, assetType);
    }

    const extension = path.extname(file.originalname).toLowerCase();
    const tenantFolder = this.safeStorageSegment(tenantId);
    const productFolder = this.safeStorageSegment(productId);
    const publicId = `thumbnail-${Date.now()}`;

    const options: UploadApiOptions = {
      resource_type: 'image',
      folder: `restaurant-ar/${tenantFolder}/${productFolder}`,
      public_id: publicId,
      overwrite: false,
    };

    return new Promise((resolve, reject) => {
      const callback = (error: Error | undefined, result?: { secure_url?: string }) => {
        if (error) {
          this.logger.error('Error uploading AR asset to Cloudinary:', error);
          reject(error);
          return;
        }
        if (!result?.secure_url) {
          reject(new Error('Cloudinary did not return a secure asset URL'));
          return;
        }
        resolve({ url: result.secure_url });
      };
      const upload = cloudinary.uploader.upload_stream(options, callback);
      upload.end(file.buffer);
    });
  }

  private async uploadArModelToR2(
    file: Express.Multer.File,
    tenantId: string,
    productId: string,
    assetType: 'glb' | 'usdz',
  ): Promise<{ url: string }> {
    if (
      !this.r2Client ||
      !this.r2Bucket ||
      !this.r2PublicBaseUrl
    ) {
      throw new ServiceUnavailableException(
        `Cloudflare R2 is not configured. Set: ${this.missingR2Configuration.join(', ')}`,
      );
    }

    let publicUrl: URL;
    try {
      publicUrl = new URL(this.r2PublicBaseUrl);
    } catch {
      throw new ServiceUnavailableException(
        'CLOUDFLARE_R2_PUBLIC_BASE_URL must be a valid public HTTPS URL',
      );
    }
    if (
      publicUrl.protocol !== 'https:' ||
      publicUrl.hostname.endsWith('.r2.cloudflarestorage.com')
    ) {
      throw new ServiceUnavailableException(
        'CLOUDFLARE_R2_PUBLIC_BASE_URL must use the bucket public domain (R2.dev or a custom domain), not the R2 S3 API endpoint',
      );
    }

    const extension = assetType === 'glb' ? '.glb' : '.usdz';
    const key = [
      'restaurant-ar',
      this.safeStorageSegment(tenantId),
      this.safeStorageSegment(productId),
      `${assetType}-${randomUUID()}${extension}`,
    ].join('/');
    const contentType =
      assetType === 'glb' ? 'model/gltf-binary' : 'model/vnd.usdz+zip';

    await this.r2Client.send(
      new PutObjectCommand({
        Bucket: this.r2Bucket,
        Key: key,
        Body: file.buffer,
        ContentLength: file.size,
        ContentType: contentType,
        ContentDisposition: 'inline',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return {
      url: `${this.r2PublicBaseUrl}/${key
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
    };
  }

  private safeStorageSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '');
  }
}