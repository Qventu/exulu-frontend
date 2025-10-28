"use client";

import { Agent } from "@/types/models/agent";
import * as agentIdle from "../public/agent-idle.json";
import * as agentResponding from "../public/agent-responding.json";
import { useLottie } from "lottie-react";
import { useQuery } from "@tanstack/react-query";
import { getPresignedUrl } from "./uppy-dashboard";
import { cn } from "@/lib/utils";

const AgentVisual = ({ agent, status, className }: { agent: Agent, status: 'submitted' | 'streaming' | 'ready' | 'error', className?: string }) => {

  // Check if agent has custom animations
  const hasCustomAnimations = agent.animation_idle || agent.animation_responding;

  if (!hasCustomAnimations && !agentIdle && agent.image) {
    return <img
      src={agent.image}
      alt={`${agent.name} agent`}
      className="w-[100px] h-[100px] object-cover rounded-full mx-auto my-3"
    />
  }

  if (!hasCustomAnimations && !agentIdle) {
    return <div className="text-3xl font-bold text-primary text-center">
      {agent.name?.charAt(0).toUpperCase() || 'A'}
    </div>
  }

  return <LottieVisual className={className} agent={agent} status={status} />

};

const LottieVisual = ({ agent, status, className }: { agent: Agent, status: 'submitted' | 'streaming' | 'ready' | 'error', className?: string }) => {
  // Fetch custom animation data if available
  const { data: customIdleData } = useQuery({
    queryKey: ['customAnimation', agent.animation_idle],
    queryFn: async () => {
      if (!agent.animation_idle) return null;
      const url = await getPresignedUrl(agent.animation_idle);
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!agent.animation_idle,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { data: customRespondingData } = useQuery({
    queryKey: ['customAnimation', agent.animation_responding],
    queryFn: async () => {
      if (!agent.animation_responding) return null;
      const url = await getPresignedUrl(agent.animation_responding);
      const response = await fetch(url);
      return response.json();
    },
    enabled: !!agent.animation_responding,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Map status to animation configuration
  const getAnimationOptions = () => {
    switch (status) {
      case 'submitted':
        return {
          animationData: customIdleData || agentIdle,
          loop: true,
          autoplay: true,
        };
      case 'streaming':
        return {
          animationData: customRespondingData || customIdleData || agentResponding || agentIdle,
          loop: true,
          autoplay: true,
        };
      case 'ready':
        return {
          animationData: customIdleData || agentIdle,
          loop: true,
          autoplay: true,
        };
      case 'error':
        return {
          animationData: customIdleData || agentIdle,
          loop: true,
          autoplay: true,
        };
      default:
        return {
          animationData: customIdleData || agentIdle,
          loop: true,
          autoplay: true,
        };
    }
  };

  const { View } = useLottie(getAnimationOptions());

  return (
    <>
      <div className="">
        <div className={className}>{View}</div>
      </div>
    </>
  );
}

export default AgentVisual;