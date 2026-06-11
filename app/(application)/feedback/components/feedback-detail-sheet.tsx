"use client";

import { useQuery } from "@apollo/client";
import { Trash2, ThumbsUp, ThumbsDown, Calendar, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loading } from "@/components/primitives/loading";
import {
  GET_AGENT_MESSAGES,
  GET_USER_BY_ID,
  GET_AGENT_SESSION_BY_ID,
  GET_AGENT_BY_ID,
} from "@/queries/queries";
import { MessageRenderer } from "@/components/message-renderer";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Feedback = {
  id: string;
  description: string;
  session: string;
  score: number;
  user: number;
  agent: string;
  createdAt: string;
};

interface FeedbackDetailSheetProps {
  feedback: Feedback | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (id: string) => void;
}

export function FeedbackDetailSheet({
  feedback,
  open,
  onOpenChange,
  onDelete,
}: FeedbackDetailSheetProps) {
  // Fetch session messages
  const { data: messagesData, loading: messagesLoading } = useQuery(
    GET_AGENT_MESSAGES,
    {
      variables: {
        page: 1,
        limit: 1000,
        filters: [
          {
            session: {
              eq: feedback?.session,
            },
          },
        ],
      },
      skip: !feedback?.session,
    },
  );

  // Fetch user info
  const { data: userData } = useQuery(GET_USER_BY_ID, {
    variables: {
      id: feedback?.user?.toString(),
    },
    skip: !feedback?.user,
  });

  // Fetch session info
  const { data: sessionData } = useQuery(GET_AGENT_SESSION_BY_ID, {
    variables: {
      id: feedback?.session,
    },
    skip: !feedback?.session,
  });

  // Fetch agent info
  const { data: agentData } = useQuery(GET_AGENT_BY_ID, {
    variables: {
      id: feedback?.agent,
    },
    skip: !feedback?.agent,
  });

  if (!feedback) return null;

  const messages =
    messagesData?.agent_messagesPagination?.items?.map((msg: any) => {
      try {
        return JSON.parse(msg.content);
      } catch {
        return null;
      }
    })?.filter(Boolean) || [];

  const user = userData?.userById;
  const agent = agentData?.agentById;
  const session = sessionData?.agent_sessionById;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <SheetTitle>Feedback Details</SheetTitle>
              <SheetDescription>
                Review the feedback and associated conversation
              </SheetDescription>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Feedback</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this feedback? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(feedback.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          {/* Feedback Metadata */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              {feedback.score === 1 ? (
                <Badge variant="default" className="flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" />
                  Positive
                </Badge>
              ) : (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <ThumbsDown className="h-3 w-3" />
                  Negative
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {new Date(feedback.createdAt).toLocaleString()}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="h-4 w-4" />
              {user?.name || user?.email || `User ${feedback.user}`}
            </div>
          </div>

          {agent && (
            <div className="text-sm text-muted-foreground">
              Agent: <span className="font-medium text-foreground">{agent.name}</span>
            </div>
          )}

          {session?.title && (
            <div className="text-sm text-muted-foreground">
              Session: <span className="font-medium text-foreground">{session.title}</span>
            </div>
          )}
        </SheetHeader>

        <Separator className="my-6" />

        {/* Feedback Text */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Feedback</h3>
          <div className="rounded-md border p-4 bg-muted/50">
            <p className="text-sm whitespace-pre-wrap">{feedback.description}</p>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Session Messages */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Conversation</h3>
          {messagesLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loading />
            </div>
          ) : messages.length > 0 ? (
            <div className="border rounded-md">
              <ScrollArea className="h-[600px] p-4">
                <MessageRenderer
                  messages={messages}
                  showTokens={false}
                  config={{
                    marginTopFirstMessage: "mt-0",
                  }}
                  status="idle"
                  writeAccess={false}
                  agent={agent}
                  addToolApprovalResponse={() => {}}
                  handleFeedback={() => {}}
                />
              </ScrollArea>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No messages found for this session.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
