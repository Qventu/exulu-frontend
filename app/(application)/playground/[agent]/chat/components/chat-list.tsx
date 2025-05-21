import { motion } from "framer-motion";
import Image from "next/image";
import React, { useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ChatProps } from "@/app/(application)/playground/[agent]/chat/[session]/chat";
import CodeDisplayBlock from "@/components/custom/code-display-block";

export default function ChatList({
  messages,
  isLoading,
}: Omit<ChatProps, "onFilesSelected">) {
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (messages?.length === 0) {
    return (
      <div className="size-full flex justify-center items-center">
        <div className="flex flex-col gap-4 items-center">
          <Image
            src="/exulu_logo.svg"
            alt="AI"
            width={120}
            height={120}
            className="h-30 w-40 object-contain" /*invert dark:invert-0*/
          />
          <p className="text-center text-lg text-muted-foreground">
            How can I help you today?
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      id="scroller"
      className="size-full overflow-y-scroll overflow-x-hidden justify-end"
    >
      <div className="w-full flex flex-col overflow-hidden min-h-full justify-end">
        {messages?.map((message, index) => {
          const imageRegex = /(https?:\/\/[^\s]+?\.(?:webp|png|jpeg|svg))/gi;
          const images = message.content.match(imageRegex) || [];
          console.log("message.content", message.content);
          console.log("images", images);

          return (
            <motion.div
              key={index}
              layout
              initial={{ opacity: 0, scale: 1, y: 20, x: 0 }}
              animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, scale: 1, y: 20, x: 0 }}
              transition={{
                opacity: { duration: 0.1 },
                layout: {
                  type: "spring",
                  bounce: 0.3,
                  duration: messages.indexOf(message) * 0.05 + 0.2,
                },
              }}
              className={cn(
                "flex flex-col gap-2 p-4 whitespace-pre-wrap",
                message?.role === "user" ? "items-end" : "items-start",
              )}
            >
              <div className="flex gap-3 items-center">
                {message?.role === "user" && (
                  <div className="flex items-end gap-3">
                    <span className="bg-accent p-3 rounded-md max-w-xs sm:max-w-2xl overflow-x-auto">
                      {message.content}
                    </span>
                  </div>
                )}
                {(message?.role === "assistant" ||
                  message.role === "system") && (
                  <div className="flex gap-2">
                    <Avatar className="flex justify-start items-center overflow-hidden">
                      <AvatarImage
                        src="/exulu_logo.svg"
                        alt="user"
                        width={6}
                        height={6}
                        className="object-contain invert dark:invert-0"
                      />
                      <AvatarFallback>AI</AvatarFallback>
                    </Avatar>
                    <span className="p-3 rounded-md max-w-xs sm:max-w-2xl overflow-x-auto">
                      {/* Check if the message content contains a code block */}
                      {message.content.split("```").map((part, index) => {
                        if (index % 2 === 0) {
                          return (
                            <React.Fragment key={index}>{part}</React.Fragment>
                          );
                        } else {
                          return (
                            <pre className="whitespace-pre-wrap" key={index}>
                              <CodeDisplayBlock code={part} lang="" />
                            </pre>
                          );
                        }
                      })}

                      {images?.length ?
                        images.map((img) => {
                          return (
                            <Image
                              className="rounded"
                              width={200}
                              height={200}
                              src={img}
                              alt={""}
                            />
                          );
                        }) : null }

                      {isLoading ?
                        messages.indexOf(message) === messages.length - 1 && (
                          <span className="animate-pulse" aria-label="Typing">
                            ...
                          </span>
                        ) : null }
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      <div id="anchor" ref={bottomRef}></div>
    </div>
  );
}
