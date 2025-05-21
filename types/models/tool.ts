export interface Tool {
    id: string;
    name: string;
    description: string;
    type: string;
    inputSchema: any;
    outputSchema: any;
}
