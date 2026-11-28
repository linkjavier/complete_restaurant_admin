import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParserService } from './services/parser.service';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('ai-import')
@Controller('ai-import')
export class AIImportController {
    constructor(private readonly parserService: ParserService) { }

    @Post('extract-products')
    @ApiOperation({ summary: 'Extract products from a document or image (PDF, Excel, Word, JPEG, PNG, WebP)' })
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
    @UseInterceptors(FileInterceptor('file'))
    async extractProducts(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('No se ha subido ningún archivo');
        }

        try {
            return await this.parserService.parseDocument(file);
        } catch (error) {
            throw new BadRequestException(`Error al procesar el documento: ${error.message}`);
        }
    }

    @Post('extract-purchase')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Extract purchase details from an invoice or receipt' })
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
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
    async extractPurchase(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('No se ha subido ningún archivo');
        }

        try {
            return await this.parserService.parsePurchaseDocument(file);
        } catch (error) {
            throw new BadRequestException(
                `Error al procesar el documento de compra: ${error instanceof Error ? error.message : 'Error desconocido'}`,
            );
        }
    }
}
