"use client";

import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useSearchParams } from "next/navigation";
import React from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const ERROR_MESSAGES = {
  Configuration:
    "There is a problem with the server configuration. Please contact the site administrator.",
  AccessDenied: "You don't have permission to sigin or register on this site.",
  Verification:
    "That token is not valid. Please try again or refresh the page to request a new one.",
  Default: "There was an unknown error. Please refresh the page and try again.",
};

export default function VerificationAlert() {
  const params = useSearchParams();
  const error = params.get("error") as keyof typeof ERROR_MESSAGES;

  return error ? (
    <Alert variant="default">
      <ExclamationTriangleIcon className="size-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        {ERROR_MESSAGES[error] || ERROR_MESSAGES.Default}
      </AlertDescription>
    </Alert>
  ) : null;
}
