"use client"

import { Bot } from "lucide-react";
import { useEffect, useState } from "react";

export default function SessionSelectPage() {

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenWidth = () => {
      setIsMobile(window.innerWidth <= 1023);
    };

    // Initial check
    checkScreenWidth();

    // Event listener for screen width changes
    window.addEventListener("resize", checkScreenWidth);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener("resize", checkScreenWidth);
    };
  }, []);

  return (
    <div className="w-full h-full flex">
      <div className="flex flex-col w-full m-auto">
        <h2 className="text-center">Select or create a session.</h2>
      </div>
    </div>
  )
}