"use client"

import { Bot } from "lucide-react";

export default function SessionSelectPage() {
  return (
    <div className="w-full h-full flex">
      <div className="flex flex-col w-full m-auto">
        <div className="mx-auto"><Bot className="h-20 w-20" /></div>
        <h2 className="text-center">Select a session.</h2>
        <small className="text-center">Bleep bleep bloop...</small>
      </div>
    </div>
  )
}