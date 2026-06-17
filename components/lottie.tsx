"use client";

import { Agent } from "@/types/models/agent";
import { useLottie } from "lottie-react";
import { useEffect, useState } from "react";
import { getPresignedUrl } from "./primitives/file-picker";

const AgentVisual = ({ agent, status, className }: { agent: Agent, status: 'submitted' | 'streaming' | 'ready' | 'error', className?: string }) => {
  return <LottieVisual className={className} agent={agent} status={status} />
};

// Module-level cache so animation JSON is fetched once per TTL across all
// instances (this component renders per chat message).
const animationCache: { [key: string]: { promise: Promise<any>; expiresAt: number } } = {};

const fetchAnimationJson = (cacheKey: string, ttlMs: number, fetcher: () => Promise<any>): Promise<any> => {
  const cached = animationCache[cacheKey];
  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise;
  }
  const promise = fetcher().catch((error) => {
    // Don't cache failures
    delete animationCache[cacheKey];
    throw error;
  });
  animationCache[cacheKey] = { promise, expiresAt: Date.now() + ttlMs };
  return promise;
};

const useAnimationData = (cacheKey: string | null, ttlMs: number, fetcher: () => Promise<any>) => {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!cacheKey) {
      setData(null);
      return;
    }
    let cancelled = false;
    fetchAnimationJson(cacheKey, ttlMs, fetcher)
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((error) => {
        console.error("Failed to load animation data", error);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return data;
};

const LottieVisual = ({ agent, status, className }: { agent: Agent, status: 'submitted' | 'streaming' | 'ready' | 'error', className?: string }) => {

  const defaultIdleData = useAnimationData(
    !agent.animation_idle ? "default:idle" : null,
    60 * 60 * 1000, // 1 hour
    async () => {
      const response = await fetch("/agent-idle.json");
      return response.json();
    },
  );

  const defaultRespondingData = useAnimationData(
    !agent.animation_responding ? "default:responding" : null,
    60 * 60 * 1000, // 1 hour
    async () => {
      const response = await fetch("/agent-responding.json");
      return response.json();
    },
  );

  // Fetch custom animation data if available
  const customIdleData = useAnimationData(
    agent.animation_idle ? `custom:${agent.animation_idle}` : null,
    5 * 60 * 1000, // 5 minutes
    async () => {
      if (!agent.animation_idle) return null;
      const url = await getPresignedUrl(agent.animation_idle);
      const response = await fetch(url);
      return response.json();
    },
  );

  const customRespondingData = useAnimationData(
    agent.animation_responding ? `custom:${agent.animation_responding}` : null,
    5 * 60 * 1000, // 5 minutes
    async () => {
      if (!agent.animation_responding) return null;
      const url = await getPresignedUrl(agent.animation_responding);
      const response = await fetch(url);
      return response.json();
    },
  );

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
