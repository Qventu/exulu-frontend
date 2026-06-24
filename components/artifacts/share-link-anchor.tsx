"use client";

import { useEffect, useState, type AnchorHTMLAttributes } from "react";
import { Link2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { ShareArtifactDialog } from "@/components/artifacts/share-artifact-dialog";
import { isS3ArtifactUrl, extractS3Key } from "@/lib/artifacts/detect-s3-url";

// Cache the S3 endpoint for the page lifetime (one /api/config fetch).
let s3EndpointPromise: Promise<string> | null = null;
const getS3Endpoint = (): Promise<string> => {
  if (!s3EndpointPromise) {
    s3EndpointPromise = fetch("/api/config")
      .then((r) => r.json())
      .then((c) => c.s3_endpoint ?? "")
      .catch(() => "");
  }
  return s3EndpointPromise;
};

export function ShareLinkAnchor({
  className,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const href = props.href ?? "";
  const [endpoint, setEndpoint] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getS3Endpoint().then(setEndpoint);
  }, []);

  const isArtifact = !!endpoint && isS3ArtifactUrl(href, endpoint);
  const s3Key = isArtifact ? extractS3Key(href, endpoint) : null;

  return (
    <span className="inline-flex items-center gap-1">
      <a
        className={cn("font-medium text-primary underline", className)}
        rel="noreferrer"
        target="_blank"
        {...props}
      >
        {children}
      </a>
      {s3Key && (
        <>
          <button
            type="button"
            aria-label="Create shareable link"
            title="Create shareable link"
            className="inline-flex shrink-0 text-muted-foreground/70 hover:text-foreground"
            onClick={(e) => {
              e.preventDefault();
              setOpen(true);
            }}
          >
            <Link2 className="size-3.5" />
          </button>
          <ShareArtifactDialog open={open} onOpenChange={setOpen} s3Key={s3Key} />
        </>
      )}
    </span>
  );
}
