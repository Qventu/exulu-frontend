"use client";

/**
 * NewTranscriptDialog (Task 9, spec §4.2) — hosts the three existing
 * composers (upload / meeting bot / record) behind one source switch, in one
 * `Dialog` instead of three inline cards. Composers keep their own internal
 * logic; this component only owns the shell chrome (title, switch, Cancel,
 * and — for upload/meeting — the dynamic primary action button) that they
 * used to render themselves.
 *
 * Unlike the old `enabledModes`, every source always renders: a source whose
 * `/config` flag is off shows as a disabled `ToggleGroupItem` (title attr
 * carries the "not set up" hint) and, if it ends up being the only source
 * available at all, the body shows a quiet not-set-up note instead of a
 * composer.
 *
 * **The recording pin (do not weaken this).** The Dialog is controlled: its
 * `open` prop is the *caller's* `composerVisible`
 * (`composerOpen || recordingActive` in page.tsx), recomputed fresh on every
 * render straight off `live.activeJobId`. That, not anything in this
 * component, is what actually pins the surface — Escape, an overlay click,
 * the built-in "X", and RecordComposer's own `onCancel()` (its close-out
 * success path, the endedElsewhere handler, discard) all funnel into the
 * same `onOpenChange(false)`, which this component passes straight through
 * unconditionally. As long as `recordingActive` is still true when the
 * caller re-renders, the `open` prop stays true and Radix — a controlled
 * component — keeps `DialogContent` (and RecordComposer inside it) mounted
 * regardless of how many times `onOpenChange(false)` fired. Deliberately NOT
 * gated here with a closure or ref check on `recordingActive`: several of
 * RecordComposer's own `onCancel()` calls run inside `runCloseout`, a
 * `useCallback` cached in a ref and invoked from an effect, and can still be
 * holding an *earlier* render's `onCancel` — often synchronously, in the
 * same tick as the state update that flips recording off — by the time they
 * call it. A local gate keyed on that render's value would risk blocking a
 * call that is legitimate by the time it actually runs; the caller's own
 * fresh, un-memoized read of `live.activeJobId` has no such staleness.
 * `RecordComposer` is rendered unconditionally while a recording is active,
 * regardless of whether `config.transcription.enabled` still reads true, so
 * a flag flip can never unmount it mid-close-out (see
 * `use-live-recorder.ts`'s `pendingCloseout` / `beginCloseout` /
 * `endCloseout`).
 */
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";

import { useLiveRecordingOptional } from "@/components/live-recording/live-recording-provider";
import { EmptyState } from "@/components/primitives/empty-state";
import { ConfigContext } from "@/components/shell/config-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useIsMobile } from "@/hooks/use-mobile";

import type { ComposerPrimaryAction } from "../types";
import { Composer } from "./composer";
import { MeetingComposer } from "./meeting-composer";
import { RecordComposer } from "./record-composer";

export type ComposerMode = "audio" | "meeting" | "record";

export interface NewTranscriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A job was started — the home refetches. The dialog closes itself, except
   *  in record mode, where the recorder owns its own close-out. */
  onStarted: () => void;
}

// Desktop order matches the old `enabledModes` order; mobile puts Record
// first (one tap on a phone).
const ORDER_DESKTOP: ComposerMode[] = ["audio", "meeting", "record"];
const ORDER_MOBILE: ComposerMode[] = ["record", "audio", "meeting"];

const MODE_LABEL_KEY: Record<ComposerMode, string> = {
  audio: "composer.modeAudio",
  meeting: "composer.modeMeeting",
  record: "composer.modeRecord",
};

export function NewTranscriptDialog({
  open,
  onOpenChange,
  onStarted,
}: NewTranscriptDialogProps) {
  const t = useTranslations("transcriptions");
  const tCommon = useTranslations("common");
  const config = React.useContext(ConfigContext);
  const isMobile = useIsMobile();
  const live = useLiveRecordingOptional();

  const flags: Record<ComposerMode, boolean> = {
    audio: !!config?.whisper?.enabled,
    meeting: !!config?.recall?.enabled,
    record: !!config?.transcription?.enabled,
  };

  // activeJobId, not jobId: the close-out (upload + liveRecordingStop) runs
  // after the recorder has let the job go, and unmounting the composer
  // mid-upload loses the audio.
  const recordingActive = !!live?.activeJobId;

  const order = isMobile ? ORDER_MOBILE : ORDER_DESKTOP;

  const [selectedMode, setSelectedMode] = React.useState<ComposerMode | null>(
    null,
  );
  const effectiveMode: ComposerMode = recordingActive
    ? "record"
    : selectedMode && flags[selectedMode]
      ? selectedMode
      : (order.find((mode) => flags[mode]) ?? order[0]);

  // A recording in progress always pins the surface: no switching away, and
  // nothing to back out with while a close-out may be running.
  const showSwitch = !recordingActive;

  const [primaryAction, setPrimaryAction] =
    React.useState<ComposerPrimaryAction | null>(null);
  // A stale action from the previous mode/open must never linger onto a
  // freshly mounted composer.
  React.useEffect(() => {
    setPrimaryAction(null);
  }, [effectiveMode, open]);

  // Deliberately NOT gated on recordingActive — see the file header. The
  // caller's own `open` prop (composerVisible) is what actually keeps the
  // surface up during a recording; this is a plain, unconditional
  // pass-through so nothing here can go stale.
  const handleCancel = () => onOpenChange(false);

  // The upload/meeting composers report their own Start action up; the
  // dialog just renders whatever they currently say. Record keeps its own
  // Start button (see record-composer.tsx) — its close-out logic must not be
  // restructured, so it is never routed through this indirection.
  const handlePrimaryActionChange = React.useCallback(
    (action: ComposerPrimaryAction) => setPrimaryAction(action),
    [],
  );

  const onComposerStarted = () => {
    onOpenChange(false);
    onStarted();
  };

  // Rendered unconditionally while a recording is active — see the pin note
  // in the file header. Otherwise, an unconfigured effective mode (only
  // possible when nothing at all is enabled, since a disabled switch item
  // can never be selected) shows the not-set-up note instead of a composer.
  const showComposer = recordingActive || flags[effectiveMode];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle>{t("composer.dialogTitle")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {showSwitch && (
            <ToggleGroup
              type="single"
              value={effectiveMode}
              onValueChange={(value) =>
                value && setSelectedMode(value as ComposerMode)
              }
              className="justify-start"
            >
              {order.map((mode) => (
                <ToggleGroupItem
                  key={mode}
                  value={mode}
                  disabled={!flags[mode]}
                  title={flags[mode] ? undefined : t("composer.notSetUp")}
                  className="max-md:h-11"
                >
                  {t(MODE_LABEL_KEY[mode])}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}

          {showComposer ? (
            <>
              {effectiveMode === "audio" && (
                <Composer
                  onStarted={onComposerStarted}
                  onPrimaryActionChange={handlePrimaryActionChange}
                />
              )}
              {effectiveMode === "meeting" && (
                <MeetingComposer
                  onStarted={onComposerStarted}
                  onPrimaryActionChange={handlePrimaryActionChange}
                />
              )}
              {effectiveMode === "record" && (
                <RecordComposer onCancel={handleCancel} onStarted={onStarted} />
              )}
            </>
          ) : (
            <>
              <EmptyState
                variant="quiet"
                title={t("composer.notSetUp")}
                description={t("composer.notSetUpHint")}
              />
              {/* No admin settings page exposes these flags yet (they are
                  backend env vars) — plain text, not a link to nowhere. */}
              <p className="mx-auto max-w-sm text-center text-sm text-muted-foreground">
                {t("composer.askAdmin")}
              </p>
            </>
          )}
        </div>

        {!recordingActive && (
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              disabled={primaryAction?.busy}
              className="max-md:h-11"
            >
              {tCommon("cancel")}
            </Button>
            {showComposer && effectiveMode !== "record" && (
              <Button
                type="button"
                onClick={() => primaryAction?.run()}
                disabled={!primaryAction || primaryAction.disabled}
                className="max-md:h-11"
              >
                {primaryAction?.busy ? (
                  <Loader2
                    aria-hidden="true"
                    className="mr-2 size-4 animate-spin"
                  />
                ) : null}
                {primaryAction?.label}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
