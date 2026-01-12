import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ParserService } from './services/parser.service';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';

@ApiTags('ai-import')
@Controller('ai-import')
export class AIImportController {
    constructor(private readonly parserService: ParserService) { }

    @Post('extract-products')
    @ApiOperation({ summary: 'Extract products from a document (PDF, Excel, Word)' })
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
}
