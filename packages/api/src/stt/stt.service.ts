import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class STTService {
  private readonly logger = new Logger(STTService.name);
  private openai: OpenAI;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required');
    }
    
    this.openai = new OpenAI({
      apiKey,
    });
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType = 'audio/webm'): Promise<string> {
    let tempFilePath: string | undefined;
    try {
      const tempDir = os.tmpdir();
      const extensionByMimeType: Record<string, string> = {
        'audio/ogg': 'ogg',
        'audio/oga': 'oga',
        'audio/mp4': 'm4a',
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
        'audio/webm': 'webm',
      };
      const normalizedMimeType = mimeType.split(';')[0].trim().toLowerCase();
      const extension = extensionByMimeType[normalizedMimeType];
      if (!extension) {
        throw new Error(`Unsupported audio MIME type: ${mimeType}`);
      }

      tempFilePath = path.join(tempDir, `voice-note-${Date.now()}.${extension}`);
      await fs.promises.writeFile(tempFilePath, audioBuffer);
      const fileStream = fs.createReadStream(tempFilePath);
      const transcription = await this.openai.audio.transcriptions.create({
        file: fileStream,
        model: 'whisper-1',
        language: 'es', // Assuming Spanish language
      });
      return transcription.text;
    } catch (error) {
      this.logger.error(
        `Error transcribing audio: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      if (tempFilePath) {
        await fs.promises.unlink(tempFilePath).catch((cleanupError) => {
          this.logger.warn(
            `Unable to remove temporary audio file: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          );
        });
      }
    }
  }
} 