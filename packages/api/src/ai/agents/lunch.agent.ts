import { Injectable } from '@nestjs/common';
import { IAgent, AgentResponse } from './agent.interface';
import { ProductsService } from '../../products/products.service';

@Injectable()
export class LunchAgent implements IAgent {
    readonly name = 'LunchAgent';
    readonly description = 'Experto en almuerzos y platos del día.';

    constructor(private readonly productsService: ProductsService) { }

    async canHandle(input: string, context?: any): Promise<boolean> {
        const text = input.toLowerCase();
        return text.includes('almuerzo') || text.includes('tarde') || text.includes('ejecutivo') || text.includes('corrientazo');
    }

    async process(input: string, context?: any): Promise<AgentResponse> {
        const { locationId, tenantId } = context;
        const menu = await this.productsService.findAll({ locationId, tenantId });
        const lunchProducts = menu.filter(p =>
            p.category?.name.toLowerCase().includes('almuerzo') ||
            p.description?.toLowerCase().includes('almuerzo')
        );

        if (lunchProducts.length === 0) {
            return {
                content: 'Hoy no tenemos almuerzos ejecutivos programados, pero puedes ver nuestra carta general. 🍲',
            };
        }

        const options = lunchProducts.map(p => `• *${p.name}*: $${p.price.toLocaleString()}`).join('\n');
        return {
            content: `Hoy para el almuerzo tenemos estas delicias: 🍛🍲\n\n${options}\n\n¿Cuál te provoca hoy?`,
        };
    }
}
