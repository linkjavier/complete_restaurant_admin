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
});
