"use client";

import { Bold, Italic, Underline } from "lucide-react";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Rating(props: { callback: any }) {
  const [isAnimated, setIsAnimated] = useState([false, false, false]);

  return (
    <ToggleGroup size={"lg"} type="single">
      <TooltipProvider>
        <Tooltip delayDuration={100}>
          <TooltipTrigger>
            <ToggleGroupItem
              className="hover:scale-[1.4] transition duration-300 ease-in-out px-1 md:px-3 lg:px-3"
              onClick={() => {
                props.callback(0);
              }}
              onMouseEnter={() => {
                const newState = [...isAnimated];
                newState[0] = true;
                setIsAnimated(newState);
              }}
              onMouseLeave={() => {
                const newState = [...isAnimated];
                newState[0] = false;
                setIsAnimated(newState);
              }}
              value="no"
              aria-label="Toggle no"
            >
              {isAnimated[0] ? (
                <img
                  src="/emojis/animated/Anxious%20Face%20with%20Sweat.png"
                  alt="No"
                  width="40"
                  height="40"
                />
              ) : (
                <img
                  src="/emojis/stale/Anxious%20Face%20with%20Sweat.png"
                  alt="No"
                  width="40"
                  height="40"
                />
              )}
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            <p>No thanks</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <TooltipProvider>
        <Tooltip delayDuration={100}>
          <TooltipTrigger>
            <ToggleGroupItem
              className="hover:scale-[1.4] transition duration-300 ease-in-out px-1 md:px-3 lg:px-3"
              onClick={() => {
                props.callback(1);
              }}
              onMouseEnter={() => {
                const newState = [...isAnimated];
                newState[1] = true;
                setIsAnimated(newState);
              }}
              onMouseLeave={() => {
                const newState = [...isAnimated];
                newState[1] = false;
                setIsAnimated(newState);
              }}
              value="maybe"
              aria-label="Toggle maybe"
            >
              {isAnimated[1] ? (
                <img
                  src="/emojis/animated/Unamused%20Face.png"
                  alt="Maybe"
                  width="40"
                  height="40"
                />
              ) : (
                <img
                  src="/emojis/stale/Unamused%20Face.png"
                  alt="Maybe"
                  width="40"
                  height="40"
                />
              )}
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            <p>Okay</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <TooltipProvider>
        <Tooltip delayDuration={100}>
          <TooltipTrigger>
            <ToggleGroupItem
              className="hover:scale-[1.4] transition duration-300 ease-in-out px-1 md:px-3 lg:px-3"
              onClick={() => {
                props.callback(2);
              }}
              onMouseEnter={() => {
                const newState = [...isAnimated];
                newState[2] = true;
                setIsAnimated(newState);
              }}
              onMouseLeave={() => {
                const newState = [...isAnimated];
                newState[2] = false;
                setIsAnimated(newState);
              }}
              value="yes"
              aria-label="Toggle yes"
            >
              {isAnimated[2] ? (
                <img
                  src="/emojis/animated/Smiling%20Face%20with%20Heart-Eyes.png"
                  alt="Yes"
                  width="40"
                  height="40"
                />
              ) : (
                <img
                  src="/emojis/stale/Smiling%20Face%20with%20Heart-Eyes.png"
                  alt="Yes"
                  width="40"
                  height="40"
                />
              )}
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            <p>Love it</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <TooltipProvider>
        <Tooltip delayDuration={100}>
          <TooltipTrigger>
            <ToggleGroupItem
              className="hover:scale-[1.4] transition duration-300 ease-in-out px-1 md:px-3 lg:px-3"
              onClick={() => {
                props.callback(3);
              }}
              onMouseEnter={() => {
                const newState = [...isAnimated];
                newState[3] = true;
                setIsAnimated(newState);
              }}
              onMouseLeave={() => {
                const newState = [...isAnimated];
                newState[3] = false;
                setIsAnimated(newState);
              }}
              value="omg"
              aria-label="Toggle omg"
            >
              {isAnimated[3] ? (
                <img
                  src="/emojis/animated/Drooling%20Face.png"
                  alt="omg"
                  width="40"
                  height="40"
                />
              ) : (
                <img
                  src="/emojis/stale/Drooling%20Face.png"
                  alt="omg"
                  width="40"
                  height="40"
                />
              )}
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>
            <p>I almost came just thinking about it</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </ToggleGroup>
  );
}
