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

  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      // Create a temporary file to store the audio
      const tempDir = os.tmpdir();
      const tempFilePath = path.join(tempDir, `voice-note-${Date.now()}.ogg`);
      
      // Write the buffer to a temporary file
      await fs.promises.writeFile(tempFilePath, audioBuffer);

      // Create a file object for OpenAI
      const file = await fs.promises.readFile(tempFilePath);
      const audioFile = new File([file], 'voice-note.ogg', { type: 'audio/ogg' });

      // Transcribe the audio using Whisper
      const transcription = await this.openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'es', // Assuming Spanish language
      });

      // Clean up the temporary file
      await fs.promises.unlink(tempFilePath);

      return transcription.text;
    } catch (error) {
      this.logger.error(`Error transcribing audio: ${error.message}`);
      throw error;
    }
  }
} 