"use client";

import { useState, useEffect, useContext, useRef, useCallback } from "react";
import { UIMessage } from "ai";
import { useQuery } from "@apollo/client";
import { ConfigContext } from "@/components/shell/config-context";
import { UserContext } from "@/app/(application)/authenticated";
import { GET_IMAGE_GENERATION_STYLES } from "@/queries/queries";
import { getToken } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ChevronDown,
  Loader2,
  Plus,
  Minus,
  ImagePlus,
  Download,
  Check,
  Wand2,
  Edit3,
  X,
  Pencil,
  StopCircle,
  Globe,
  Lock,
  Users,
  Settings,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  EditStyleDialog,
  type StyleEditTarget,
} from "./edit-style-dialog";
import UppyDashboard from "@/components/uppy-dashboard";

/**
 * Tool result payload produced by the backend image_generation widget tool.
 * This shape is what message-renderer detects and hands to the widget.
 */
export type ImageGenerationWidgetConfig = {
  type: "image_generation_widget";
  toolCallId: string;
  sessionId: string;
  initialPrompt: string;
  models: {
    name: string;
    sizes: string[];
    qualities: string[];
    supportsEdit: boolean;
    maxN: number;
  }[];
  styles: {
    id: string;
    name: string;
    description: string | null;
    owner: "user" | "shared";
  }[];
  defaults: {
    model: string;
    size: string;
    quality: string;
    n: number;
  };
};

type ImageInGeneration = {
  key: string;
  presignedUrl: string;
  revisedPrompt: string | null;
};

type GenerationRow = {
  generationId: string;
  createdAt: string;
  operation: "generate" | "edit";
  model: string;
  prompt: string;
  appliedStyleId: string | null;
  appliedStyleMarkdown: string | null;
  size: string | null;
  quality: string | null;
  n: number;
  selected: boolean;
  error: string | null;
  maskImageKey: string | null;
  images: ImageInGeneration[];
  references: { key: string; presignedUrl: string }[];
};

type SelectionRef = { generationId: string; imageKey: string };

const ownerIcon = (owner: "user" | "shared") =>
  owner === "user" ? (
    <Pencil className="h-3 w-3" />
  ) : (
    <Users className="h-3 w-3" />
  );

const visibilityIcon = (mode: string) => {
  if (mode === "public") return <Globe className="h-3 w-3 text-success" />;
  if (mode === "users" || mode === "roles")
    return <Users className="h-3 w-3 text-info" />;
  return <Lock className="h-3 w-3 text-muted-foreground" />;
};

/**
 * Hover-reveal becomes an enhancement only (responsive.md T7): hidden until
 * hover/focus on hover-capable fine pointers, always visible on touch.
 */
const HOVER_REVEAL_CLASSES =
  "transition-opacity duration-150 motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:opacity-100";

export function ImageGenerationWidget({
  config,
  setMessages,
}: {
  config: ImageGenerationWidgetConfig;
  setMessages?: (updater: (prev: UIMessage[]) => UIMessage[]) => void;
}) {
  const configContext = useContext(ConfigContext);
  const userContext = useContext(UserContext);
  const backend = configContext?.backend;
  const t = useTranslations("chat");

  // Item 85: below `sm` the model/style/size/quality/count settings collapse
  // behind a single "Settings" disclosure; from `sm` up they are always open.
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [selectedModel, setSelectedModel] = useState(config.defaults.model);
  const currentModel = config.models.find((m) => m.name === selectedModel) ?? config.models[0];

  const [prompt, setPrompt] = useState(config.initialPrompt);
  const [size, setSize] = useState(config.defaults.size);
  const [quality, setQuality] = useState(config.defaults.quality);
  const [n, setN] = useState(config.defaults.n);
  const [selectedStyleId, setSelectedStyleId] = useState<string | undefined>(undefined);

  const [referenceImages, setReferenceImages] = useState<{ key: string; url?: string }[]>([]);
  const [maskKey, setMaskKey] = useState<string | undefined>(undefined);

  const [history, setHistory] = useState<GenerationRow[]>([]);
  const [selectedImages, setSelectedImages] = useState<SelectionRef[]>([]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [styleDialogOpen, setStyleDialogOpen] = useState(false);
  const [styleDialogTarget, setStyleDialogTarget] = useState<StyleEditTarget | undefined>(undefined);

  // Reset size/quality when model changes to a model that doesn't support
  // the currently-selected value.
  useEffect(() => {
    if (currentModel && !currentModel.sizes.includes(size)) {
      setSize(currentModel.sizes[0] ?? "1024x1024");
    }
    if (currentModel && !currentModel.qualities.includes(quality)) {
      setQuality(currentModel.qualities[0] ?? "auto");
    }
    if (currentModel && n > currentModel.maxN) {
      setN(currentModel.maxN);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel]);

  // Refetch the styles list — used after creating/editing a style so the
  // picker reflects the change without a page reload.
  const stylesQuery = useQuery(GET_IMAGE_GENERATION_STYLES, {
    fetchPolicy: "cache-and-network",
  });

  // Build a merged style list from the initial tool result + any styles
  // created via the dialog (which would only land in the GraphQL refetch).
  type StyleOption = ImageGenerationWidgetConfig["styles"][number];
  const styles: StyleOption[] = (stylesQuery.data?.platform_configurationsPagination?.items ?? [])
    .map((row: any): StyleOption | null => {
      const value =
        typeof row.config_value === "string"
          ? (() => { try { return JSON.parse(row.config_value); } catch { return null; } })()
          : row.config_value;
      if (!value?.name) return null;
      return {
        id: row.id,
        name: value.name,
        description: row.description ?? null,
        owner: String(row.created_by) === String(userContext?.user?.id) ? "user" : "shared",
      };
    })
    .filter(Boolean) as StyleOption[];

  // Fetch history on mount and whenever a new generation lands. Also
  // rehydrates the selected images so reloading the page keeps the
  // user's prior selection visible.
  const fetchHistory = useCallback(async () => {
    if (!backend) return;
    try {
      const token = await getToken();
      const res = await fetch(
        `${backend}/images/history?sessionId=${encodeURIComponent(config.sessionId)}&toolCallId=${encodeURIComponent(config.toolCallId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) return;
      const json = await res.json();
      const rows: GenerationRow[] = json.history ?? [];
      setHistory(rows);
      // Rehydrate selectedImages from rows where selected=true. We can't
      // tell which specific image within an n>1 row was selected from the
      // server-side flag alone, so the rehydration is row-granular: every
      // image of a selected row counts as selected.
      const sel: SelectionRef[] = [];
      for (const row of rows) {
        if (row.selected) {
          for (const img of row.images) sel.push({ generationId: row.generationId, imageKey: img.key });
        }
      }
      setSelectedImages(sel);
    } catch (err) {
      console.error("[EXULU] Failed to fetch image history", err);
    }
  }, [backend, config.sessionId, config.toolCallId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Mode flips to 'edit' as soon as any reference image is attached.
  const mode: "generate" | "edit" = referenceImages.length > 0 ? "edit" : "generate";

  const handleAbort = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsGenerating(false);
    setError("Cancelled");
  };

  const handleGenerate = async () => {
    if (!backend) {
      toast.error("Backend not configured");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Prompt is required");
      return;
    }
    if (mode === "edit" && !currentModel?.supportsEdit) {
      toast.error("Model doesn't support editing", { description: `Pick a model with edit support, or remove reference images.` });
      return;
    }

    setError(null);
    setIsGenerating(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const endpoint = mode === "edit" ? "/images/edit" : "/images/generate";
    const body: any = {
      sessionId: config.sessionId,
      toolCallId: config.toolCallId,
      model: selectedModel,
      prompt,
      n,
      size,
      quality,
      styleId: selectedStyleId,
    };
    if (mode === "edit") {
      body.referenceImageKeys = referenceImages.map((r) => r.key);
      if (maskKey) body.maskKey = maskKey;
    }

    try {
      const token = await getToken();
      const res = await fetch(`${backend}${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errJson.detail ?? "Generation failed");
      }
      // Successful generation lands a new row in history; re-fetch so we
      // always render the same shape and the new row's presigned URLs are
      // freshly signed.
      await fetchHistory();
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("[EXULU] Image generation failed", err);
      setError(err instanceof Error ? err.message : "Generation failed");
      toast.error("Generation failed", { description: err instanceof Error ? err.message : "Unknown error" });
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const toggleSelection = (generationId: string, imageKey: string) => {
    setSelectedImages((prev) => {
      const exists = prev.some((s) => s.imageKey === imageKey);
      if (exists) return prev.filter((s) => s.imageKey !== imageKey);
      return [...prev, { generationId, imageKey }];
    });
  };

  const handleUseSelected = async () => {
    if (!backend || selectedImages.length === 0) return;
    try {
      const token = await getToken();
      const res = await fetch(`${backend}/images/select`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: config.sessionId,
          toolCallId: config.toolCallId,
          selections: selectedImages,
        }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errJson.detail ?? "Could not save selection");
      }
      const json = await res.json();
      if (json.systemMessage && setMessages) {
        // Inject the system message into the live chat so the assistant
        // sees it on its next turn. Without this the message only appears
        // after a refetch.
        setMessages((prev) => [...prev, json.systemMessage as UIMessage]);
      }
      toast.success("Selection saved", { description: `${selectedImages.length} image(s) sent to the assistant.` });
      // Refresh history so the selected flags now reflect the server state.
      await fetchHistory();
    } catch (err) {
      console.error("[EXULU] /images/select failed", err);
      toast.error("Couldn't save selection", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const downloadImage = async (url: string) => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      toast.error("Download failed");
    }
  };

  const useAsReference = async (presignedUrl: string, key: string) => {
    if (referenceImages.some((r) => r.key === key)) return;
    setReferenceImages((prev) => [...prev, { key, url: presignedUrl }]);
  };

  // If history rows already include selected items, default to a compact
  // final-selection view. The user can click "Edit again" to expand back
  // into the full widget.
  const hasFinalSelection = history.some((r) => r.selected);
  const [forceExpanded, setForceExpanded] = useState(false);
  const collapsed = hasFinalSelection && !forceExpanded;

  if (collapsed) {
    const selectedRows = history.filter((r) => r.selected);
    const allImages = selectedRows.flatMap((r) => r.images);
    return (
      <div className="my-3 border rounded-lg p-3 bg-card">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-sm font-medium flex items-center gap-2">
            <Check className="h-4 w-4 text-success" aria-hidden="true" /> Final selection
          </div>
          <Button size="sm" variant="ghost" className="h-11 sm:h-9" onClick={() => setForceExpanded(true)}>
            <Edit3 className="h-3 w-3 mr-1" aria-hidden="true" /> Edit again
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {allImages.map((img) => (
            <a key={img.key} href={img.presignedUrl} target="_blank" rel="noopener noreferrer">
              <img src={img.presignedUrl} alt="" className="w-full aspect-square object-cover rounded border" />
            </a>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="my-3 border rounded-lg bg-card overflow-hidden">
      {/* Item 85: <sm the settings (model/style + size/quality/count) sit
          behind one "Settings" disclosure; sm+ renders them inline. */}
      <button
        type="button"
        onClick={() => setSettingsOpen((v) => !v)}
        aria-expanded={settingsOpen}
        className="flex min-h-11 w-full items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2 text-sm font-medium sm:hidden"
      >
        <span className="flex items-center gap-2">
          <Settings className="size-4 text-muted-foreground" aria-hidden="true" />
          {t("imageGen.settings")}
        </span>
        <span className="flex min-w-0 items-center gap-2 text-xs font-normal text-muted-foreground">
          <span className="truncate">{selectedModel} · {size} · {quality} · ×{n}</span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
              settingsOpen && "rotate-180",
            )}
            aria-hidden="true"
          />
        </span>
      </button>

      {/* Header: model + style picker */}
      <div className={cn(
        "p-3 border-b bg-muted/30 gap-2 grid-cols-1 md:grid-cols-2",
        settingsOpen ? "grid" : "hidden sm:grid",
      )}>
        <div className="space-y-1">
          <Label className="text-xs">Model</Label>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {config.models.map((m) => (
                <SelectItem key={m.name} value={m.name}>
                  <div className="flex items-center gap-2">
                    <span>{m.name}</span>
                    {m.supportsEdit && (
                      <Badge variant="secondary" className="text-[10px] py-0">
                        edits
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Style</Label>
          <div className="flex gap-1">
            <Select
              value={selectedStyleId ?? "__none__"}
              onValueChange={(v) => setSelectedStyleId(v === "__none__" ? undefined : v)}
            >
              <SelectTrigger className="h-9 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  <span className="text-muted-foreground">No style</span>
                </SelectItem>
                {styles.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      {ownerIcon(s.owner)}
                      <span>{s.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedStyleId && (
              <Button
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 sm:h-9 sm:w-9"
                title="Edit style"
                aria-label={t("imageGen.editStyle")}
                onClick={() => {
                  const style = stylesQuery.data?.platform_configurationsPagination?.items?.find(
                    (s: any) => s.id === selectedStyleId,
                  );
                  if (!style) return;
                  const value =
                    typeof style.config_value === "string"
                      ? (() => { try { return JSON.parse(style.config_value); } catch { return {}; } })()
                      : style.config_value;
                  setStyleDialogTarget({
                    id: style.id,
                    name: value?.name ?? "",
                    description: style.description ?? "",
                    markdown: value?.markdown ?? "",
                    rights_mode: style.rights_mode,
                    users: style.RBAC?.users ?? [],
                    roles: style.RBAC?.roles ?? [],
                  });
                  setStyleDialogOpen(true);
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 shrink-0 sm:h-9 sm:w-9"
              title="New style"
              aria-label={t("imageGen.newStyle")}
              onClick={() => {
                setStyleDialogTarget(undefined);
                setStyleDialogOpen(true);
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Prompt */}
      <div className="p-3 border-b space-y-1">
        <Label htmlFor={`prompt-${config.toolCallId}`} className="text-xs">
          Prompt
        </Label>
        <Textarea
          id={`prompt-${config.toolCallId}`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          className="resize-y text-base md:text-sm"
        />
      </div>

      {/* Reference images */}
      <div className="p-3 border-b space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">
            Reference images{" "}
            {referenceImages.length > 0 && (
              <span className="text-muted-foreground">({referenceImages.length})</span>
            )}
          </Label>
          <UppyDashboard
            id={`refs-${config.toolCallId}`}
            allowedFileTypes={[".png", ".jpg", ".jpeg", ".webp"]}
            selectionLimit={5}
            dependencies={[config.toolCallId]}
            buttonText="Add"
            onConfirm={(keys) => {
              setReferenceImages((prev) => [
                ...prev,
                ...keys.filter((k) => !prev.some((p) => p.key === k)).map((k) => ({ key: k })),
              ]);
            }}
          />
        </div>
        {referenceImages.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {referenceImages.map((ref) => (
              <div key={ref.key} className="relative group">
                {ref.url ? (
                  <img
                    src={ref.url}
                    alt=""
                    className="h-20 w-20 md:h-16 md:w-16 object-cover rounded border"
                  />
                ) : (
                  <div className="h-20 w-20 md:h-16 md:w-16 rounded border bg-muted flex items-center justify-center">
                    <ImagePlus className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                )}
                {/* Always visible on touch (fixes U6); the visible chip is
                    28px with a ::before hit-area extension to ~44px. */}
                <button
                  type="button"
                  aria-label={t("imageGen.removeReference")}
                  className={cn(
                    "absolute -top-2 -right-2 flex h-7 w-7 md:h-5 md:w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground",
                    "before:absolute before:-inset-2 before:content-[''] focus-visible:opacity-100",
                    HOVER_REVEAL_CLASSES,
                  )}
                  onClick={() => setReferenceImages((prev) => prev.filter((p) => p.key !== ref.key))}
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
        {mode === "edit" && !currentModel?.supportsEdit && (
          <div className="text-xs text-destructive">
            The selected model doesn't support image editing — pick another model or remove references.
          </div>
        )}
      </div>

      {/* Controls: size / quality / n */}
      <div className={cn(
        "p-3 border-b gap-2 grid-cols-2 sm:grid-cols-3",
        settingsOpen ? "grid" : "hidden sm:grid",
      )}>
        <div className="space-y-1">
          <Label className="text-xs">Size</Label>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currentModel?.sizes.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Quality</Label>
          <Select value={quality} onValueChange={setQuality}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currentModel?.qualities.map((q) => (
                <SelectItem key={q} value={q}>
                  {q}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Count</Label>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-9 sm:w-9"
              disabled={n <= 1}
              aria-label={t("imageGen.decreaseCount")}
              onClick={() => setN((v) => Math.max(1, v - 1))}
            >
              <Minus className="h-3 w-3" aria-hidden="true" />
            </Button>
            <span className="text-sm font-medium w-8 text-center">{n}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11 sm:h-9 sm:w-9"
              disabled={!currentModel || n >= currentModel.maxN}
              aria-label={t("imageGen.increaseCount")}
              onClick={() => setN((v) => Math.min(currentModel?.maxN ?? 1, v + 1))}
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      {/* Generate / abort */}
      <div className="p-3 border-b">
        {isGenerating ? (
          <Button variant="outline" className="w-full h-11 sm:h-10" onClick={handleAbort}>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
            Generating… (click to cancel)
            <StopCircle className="h-4 w-4 ml-2" aria-hidden="true" />
          </Button>
        ) : (
          <Button className="w-full h-11 sm:h-10" onClick={handleGenerate}>
            {mode === "edit" ? (
              <>
                <Edit3 className="h-4 w-4 mr-2" aria-hidden="true" /> Edit image
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4 mr-2" aria-hidden="true" /> Generate
              </>
            )}
          </Button>
        )}
        {error && <div className="text-xs text-destructive mt-2">{error}</div>}
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="p-3 border-b space-y-3 max-h-[60dvh] overflow-y-auto">
          <Label className="text-xs">History</Label>
          {[...history].reverse().map((row) => (
            <div key={row.generationId} className="border rounded p-2 bg-background">
              <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px] py-0">
                    {row.operation}
                  </Badge>
                  <span>{row.model}</span>
                  {row.size && <span>· {row.size}</span>}
                  {row.quality && <span>· {row.quality}</span>}
                </div>
                <div className="text-[10px] truncate max-w-[300px]" title={row.prompt}>
                  {row.prompt}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {row.images.map((img) => {
                  const isSel = selectedImages.some((s) => s.imageKey === img.key);
                  return (
                    <div key={img.key} className="relative group">
                      <button
                        type="button"
                        onClick={() => toggleSelection(row.generationId, img.key)}
                        className={cn(
                          "block w-full rounded border-2 overflow-hidden transition-colors duration-150 motion-reduce:transition-none",
                          isSel ? "border-primary" : "border-transparent hover:border-muted-foreground/40",
                        )}
                      >
                        <img
                          src={img.presignedUrl}
                          alt={row.prompt}
                          className="w-full aspect-square object-cover"
                        />
                      </button>
                      {isSel && (
                        <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                          <Check className="h-3 w-3" aria-hidden="true" />
                        </div>
                      )}
                      {/* Item 89 / U6: image actions always visible on touch,
                          ≥44px targets below md; hover-reveal only on
                          hover-capable pointers. */}
                      <div className={cn("absolute bottom-1 left-1 flex gap-1", HOVER_REVEAL_CLASSES)}>
                        <button
                          type="button"
                          className="flex h-11 w-11 md:h-7 md:w-7 items-center justify-center rounded bg-background/80 backdrop-blur"
                          title="Download"
                          aria-label={t("imageGen.download")}
                          onClick={() => downloadImage(img.presignedUrl)}
                        >
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        {currentModel?.supportsEdit && (
                          <button
                            type="button"
                            className="flex h-11 w-11 md:h-7 md:w-7 items-center justify-center rounded bg-background/80 backdrop-blur"
                            title="Use as reference"
                            aria-label={t("imageGen.useAsReference")}
                            onClick={() => useAsReference(img.presignedUrl, img.key)}
                          >
                            <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selection footer */}
      <div className="p-3 flex flex-col gap-2 bg-muted/20 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {selectedImages.length === 0
            ? "Select one or more images, then send them to the assistant."
            : `${selectedImages.length} image(s) selected`}
        </div>
        <Button
          size="sm"
          className="h-11 w-full sm:h-9 sm:w-auto"
          disabled={selectedImages.length === 0}
          onClick={handleUseSelected}
        >
          <Check className="h-3 w-3 mr-1" aria-hidden="true" />
          Use these
        </Button>
      </div>

      <EditStyleDialog
        open={styleDialogOpen}
        onOpenChange={setStyleDialogOpen}
        initialStyle={styleDialogTarget}
        onSaved={() => {
          stylesQuery.refetch();
        }}
      />
    </div>
  );
}
