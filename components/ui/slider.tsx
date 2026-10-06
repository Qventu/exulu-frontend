"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn } from "@/lib/utils";

type ThumbProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Thumb>;

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    /**
     * Per-thumb props, by position. A range slider needs them: Radix names an
     * unlabelled thumb from a hardcoded English ["Minimum", "Maximum"] and
     * announces the raw value, so a date range read out as
     * "Minimum, 1786752000000" on a German page. aria-label and
     * aria-valuetext belong on the thumb, not on Root, which renders a
     * role-less element the name never reaches.
     */
    thumbProps?: ThumbProps[];
  }
>(({ className, thumbProps, ...props }, ref) => {
  // One thumb per value: Radix pairs thumbs to values by position, so a range
  // slider given two values and one thumb silently renders half a control.
  // Falls back to a single thumb, which is what every uncontrolled and
  // single-value use of this component already gets.
  const thumbs = props.value ?? props.defaultValue ?? [0];
  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-primary/20">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {thumbs.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="block size-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          {...thumbProps?.[index]}
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
