"use client";

import { PaperPlaneIcon, StopIcon } from "@radix-ui/react-icons";
import { AnimatePresence, motion } from "framer-motion";
import React, { useContext } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { UserContext } from "@/app/(application)/authenticated";
import { Button } from "@/components/ui/button";
import { ChatProps } from "../[session]/chat";

export default function ChatBottombar({
                                        agentId,
  messages,
  input,
  onFilesSelected,
  handleInputChange,
  handleSubmit,
  isLoading,
  error,
  stop,
}: ChatProps) {
  const [isMobile, setIsMobile] = React.useState(false);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const { user, setUser } = useContext(UserContext);

  React.useEffect(() => {
    const checkScreenWidth = () => {
      setIsMobile(window.innerWidth <= 768);
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (handleSubmit) {
        handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
      }
    }
  };

  return (
    <div className="pr-4 flex justify-between w-full items-center gap-2">
      <AnimatePresence initial={false}>
        <motion.div
          key="input"
          className="w-full relative mb-2 items-center"
          layout
          initial={{ opacity: 0, scale: 1 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1 }}
          transition={{
            opacity: { duration: 0.05 },
            layout: {
              type: "spring",
              bounce: 0.15,
            },
          }}
        >
          <form
            onSubmit={handleSubmit}
            className="w-full items-center flex relative gap-2"
          >
            {/*{agent?.extensions?.length ? (
              <div className="flex">
                <FileUpload
                  splice={10}
                  onSelect={(file) => {
                    setFile(file);
                    onFilesSelected([file]);
                  }}
                  extensions={agent?.extensions}
                  collection={"files"}
                  metaData={{
                    userEmail: user.email,
                    userId: user.id,
                    query: [],
                  }}
                />
              </div>
            ) : null}*/}

            <TextareaAutosize
              autoComplete="off"
              autoFocus={true}
              value={input}
              ref={inputRef}
              onKeyDown={handleKeyPress}
              onChange={handleInputChange}
              name="message"
              placeholder={`Ask me anything...`}
              className="border-input max-h-20 px-5 py-4 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-full border rounded flex items-center h-14 resize-none overflow-hidden dark:bg-card/35"
            />
            {!isLoading ? (
              <Button
                className="shrink-0"
                variant="secondary"
                size="icon"
                disabled={isLoading || !input?.trim()}
              >
                <PaperPlaneIcon className=" size-6 text-muted-foreground" />
              </Button>
            ) : (
              <Button
                className="shrink-0"
                variant="secondary"
                size="icon"
                onClick={stop}
              >
                <StopIcon className="size-6 text-muted-foreground" />
              </Button>
            )}
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
