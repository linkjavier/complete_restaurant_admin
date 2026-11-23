import { Injectable } from '@nestjs/common';
import { IAgent, AgentResponse } from '../agents/agent.interface';
import { BreakfastAgent } from '../agents/breakfast.agent';
import { LunchAgent } from '../agents/lunch.agent';
import { DataAnalysisAgent } from '../agents/data-analysis.agent';
import { CustomAgent } from '../agents/custom.agent';

@Injectable()
export class CoordinatorService {
    private agents: IAgent[];

    constructor(
        private readonly breakfastAgent: BreakfastAgent,
        private readonly lunchAgent: LunchAgent,
        private readonly dataAnalysisAgent: DataAnalysisAgent,
        private readonly customAgent: CustomAgent,
    ) {
        this.agents = [breakfastAgent, lunchAgent, dataAnalysisAgent, customAgent];
    }

    async delegate(input: string, context: any): Promise<AgentResponse> {
        console.log(`[Coordinator] Delegating input: "${input.substring(0, 50)}..."`);

        // Find the first agent that can handle the input
        for (const agent of this.agents) {
            if (await agent.canHandle(input, context)) {
                console.log(`[Coordinator] Delegated to: ${agent.name}`);
                return await agent.process(input, context);
            }
        }

        // Default to CustomAgent if no one handles it
        console.log(`[Coordinator] No specialist found, delegating to CustomAgent`);
        return await this.customAgent.process(input, context);
    }

    // Facilitar comunicación entre agentes (opcional para el futuro)
    async communicateBetweenAgents(from: IAgent, to: IAgent, message: string): Promise<any> {
        console.log(`[Coordinator] Communication from ${from.name} to ${to.name}: ${message}`);
        // Aquí podrías implementar una lógica más compleja de paso de mensajes
    }
}
