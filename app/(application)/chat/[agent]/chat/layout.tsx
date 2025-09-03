"use client"

import * as React from "react";

export default function ChatLayout({ children, params }: { children: React.ReactNode; params: { agent: string, session?: string } }) {

  return (
    <>
      {children}
    </>
  );
}
