"use client";

import { Agent } from "@/types/models/agent";
import { useLottie } from "lottie-react";
import { useQuery } from "@tanstack/react-query";
import { getPresignedUrl } from "./uppy-dashboard";

const AgentVisual = ({ agent, status, className }: { agent: Agent, status: 'submitted' | 'streaming' | 'ready' | 'error', className?: string }) => {
  return <LottieVisual className={className} agent={agent} status={status} />
};

const LottieVisual = ({ agent, status, className }: { agent: Agent, status: 'submitted' | 'streaming' | 'ready' | 'error', className?: string }) => {

  const { data: defaultIdleData } = useQuery({
    queryKey: ['defaultAnimation', 'idle'],
    queryFn: async () => {
      const response = await fetch("/agent-idle.json");
      return response.json();
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    enabled: !agent.animation_idle,
  });

  const { data: defaultRespondingData } = useQuery({
    queryKey: ['defaultAnimation', 'responding'],
    queryFn: async () => {
      const response = await fetch("/agent-responding.json");
      return response.json();
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    enabled: !agent.animation_responding,
  });

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
          animationData: customIdleData || defaultIdleData,
          loop: true,
          autoplay: true,
        };
      case 'streaming':
        return {
          animationData: customRespondingData || defaultRespondingData,
          loop: true,
          autoplay: true,
        };
      case 'ready':
        return {
          animationData: customIdleData || defaultIdleData,
          loop: true,
          autoplay: true,
        };
      case 'error':
        return {
          animationData: customIdleData || defaultIdleData,
          loop: true,
          autoplay: true,
        };
      default:
        return {
          animationData: customIdleData || defaultIdleData,
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