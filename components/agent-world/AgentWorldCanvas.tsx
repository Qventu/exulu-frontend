"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@apollo/client";
import { useTheme } from "next-themes";
import { AgentWorld, extractLogoColor } from "@/lib/agent-world/engine";
import { AGENT_WORLD_AGENTS } from "@/queries/queries";

export function AgentWorldCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<AgentWorld | null>(null);

  const { resolvedTheme } = useTheme();

  const { data } = useQuery(AGENT_WORLD_AGENTS, {
    pollInterval: 5000,
    fetchPolicy: "no-cache",
  });

  // Init engine once on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const world = new AgentWorld(canvas);
    worldRef.current = world;

    const logoSrc =
      resolvedTheme === "dark" ? "/exulu_dark.png" : "/exulu_light.png";

    world.init("/agent-world").then(async () => {
      const color = await extractLogoColor(logoSrc);
      world.setLogoColor(color.h, color.s);
    });

    return () => {
      world.destroy();
      worldRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize canvas to fill container
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);
    return () => ro.disconnect();
  }, []);

  // Sync polling data to world state
  useEffect(() => {
    const world = worldRef.current;
    if (!world || !data?.agentWorldAgents) return;
    world.syncAgents(data.agentWorldAgents);
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      className="block w-full h-full"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
