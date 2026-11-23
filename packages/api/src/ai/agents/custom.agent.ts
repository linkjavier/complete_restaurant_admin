import { Injectable } from '@nestjs/common';
import { IAgent, AgentResponse } from './agent.interface';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CustomAgent implements IAgent {
    readonly name = 'CustomAgent';
    readonly description = 'Agente versátil para tareas personalizadas e instrucciones manuales.';
    private openai: OpenAI;

    constructor(private readonly configService: ConfigService) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        this.openai = new OpenAI({ apiKey });
    }

    async canHandle(input: string, context?: any): Promise<boolean> {
        // Este agente es el fallback o se activa con palabras clave de "ayuda" o "haz esto"
        const text = input.toLowerCase();
        return text.includes('ayuda') || text.includes('especial') || text.includes('puedes');
    }

    async process(input: string, context?: any): Promise<AgentResponse> {
        const completion = await this.openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Eres un asistente de restaurante muy servicial. Ayuda al usuario con su solicitud personalizada.' },
                { role: 'user', content: input }
            ]
        });

        return {
            content: completion.choices[0].message.content || '¿En qué más puedo ayudarte? 😊',
        };
    }
}
