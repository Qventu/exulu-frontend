"use client";

import { Agent } from "@/types/models/agent";
import * as agentIdle from "../public/agent-idle.json";
import * as agentResponding from "../public/agent-responding.json";
import { useLottie } from "lottie-react";

const AgentVisual = ({ agent, status }: { agent: Agent, status: 'submitted' | 'streaming' | 'ready' | 'error' }) => {

  if (!agentIdle && agent.image) {
    return <img
      src={agent.image}
      alt={`${agent.name} agent`}
      className="w-[100px] h-[100px] object-cover rounded-full mx-auto my-3"
    />
  }

  if (!agentIdle) {
    return <div className="text-3xl font-bold text-primary text-center">
      {agent.name?.charAt(0).toUpperCase() || 'A'}
    </div>
  }

  return <LottieVisual agent={agent} status={status} />

};

const LottieVisual = ({ agent, status }: { agent: Agent, status: 'submitted' | 'streaming' | 'ready' | 'error' }) => {
  // Map status to animation configuration
  const getAnimationOptions = () => {
    switch (status) {
      case 'submitted':
        return {
          animationData: agentIdle,
          loop: true,
          autoplay: true,
        };
      case 'streaming':
        return {
          animationData: agentResponding || agentIdle,
          loop: true,
          autoplay: true,
        };
      case 'ready':
        return {

          animationData: agentIdle,
          loop: true,
          autoplay: true,
        };
      case 'error':
        return {
          animationData: agentIdle,
          loop: true,
          autoplay: true,
        };
      default:
        return {
          animationData: agentIdle,
          loop: true,
          autoplay: true,
        };
    }
  };

  const { View } = useLottie(getAnimationOptions());

  return (
    <>
      <div className="">
        <div className="w-80">{View}</div>
      </div>
    </>
  );
}

export default AgentVisual;