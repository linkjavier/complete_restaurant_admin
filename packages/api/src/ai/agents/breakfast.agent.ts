import { Injectable } from '@nestjs/common';
import { IAgent, AgentResponse } from './agent.interface';
import { ProductsService } from '../../products/products.service';
import { MenuHandlerService } from '../services/menu-handler.service';

@Injectable()
export class BreakfastAgent implements IAgent {
    readonly name = 'BreakfastAgent';
    readonly description = 'Experto en desayunos y opciones de la mañana.';

    constructor(
        private readonly productsService: ProductsService,
        private readonly menuHandler: MenuHandlerService,
    ) { }

    async canHandle(input: string, context?: any): Promise<boolean> {
        const text = input.toLowerCase();
        return text.includes('desayuno') || text.includes('mañana') || text.includes('huevos') || text.includes('calentado');
    }

    async process(input: string, context?: any): Promise<AgentResponse> {
        const { locationId, tenantId } = context;
        // Lógica específica para buscar desayunos
        const menu = await this.productsService.findAll({ locationId, tenantId });
        const breakfastProducts = menu.filter(p =>
            p.category?.name.toLowerCase().includes('desayuno') ||
            p.description?.toLowerCase().includes('desayuno')
        );

        if (breakfastProducts.length === 0) {
            return {
                content: 'Lo siento, no encontré opciones de desayuno disponibles en este momento. 🍳',
            };
        }

        const options = breakfastProducts.map(p => `• *${p.name}*: $${p.price.toLocaleString()}`).join('\n');
        return {
            content: `¡Claro que sí! Aquí tienes nuestras opciones de desayuno: ☕🍳\n\n${options}\n\n¿Te gustaría pedir alguno?`,
        };
    }
}
