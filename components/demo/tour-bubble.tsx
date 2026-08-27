"use client";

import { useState } from "react";
import { useTour } from "./tour-provider";

export function TourBubble() {
  const { chapters, position, step, next, prev, jumpTo } = useTour();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border bg-background p-4 shadow-lg">
      <button className="text-sm font-medium" onClick={() => setOpen((o) => !o)}>
        Tour {open ? "▾" : "▸"}
      </button>

      {open && (
        <ul className="mt-3 space-y-1">
          {chapters.map((c, i) => (
            <li key={c.id}>
              <button
                className={c.id === position.chapter ? "font-semibold" : "opacity-70"}
                onClick={() => {
                  jumpTo(c.id);
                  setOpen(false);
                }}
              >
                {i + 1}. {c.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      {step && (
        <div className="mt-3">
          <p className="font-medium">{step.title}</p>
          <p className="mt-1 text-sm opacity-80">{step.body}</p>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button onClick={prev}>Back</button>
        <button onClick={next}>Next</button>
      </div>
    </div>
  );
}
