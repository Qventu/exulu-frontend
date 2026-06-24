"use client";

import { useState } from "react";
import { toast } from "sonner";

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
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied", { description: url });
      onOpenChange(false);
    } catch (err) {
      toast.error("Could not create share link", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
              {/* RBACControl requires initialRightsMode, initialUsers, initialRoles (accept undefined).
                  initialTeams is optional. modalMode=true ensures the inner popover stays above
                  this dialog in the stacking context. */}
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
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={submitting || !name || (authMode === "password" && !password)}
          >
            {submitting ? "Creating…" : "Create link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
