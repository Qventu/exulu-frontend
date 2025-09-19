"use client";

import {
  Card,
  CardHeader,
} from "@/components/ui/card";
import { CreateNewAgent } from "./create-new-agent";

interface CreateNewAgentCardProps {
  createAgent: any;
  createAgentResult: any;
  company: any;
}

export function CreateNewAgentCard({ createAgent, createAgentResult, company }: CreateNewAgentCardProps) {
  return (
    <CreateNewAgent
      createAgent={createAgent}
      createAgentResult={createAgentResult}
      company={company}
    >
      <Card className="cursor-pointer hover:shadow-md transition-shadow duration-200 h-full flex flex-col border-dashed border-2 hover:border-primary/50">
        <CardHeader className="pb-3 h-full">
          <div className="w-full h-full rounded-lg flex items-center justify-center mb-4 flex-col">
            <div className="text-center text-muted-foreground">
              <p className="text-lg">Create New Agent</p>
            </div>
          </div>
        </CardHeader>
      </Card>
    </CreateNewAgent>
  );
}