import { Injectable } from '@nestjs/common';
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
        const extension = file.originalname.split('.').pop()?.toLowerCase();
        console.log(`[ParserService] Parsing file: ${file.originalname} (${file.mimetype})`);

        try {
            switch (extension) {
                case 'pdf':
                    text = await this.parsePdf(file.buffer);
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
                    throw new Error(`Formato de archivo no soportado: ${extension}`);
            }
        } catch (error) {
            console.error(`[ParserService] Error parsing ${extension} file:`, error);
            throw new Error(`Error al leer el archivo ${extension}: ${error.message}`);
        }

        if (!text || text.trim().length < 5) {
            console.warn('[ParserService] Extracted text is too short or empty');
            throw new Error('El documento no contiene suficiente texto legible para extraer productos');
        }

        console.log(`[ParserService] Extracted ${text.length} characters. Proceeding with AI extraction.`);
        return this.extractProductsWithAI(text);
    }

    private async parsePdf(buffer: Buffer): Promise<string> {
        const parser = new PDFParse(new Uint8Array(buffer));
        const data = await parser.getText();
        return data.text || '';
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
            const parsed = JSON.parse(content || '{}');

            console.log(`[ParserService] AI Raw response:`, content);

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
