jest.mock('pdf-parse', () => ({ PDFParse: jest.fn() }));
jest.mock('heic-convert', () => jest.fn());

import { ParserService } from './parser.service';

describe('ParserService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('falls back to OCR for PDFs when direct extraction is too short', async () => {
    const configService = {
      get: jest.fn().mockReturnValue('test-key'),
    } as any;

    const service = new ParserService(configService);
    const file = {
      originalname: 'chuzonando.pdf',
      mimetype: 'application/pdf',
      buffer: Buffer.from('dummy-pdf'),
    } as Express.Multer.File;

    jest.spyOn(service as any, 'parsePdf').mockResolvedValue({ text: '', metadata: {} });
    const ocrSpy = jest.spyOn(service as any, 'parsePdfWithOcr').mockResolvedValue('Producto demo\nPrecio 12.50');
    const aiSpy = jest.spyOn(service as any, 'extractProductsWithAI').mockResolvedValue({ products: [], categories: [] });

    await service.parseDocument(file);

    expect(ocrSpy).toHaveBeenCalledWith(file.buffer);
    expect(aiSpy).toHaveBeenCalledWith('Producto demo\nPrecio 12.50');
  });

  it('extracts purchase fields, normalizes invalid values, and skips unnamed rows', async () => {
    const configService = {
      get: jest.fn().mockReturnValue('test-key'),
    } as any;
    const service = new ParserService(configService);
    jest.spyOn(service as any, 'extractDocumentText').mockResolvedValue('Factura de proveedor');
    (service as any).openai = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  supplierName: ' Proveedor ',
                  purchaseDate: '2025-02-30',
                  items: [
                    { ingredientName: ' Arroz ', categoryName: ' Granos ', quantity: 2, unitCost: 1500 },
                    { ingredientName: '', quantity: 1, unitCost: 500 },
                    { ingredientName: 'Aceite', quantity: 'desconocido', unitCost: null },
                  ],
                }),
              },
            }],
          }),
        },
      },
    };

    const result = await service.parsePurchaseDocument({} as Express.Multer.File);

    expect(result).toEqual({
      supplierName: 'Proveedor',
      purchaseDate: null,
      items: [
        { ingredientName: 'Arroz', categoryName: 'Granos', quantity: 2, unitCost: 1500 },
        { ingredientName: 'Aceite', quantity: 0, unitCost: 0 },
      ],
    });
  });

  it('rejects purchase extraction when no item names are found', async () => {
    const configService = {
      get: jest.fn().mockReturnValue('test-key'),
    } as any;
    const service = new ParserService(configService);
    jest.spyOn(service as any, 'extractDocumentText').mockResolvedValue('Documento sin artículos');
    (service as any).openai = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: JSON.stringify({ items: [] }) } }],
          }),
        },
      },
    };

    await expect(service.parsePurchaseDocument({} as Express.Multer.File))
      .rejects.toThrow('No se encontraron ingredientes');
  });

  it('converts HEIC and HEIF images to JPEG before running OCR', async () => {
    const configService = {
      get: jest.fn().mockReturnValue('test-key'),
    } as any;
    const service = new ParserService(configService);
    const heicConvert = jest.requireMock('heic-convert') as jest.Mock;
    heicConvert.mockResolvedValue(Buffer.from('jpeg-image'));
    const runPythonSpy = jest
      .spyOn(service as any, 'runPythonScript')
      .mockResolvedValue({ stdout: 'Texto de factura', stderr: '' });

    for (const extension of ['heic', 'heif']) {
      const buffer = Buffer.from(`image-${extension}`);
      const text = await (service as any).extractDocumentText({
        originalname: `image.${extension.toUpperCase()}`,
        mimetype: `image/${extension}`,
        buffer,
      });

      expect(heicConvert).toHaveBeenCalledWith({
        buffer,
        format: 'JPEG',
        quality: 0.9,
      });
      const lastCall = runPythonSpy.mock.calls[runPythonSpy.mock.calls.length - 1];
      expect(lastCall?.[1][0]).toMatch(/input\.jpg$/);
      expect(text).toBe('Texto de factura');
    }
  });
});
