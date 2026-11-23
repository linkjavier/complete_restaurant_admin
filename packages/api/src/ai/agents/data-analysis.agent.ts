import { Injectable } from '@nestjs/common';
import { IAgent, AgentResponse } from './agent.interface';
import { OrdersService } from '../../orders/orders.service';

@Injectable()
export class DataAnalysisAgent implements IAgent {
    readonly name = 'DataAnalysisAgent';
    readonly description = 'Experto en análisis de datos y reportes de ventas.';

    constructor(private readonly ordersService: OrdersService) { }

    async canHandle(input: string, context?: any): Promise<boolean> {
        const text = input.toLowerCase();
        return text.includes('ventas') || text.includes('reporte') || text.includes('cuanto hemos vendido') || text.includes('analisis');
    }

    async process(input: string, context?: any): Promise<AgentResponse> {
        // Por ahora simulamos un reporte rápido, se puede expandir con lógica real de OrdersService
        return {
            content: 'Estoy analizando las ventas recientes... 📊 Actualmente el producto más vendido es el *Almuerzo Ejecutivo*. En el día de hoy llevamos un crecimiento del 15% respecto a ayer.',
            metadata: { type: 'sales_summary' }
        };
    }
}
