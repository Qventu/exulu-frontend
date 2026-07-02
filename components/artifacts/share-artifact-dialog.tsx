"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Copy, Check, Trash2, ExternalLink, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RBACControl } from "@/components/rbac";
import {
  sharedArtifactsApi,
  type ShareAuthMode,
  type ShareRbac,
  type ExistingShare,
} from "@/lib/api/shared-artifacts";
import { slugifyShareName } from "@/lib/artifacts/share-name";

const EXPIRY_PRESETS: { label: string; days: number | null }[] = [
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "No expiry", days: null },
];

const expiryToIso = (days: number | null): string | null =>
  days === null ? null : new Date(Date.now() + days * 86_400_000).toISOString();

const expiryLabel = (expiresAt: string | null): string => {
  if (!expiresAt) return "No expiry";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const days = Math.ceil(diff / 86_400_000);
  return `${days}d left`;
};

const authModeLabel = (mode: ShareAuthMode): string =>
  mode === "public" ? "Public" : mode === "password" ? "Password" : "Login required";

function ShareLinkRow({
  share,
  origin,
  onDelete,
}: {
  share: ExistingShare;
  origin: string;
  onDelete: (name: string) => void;
}) {
  const url = `${origin}/artifacts/${encodeURIComponent(share.name)}`;
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const expired = expiryLabel(share.expires_at) === "Expired";

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async () => {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    setDeleting(true);
    try {
      await sharedArtifactsApi.deleteByName(share.name);
      onDelete(share.name);
    } catch (err) {
      toast.error("Could not delete link", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-sm">{share.name}</p>
        <div className="mt-0.5 flex flex-wrap gap-1.5">
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {authModeLabel(share.auth_mode)}
          </span>
          <span
            className={`rounded-sm px-1.5 py-0.5 text-xs ${
              expired
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {expiryLabel(share.expires_at)}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={copy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={`h-7 w-7 ${confirming ? "text-destructive" : ""}`}
          onClick={handleDelete}
          disabled={deleting}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function CopyableUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        readOnly
        value={url}
        className="font-mono text-sm text-muted-foreground"
        onFocus={(e) => e.target.select()}
      />
      <Button type="button" size="icon" variant="outline" onClick={copy} className="shrink-0">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export function ShareArtifactDialog({
  open,
  onOpenChange,
  s3Key,
  contentType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  s3Key: string;
  contentType?: string | null;
}) {
  const [name, setName] = useState(() => slugifyShareName(s3Key));
  const [authMode, setAuthMode] = useState<ShareAuthMode>("regular");
  const [password, setPassword] = useState("");
  const [expiryDays, setExpiryDays] = useState<number | null>(7);
  const [rightsMode, setRightsMode] = useState("private");
  const [rbac, setRbac] = useState<ShareRbac>({ users: [], roles: [], teams: [] });
  const [submitting, setSubmitting] = useState(false);

  const [view, setView] = useState<"loading" | "list" | "create" | "success">("loading");
  const [shares, setShares] = useState<ExistingShare[]>([]);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setName(slugifyShareName(s3Key));
    setAuthMode("regular");
    setPassword("");
    setExpiryDays(7);
    setRightsMode("private");
    setRbac({ users: [], roles: [], teams: [] });
  }, [s3Key]);

  useEffect(() => {
    if (!open) return;
    setView("loading");
    setCreatedUrl(null);
    resetForm();
    sharedArtifactsApi.listByS3Key(s3Key).then((list) => {
      setShares(list);
      setView(list.length > 0 ? "list" : "create");
    });
  }, [open, s3Key, resetForm]);

  const handleDelete = (deletedName: string) => {
    setShares((prev) => {
      const next = prev.filter((s) => s.name !== deletedName);
      if (next.length === 0) {
        resetForm();
        setView("create");
      }
      return next;
    });
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const { name: created } = await sharedArtifactsApi.create({
        s3key: s3Key,
        name,
        auth_mode: authMode,
        expires_at: expiryToIso(expiryDays),
        content_type: contentType ?? null,
        ...(authMode === "password" ? { password } : {}),
        ...(authMode === "regular" ? { rights_mode: rightsMode, rbac } : {}),
      });
      const url = `${window.location.origin}/artifacts/${encodeURIComponent(created)}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      setCreatedUrl(url);
      // Refresh the list so "View all links" shows the newly created entry.
      const updated = await sharedArtifactsApi.listByS3Key(s3Key);
      setShares(updated);
      setView("success");
    } catch (err) {
      toast.error("Could not create share link", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {view === "loading" && (
          <>
            <DialogHeader>
              <DialogTitle>Share file</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center py-8">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground" />
            </div>
          </>
        )}

        {view === "list" && (
          <>
            <DialogHeader>
              <DialogTitle>Share file</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {shares.map((share) => (
                <ShareLinkRow
                  key={share.name}
                  share={share}
                  origin={origin}
                  onDelete={handleDelete}
                />
              ))}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="gap-1.5 sm:mr-auto"
                onClick={() => {
                  resetForm();
                  setView("create");
                }}
              >
                <Plus className="h-4 w-4" />
                New link
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        )}

        {view === "create" && (
          <>
            <DialogHeader>
              <DialogTitle>Create a shareable link</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="share-name">Link name</Label>
                <Input
                  id="share-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Expires</Label>
                <div className="flex flex-wrap gap-2">
                  {EXPIRY_PRESETS.map((p) => (
                    <Button
                      key={p.label}
                      type="button"
                      size="sm"
                      variant={expiryDays === p.days ? "default" : "outline"}
                      onClick={() => setExpiryDays(p.days)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Access</Label>
                <div className="flex flex-wrap gap-2">
                  {(["public", "password", "regular"] as ShareAuthMode[]).map((m) => (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={authMode === m ? "default" : "outline"}
                      onClick={() => setAuthMode(m)}
                    >
                      {m === "public"
                        ? "Public"
                        : m === "password"
                        ? "Password"
                        : "Logged-in users"}
                    </Button>
                  ))}
                </div>
              </div>

              {authMode === "password" && (
                <div className="space-y-1.5">
                  <Label htmlFor="share-pw">Password</Label>
                  <Input
                    id="share-pw"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}

              {authMode === "regular" && (
                <div className="space-y-1.5">
                  <Label>Who can access</Label>
                  <RBACControl
                    allowedModes={["private", "users", "roles", "teams"]}
                    initialRightsMode="private"
                    initialUsers={undefined}
                    initialRoles={undefined}
                    initialTeams={undefined}
                    modalMode={true}
                    subjectLabel="artifact"
                    onChange={(mode, users, roles, teams) => {
                      setRightsMode(mode);
                      setRbac({ users, roles, teams });
                    }}
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() =>
                  shares.length > 0 ? setView("list") : onOpenChange(false)
                }
                disabled={submitting}
              >
                {shares.length > 0 ? "Back" : "Cancel"}
              </Button>
              <Button
                onClick={submit}
                disabled={submitting || !name || (authMode === "password" && !password)}
              >
                {submitting ? "Creating…" : "Create link"}
              </Button>
            </DialogFooter>
          </>
        )}

        {view === "success" && createdUrl && (
          <>
            <DialogHeader>
              <DialogTitle>Link created</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your shareable link is ready and has been copied to your clipboard.
              </p>
              <div className="space-y-1.5">
                <Label>Share link</Label>
                <CopyableUrl url={createdUrl} />
              </div>
              <a
                href={createdUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open link
              </a>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setView("list")} className="sm:mr-auto">
                View all links
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
