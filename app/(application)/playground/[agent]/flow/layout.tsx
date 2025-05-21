"use client"
import * as React from "react";
import { FlowSessionsComponent } from "./flow-sessions";

export default function FlowLayout({ children, params }: { children: React.ReactNode; params: { agent: string } }) {

  return (
    <>
    <FlowSessionsComponent agent={params.agent} type={"flow"}/>
    {children}
    </>
  );
}
