"use client";

import { useMutation } from "@apollo/client";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useContext, useState } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import { AgentSelector } from "@/app/(application)/agents/components/agent-selector";
import { CreateNewAgent } from "@/app/(application)/agents/components/create-new-agent";
import { CREATE_AGENT } from "@/queries/queries";
import Image from "next/image";

export const dynamic = "force-dynamic";

export default function ChatsPage() {
  const router = useRouter();
  const { user, setUser } = useContext(UserContext);
  const [company, setCompany] = useState<any>(user.company);

  const [createAgent, createAgentResult] = useMutation(
      CREATE_AGENT,
    {
      onCompleted: (data: {
        agentsCreateOne: {  id: string, type: "chat" };
      }) => {
        console.log(data);
        router.push(`/agents/edit/${data?.agentsCreateOne?.id}`, {
          scroll: false,
        });
      },
    },
  );

  return (
      <>
        <div className="w-full h-full lg:grid lg:grid-cols-2">
          <div className="flex items-center justify-center py-12">
            <div className="mx-auto grid w-[350px] gap-2">
              <div className="grid gap-2">
                <h1 className="text-3xl font-bold">Agents</h1>
                <p className="text-balance text-muted-foreground">
                  Select or create a new agent
                </p>
              </div>
              <div className="grid gap-4">
                <div className="ml-auto flex w-full space-x-2 sm:justify-end">
                  <AgentSelector navigate={true}/>
                  <CreateNewAgent
                      company={company}
                      createAgent={createAgent}
                      createAgentResult={createAgentResult}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="bg-muted">
            <Image
                src="/assets/exulu_background_01.png"
                alt="Image"
                width="1920"
                height="1080"
                className="size-full object-cover"
            />
          </div>
        </div>
      </>
  );
}
