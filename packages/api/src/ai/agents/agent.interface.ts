export interface AgentResponse {
    content: string;
    suggestedNextStep?: string;
    metadata?: any;
}

export interface IAgent {
    readonly name: string;
    readonly description: string;

    canHandle(input: string, context?: any): Promise<boolean>;
    process(input: string, context?: any): Promise<AgentResponse>;
}
