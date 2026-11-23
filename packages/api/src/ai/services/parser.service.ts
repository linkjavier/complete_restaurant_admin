import { Injectable } from '@nestjs/common';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { PDFParse } from 'pdf-parse';
import * as xlsx from 'xlsx';
import * as mammoth from 'mammoth';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ParserService {
    private openai: OpenAI;

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        this.openai = new OpenAI({ apiKey });
    }

    async parseDocument(file: Express.Multer.File): Promise<any> {
        let text = '';
        const mimeType = (file.mimetype || '').toLowerCase();
        const extension = (file.originalname.split('.').pop()?.toLowerCase() || '').trim();
        const detectedExtension = extension || (mimeType === 'application/pdf' ? 'pdf' : mimeType.startsWith('image/') ? mimeType.split('/')[1] : '');
        const bufferSize = file.buffer?.byteLength ?? file.buffer?.length ?? 0;

        console.log(`[ParserService] Parsing file: ${file.originalname} (${file.mimetype})`);
        console.log(`[ParserService] File size: ${bufferSize} bytes | Extension: ${detectedExtension || 'unknown'} | MIME: ${mimeType || 'unknown'}`);

        try {
            switch (detectedExtension) {
                case 'pdf':
                    const pdfResult = await this.parsePdf(file.buffer);
                    text = pdfResult.text;
                    console.log(`[ParserService] PDF metadata: pages=${pdfResult.metadata?.numpages ?? 'n/a'} | render=${pdfResult.metadata?.numrender ?? 'n/a'}`);

                    if (!text || text.trim().length < 40) {
                        console.warn('[ParserService] PDF text extraction was too short. Trying OCR fallback.');
                        text = await this.parsePdfWithOcr(file.buffer);
                        console.log(`[ParserService] OCR fallback produced ${text?.trim().length || 0} characters.`);
                    }
                    break;
                case 'jpg':
                case 'jpeg':
                case 'png':
                case 'webp':
                    console.log('[ParserService] Image detected. Running OCR extraction.');
                    text = await this.parseImageWithOcr(file.buffer, detectedExtension);
                    break;
                case 'xlsx':
                case 'xls':
                case 'csv':
                    text = await this.parseExcel(file.buffer);
                    break;
                case 'docx':
                case 'doc':
                    text = await this.parseWord(file.buffer);
                    break;
                default:
                    if (mimeType.startsWith('image/')) {
                        console.log('[ParserService] Image MIME type detected. Running OCR extraction.');
                        text = await this.parseImageWithOcr(file.buffer, mimeType.split('/')[1] || 'png');
                        break;
                    }
                    throw new Error(`Formato de archivo no soportado: ${detectedExtension || extension || mimeType}`);
            }
        } catch (error) {
            console.error(`[ParserService] Error parsing ${extension} file:`, error);
            throw new Error(`Error al leer el archivo ${detectedExtension || extension || mimeType}: ${error.message}`);
        }

        const cleanText = text?.trim() || '';
        const preview = this.getTextPreview(cleanText);
        console.log(`[ParserService] Extracted ${cleanText.length} characters. Preview: ${preview}`);

        if (!cleanText || cleanText.length < 5) {
            console.warn('[ParserService] Extracted text is too short or empty');
            throw new Error(`El documento no contiene suficiente texto legible para extraer productos. Vista previa: ${preview || '(vacía)'}`);
        }

        return this.extractProductsWithAI(cleanText);
    }

    private async parsePdf(buffer: Buffer): Promise<{ text: string; metadata: any }> {
        const parser = new PDFParse(new Uint8Array(buffer));
        const data = await parser.getText();
        const pdfData = data as any;

        return {
            text: pdfData.text || '',
            metadata: {
                numpages: pdfData.numpages,
                numrender: pdfData.numrender,
                info: pdfData.info,
                metadata: pdfData.metadata,
            },
        };
    }

    private async parsePdfWithOcr(buffer: Buffer): Promise<string> {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parser-ocr-'));
        const tempPdfPath = path.join(tempDir, 'input.pdf');
        const pythonScript = String.raw`
import os
import sys
import subprocess
import fitz

pdf_path, output_dir = sys.argv[1], sys.argv[2]
doc = fitz.open(pdf_path)
texts = []
for index, page in enumerate(doc, start=1):
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    image_path = os.path.join(output_dir, f'page_{index}.png')
    pix.save(image_path)
    result = subprocess.run(['tesseract', image_path, 'stdout', '--psm', '6'], capture_output=True, text=True)
    if result.returncode == 0 and result.stdout.strip():
        texts.append(result.stdout.strip())

print('\n\n'.join(texts))
`;

        try {
            await fs.writeFile(tempPdfPath, buffer);
            const { stdout } = await this.runPythonScript(pythonScript, [tempPdfPath, tempDir]);
            return stdout.trim();
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
        }
    }

    private async parseImageWithOcr(buffer: Buffer, extension: string): Promise<string> {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parser-image-ocr-'));
        const tempImagePath = path.join(tempDir, `input.${extension}`);
        const pythonScript = String.raw`
import os
import sys
import subprocess
from PIL import Image

image_path, output_dir = sys.argv[1], sys.argv[2]
image = Image.open(image_path).convert('RGB')
ocr_path = os.path.join(output_dir, 'ocr.png')
image.save(ocr_path)
result = subprocess.run(['tesseract', ocr_path, 'stdout', '--psm', '6'], capture_output=True, text=True)
print(result.stdout if result.returncode == 0 else '')
`;

        try {
            await fs.writeFile(tempImagePath, buffer);
            const { stdout } = await this.runPythonScript(pythonScript, [tempImagePath, tempDir]);
            return stdout.trim();
        } finally {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
        }
    }

    private runPythonScript(script: string, args: string[] = []): Promise<{ stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            execFile('python3', ['-c', script, ...args], { encoding: 'utf8' }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(stderr || error.message));
                    return;
                }
                resolve({ stdout, stderr });
            });
        });
    }

    private async parseExcel(buffer: Buffer): Promise<string> {
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        let text = '';
        workbook.SheetNames.forEach((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            text += xlsx.utils.sheet_to_csv(sheet) + '\n';
        });
        return text;
    }

    private async parseWord(buffer: Buffer): Promise<string> {
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
    }

    private getTextPreview(text: string, maxLength = 600): string {
        if (!text) return '(vacía)';
        const normalized = text.replace(/\s+/g, ' ').trim();
        if (normalized.length <= maxLength) return normalized;
        return `${normalized.slice(0, maxLength)}...`;
    }

    private async extractProductsWithAI(text: string): Promise<any> {
        const prompt = `
      Eres un experto en extracción de datos de menús de restaurante. 
      Analiza el siguiente texto extraído de un documento y devuelve un objeto JSON que contenga una lista de categorías y productos.
      
      Reglas de extracción:
      1. Identifica las CATEGORÍAS (títulos o secciones como "Entradas", "Platos Fuertes", "Bebidas", etc.).
      2. Para cada PRODUCTO, extrae: Nombre, Descripción, Precio.
      3. Asocia cada producto con el nombre de la CATEGORÍA donde se encuentra.
      4. Si algún dato falta (como descripción o precio), usa "NO ADQUIRIDO" para texto o 0 para números.
      5. Asegúrate de capturar por lo menos el NOMBRE de cada producto.
      
      Debes devolver OBLIGATORIAMENTE un objeto JSON con la siguiente estructura:
      {
        "categories": ["Nombre de Categoría 1", "Nombre de Categoría 2"],
        "products": [
          {
            "name": "Nombre del producto",
            "description": "Descripción o NO ADQUIRIDO",
            "price": 12000,
            "categoryName": "Nombre de Categoría 1"
          }
        ]
      }
      
      Texto a analizar:
      ${text.substring(0, 6000)} 
    `;

        console.log(`[ParserService] AI prompt length: ${prompt.length} chars`);
        console.log(`[ParserService] AI input preview: ${this.getTextPreview(text, 1200)}`);

        try {
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Eres un extractor de datos de menús preciso que organiza productos por categorías y siempre responde en formato JSON.' },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' }
            });

            const content = completion.choices[0].message.content;
            console.log(`[ParserService] AI Raw response:`, content);

            let parsed: any = {};
            try {
                parsed = JSON.parse(content || '{}');
            } catch (parseError) {
                console.error('[ParserService] AI response was not valid JSON:', content);
                throw new Error(`La respuesta de la IA no era JSON válido: ${parseError.message}`);
            }

            if (parsed.products && Array.isArray(parsed.products)) {
                console.log(`[ParserService] Extracted ${parsed.products.length} products and ${parsed.categories?.length || 0} categories`);
                return {
                    categories: parsed.categories || [],
                    products: parsed.products
                };
            } else {
                console.warn('[ParserService] AI response did not contain expected structure:', content);
                return { categories: [], products: [] };
            }
        } catch (e) {
            console.error('[ParserService] Error in AI extraction or parsing:', e);
            throw new Error(`Error en la extracción con IA: ${e.message}`);
        }
    }
}
