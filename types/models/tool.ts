export interface Tool {
    id: string;
    name: string;
    description: string;
    type: string;
    category: string;
    inputSchema: any;
    outputSchema: any;
    config: {
        name: string;
        description: string;
        value?: string; // the exulu variable reference
    }[];
}
