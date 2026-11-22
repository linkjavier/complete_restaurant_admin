import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { UploadService } from './upload.service';

describe('UploadService AR model storage', () => {
  const values: Record<string, string> = {
    CLOUDINARY_CLOUD_NAME: 'cloud',
    CLOUDINARY_API_KEY: 'key',
    CLOUDINARY_API_SECRET: 'secret',
    CLOUDFLARE_R2_ACCOUNT_ID: 'account',
    CLOUDFLARE_R2_ACCESS_KEY_ID: 'access-key',
    CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'secret-key',
    CLOUDFLARE_R2_BUCKET_NAME: 'models',
    CLOUDFLARE_R2_PUBLIC_BASE_URL: 'https://models.example.com/',
  };
  const configService = {
    get: (name: string) => values[name],
  } as ConfigService;
  const file = {
    originalname: 'dish.glb',
    mimetype: 'model/gltf-binary',
    size: 4,
    buffer: Buffer.from('glTF'),
  } as Express.Multer.File;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores GLB models in the configured R2 bucket and returns the public URL', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const service = new UploadService(configService);

    const result = await service.uploadArAsset(
      file,
      'tenant-1',
      'product-1',
      'glb',
    );

    expect(result.url).toMatch(
      /^https:\/\/models\.example\.com\/restaurant-ar\/tenant-1\/product-1\/glb-[0-9a-f-]+\.glb$/,
    );
    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'models',
      Key: expect.stringMatching(
        /^restaurant-ar\/tenant-1\/product-1\/glb-[0-9a-f-]+\.glb$/,
      ),
      ContentLength: file.size,
      ContentType: 'model/gltf-binary',
      CacheControl: 'public, max-age=31536000, immutable',
    });
  });

  it('reports the R2 environment variables that are not configured', async () => {
    const missingConfig = {
      get: (name: string) =>
        name.startsWith('CLOUDFLARE_R2_') ? undefined : values[name],
    } as ConfigService;
    const service = new UploadService(missingConfig);

    await expect(
      service.uploadArAsset(file, 'tenant-1', 'product-1', 'glb'),
    ).rejects.toThrow('CLOUDFLARE_R2_ACCOUNT_ID');
  });

  it('rejects the R2 S3 API endpoint as a public model URL', async () => {
    const invalidPublicUrlConfig = {
      get: (name: string) =>
        name === 'CLOUDFLARE_R2_PUBLIC_BASE_URL'
          ? 'https://account.r2.cloudflarestorage.com/models'
          : values[name],
    } as ConfigService;
    const send = jest.spyOn(S3Client.prototype, 'send');
    const service = new UploadService(invalidPublicUrlConfig);

    await expect(
      service.uploadArAsset(file, 'tenant-1', 'product-1', 'glb'),
    ).rejects.toThrow('not the R2 S3 API endpoint');
    expect(send).not.toHaveBeenCalled();
  });

  it('converts an existing S3 API model URL to the configured public URL', () => {
    const service = new UploadService(configService);

    expect(
      service.toPublicModelUrl(
        'https://account.r2.cloudflarestorage.com/restaurant-ar/tenant-1/product-1/model.glb',
      ),
    ).toBe(
      'https://models.example.com/restaurant-ar/tenant-1/product-1/model.glb',
    );
    expect(
      service.toPublicModelUrl(
        'https://account.r2.cloudflarestorage.com/models/restaurant-ar/tenant-1/product-1/model.glb',
      ),
    ).toBe(
      'https://models.example.com/restaurant-ar/tenant-1/product-1/model.glb',
    );
    expect(
      service.toPublicModelUrl('https://res.cloudinary.com/cloud/model.glb'),
    ).toBe('https://res.cloudinary.com/cloud/model.glb');
  });
});
