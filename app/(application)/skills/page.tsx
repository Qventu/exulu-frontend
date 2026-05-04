"use client";

import { useContext, useState, useEffect } from "react";
import { UserContext } from "@/app/(application)/authenticated";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  Sparkles,
  Tag,
  GitBranch,
  FileText,
  ExternalLink,
  Loader2,
  ChevronDown,
  ChevronUp,
  Lock,
  Globe,
  Users,
  Settings,
  AlertTriangle,
  ShieldCheck,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { useSkills, useCreateSkill, useUpdateSkill } from "@/hooks/use-skills";
import { SkillListItem } from "./components/skill-list-item";
import { Skill } from "@/types/models/skill";
import { skillsApi } from "@/util/api";
import { RBACControl } from "@/components/rbac";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

export default function SkillsPage() {
  const { user } = useContext(UserContext);
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [page] = useState(1);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Create form state
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createTags, setCreateTags] = useState("");
  const [createRightsMode, setCreateRightsMode] = useState<string>("private");
  const [isCreating, setIsCreating] = useState(false);

  const filters: any[] = [];
  if (searchQuery) filters.push({ name: { contains: searchQuery } });

  const { data, loading, error, refetch } = useSkills({ page, limit: 50, filters });
  const [createSkill] = useCreateSkill();

  const skills = data?.skillsPagination?.items ?? [];

  // Auto-select first skill
  useEffect(() => {
    if (skills.length > 0 && !selectedSkill) {
      setSelectedSkill(skills[0] ?? null);
    }
  }, [skills, selectedSkill]);

  // Keep selected skill in sync after refetch
  useEffect(() => {
    if (selectedSkill) {
      const updated = skills.find((s) => s.id === selectedSkill.id);
      if (updated) setSelectedSkill(updated);
    }
  }, [skills]);

  // Keyboard shortcut: Cmd/Ctrl+K → create
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCreateModalOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleCreate = async () => {
    if (!createName.trim()) {
      toast.error("Name is required");
      return;
    }
    setIsCreating(true);
    try {
      const tags = createTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const result = await createSkill({
        variables: {
          name: createName.trim(),
          description: createDescription.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined,
          rights_mode: createRightsMode,
        },
      });

      const newSkill = result.data?.skillsCreateOne?.item;
      if (!newSkill) throw new Error("No skill returned");

      // Initialise S3 folder and SKILL.md
      await skillsApi.init(newSkill.id, newSkill.name, newSkill.description ?? "");

      toast.success(`Skill "${newSkill.name}" created`);
      setIsCreateModalOpen(false);
      setCreateName("");
      setCreateDescription("");
      setCreateTags("");
      setCreateRightsMode("private");

      // Navigate to editor
      router.push(`/skills/${newSkill.id}`);
    } catch (err: any) {
      toast.error("Failed to create skill", { description: err.message });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="h-full flex-1 flex-col p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 border-b border-border/50 pb-6 sm:pb-8 mb-6 sm:mb-8">
        <div className="space-y-2 sm:space-y-4 max-w-3xl animate-in fade-in slide-in-from-left-8 duration-700">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter leading-none">
            Skills
            <br />
            <span className="text-primary">Library</span>
          </h1>
          <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-xl">
            Build, version, and manage reusable skill packages for your AI agents.
          </p>
        </div>
        <div className="w-full sm:w-auto animate-in fade-in slide-in-from-right-8 duration-700">
          <Button
            onClick={() => setIsCreateModalOpen(true)}
            size="lg"
            className="w-full sm:w-auto h-12 sm:h-14 px-6 sm:px-8 text-base font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-150"
          >
            <Plus className="mr-2 h-5 w-5" />
            New Skill
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 border-2 focus-visible:border-primary/50"
          />
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-8 w-8 text-destructive mb-4" />
          <p className="text-sm font-semibold text-destructive mb-2">Failed to load skills</p>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-auto lg:h-[calc(100vh-280px)] animate-in fade-in duration-500">
          {/* Left: list */}
          <div className="w-full lg:w-80 xl:w-96 flex flex-col border rounded-lg shadow-sm bg-card overflow-hidden max-h-[50vh] lg:max-h-none">
            <div className="p-3 sm:p-4 border-b bg-muted/30">
              <p className="text-xs sm:text-sm font-semibold text-muted-foreground">
                {skills.length} {skills.length === 1 ? "skill" : "skills"}
              </p>
            </div>
            <div className="flex-1 overflow-auto">
              {loading ? (
                <div className="flex items-center justify-center h-full p-8">
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <span className="text-sm font-medium text-muted-foreground">Loading...</span>
                  </div>
                </div>
              ) : skills.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground mb-4" strokeWidth={1} />
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    {searchQuery ? "No matches found" : "No skills yet"}
                  </p>
                  {!searchQuery && (
                    <Button onClick={() => setIsCreateModalOpen(true)} size="sm" className="mt-2">
                      <Plus className="mr-2 h-4 w-4" />
                      New Skill
                    </Button>
                  )}
                </div>
              ) : (
                skills.map((skill) => (
                  <SkillListItem
                    key={skill.id}
                    skill={skill}
                    isSelected={selectedSkill?.id === skill.id}
                    onClick={() => setSelectedSkill(skill)}
                    onDelete={() => {
                      if (selectedSkill?.id === skill.id) setSelectedSkill(null);
                      refetch();
                    }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right: preview */}
          <div className="flex-1 min-w-0 min-h-[400px] lg:min-h-0">
            {selectedSkill ? (
              <SkillPreviewPanel
                skill={selectedSkill}
                onOpenEditor={() => router.push(`/skills/${selectedSkill.id}`)}
                onRefetch={refetch}
              />
            ) : (
              <div className="h-full flex items-center justify-center border rounded-lg bg-muted/20">
                <div className="text-center space-y-4 px-8">
                  <Sparkles
                    className="h-16 w-16 text-muted-foreground mx-auto"
                    strokeWidth={1}
                  />
                  <div className="space-y-2">
                    <p className="text-lg font-semibold text-muted-foreground">
                      Select a skill to preview
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Choose a skill from the list to view its details
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              New Skill
            </DialogTitle>
            <DialogDescription>
              Create a skill package. After creating, you&apos;ll be taken to the editor where you
              can add files and scripts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="skill-name">Name *</Label>
              <Input
                id="skill-name"
                placeholder="e.g. Data Analysis"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="skill-description">Description</Label>
              <Textarea
                id="skill-description"
                placeholder="What does this skill do? When should an agent use it?"
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="skill-tags">Tags</Label>
              <Input
                id="skill-tags"
                placeholder="analysis, python, data (comma separated)"
                value={createTags}
                onChange={(e) => setCreateTags(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="skill-rights">Access</Label>
              <Select value={createRightsMode} onValueChange={setCreateRightsMode}>
                <SelectTrigger id="skill-rights">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="users">All Users</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isCreating || !createName.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create & Open
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const RIGHTS_MODE_CONFIG = {
  private: { icon: Lock, color: "text-red-600 dark:text-red-500", label: "Private" },
  public: { icon: Globe, color: "text-green-600 dark:text-green-500", label: "Public" },
  users: { icon: Users, color: "text-blue-600 dark:text-blue-500", label: "Shared with Users" },
  roles: { icon: Settings, color: "text-purple-600 dark:text-purple-500", label: "Shared with Roles" },
} as const;

const PREVIEW_LINES = 15;

function SkillPreviewPanel({
  skill,
  onOpenEditor,
  onRefetch,
}: {
  skill: Skill;
  onOpenEditor: () => void;
  onRefetch: () => void;
}) {
  const { user } = useContext(UserContext);
  const [updateSkill] = useUpdateSkill();

  // SKILL.md preview state
  const [skillMdContent, setSkillMdContent] = useState<string | null>(null);
  const [skillMdMissing, setSkillMdMissing] = useState(false);
  const [skillMdLoading, setSkillMdLoading] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);

  // Access control edit state
  const [editingAccess, setEditingAccess] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [pendingRbac, setPendingRbac] = useState<{
    rights_mode: string;
    users: { id: number; rights: "read" | "write" }[];
    roles: { id: string; rights: "read" | "write" }[];
  } | null>(null);

  const hasWriteAccess =
    user?.super_admin === true ||
    skill.created_by === user?.id?.toString();

  const versionCount = (skill.history?.length ?? 0) + 1;

  // Fetch SKILL.md when skill changes
  useEffect(() => {
    setSkillMdContent(null);
    setSkillMdMissing(false);
    setShowFullPreview(false);
    if (!skill.id) return;

    const key = `skills/${skill.id}/v${skill.current_version ?? 1}/SKILL.md`;
    setSkillMdLoading(true);
    skillsApi
      .file(skill.id, key)
      .then(({ content }) => {
        setSkillMdContent(content ?? "");
        setSkillMdMissing(false);
      })
      .catch(() => {
        setSkillMdMissing(true);
        setSkillMdContent(null);
      })
      .finally(() => setSkillMdLoading(false));
  }, [skill.id, skill.current_version]);

  const handleSaveAccess = async () => {
    if (!pendingRbac) return;
    setSavingAccess(true);
    try {
      await updateSkill({
        variables: {
          id: skill.id,
          rights_mode: pendingRbac.rights_mode,
          RBAC: {
            users: pendingRbac.users,
            roles: pendingRbac.roles,
          },
        },
      });
      toast.success("Access control updated");
      setEditingAccess(false);
      setPendingRbac(null);
      onRefetch();
    } catch (err: unknown) {
      toast.error(`Failed to update access: ${(err as Error).message}`);
    } finally {
      setSavingAccess(false);
    }
  };

  // Compute preview lines
  const allLines = skillMdContent?.split("\n") ?? [];
  const previewLines = showFullPreview ? allLines : allLines.slice(0, PREVIEW_LINES);
  const hasMore = allLines.length > PREVIEW_LINES;

  const rightsCfg =
    RIGHTS_MODE_CONFIG[skill.rights_mode as keyof typeof RIGHTS_MODE_CONFIG] ??
    RIGHTS_MODE_CONFIG.public;
  const RightsIcon = rightsCfg.icon;

  return (
    <div className="h-full flex flex-col border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b flex items-start justify-between gap-4 flex-shrink-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold truncate">{skill.name}</h2>
            <Badge variant="secondary" className="font-mono text-xs flex-shrink-0">
              v{skill.current_version ?? 1}
            </Badge>
          </div>
          {skill.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{skill.description}</p>
          )}
        </div>
        <Button onClick={onOpenEditor} size="sm" className="flex-shrink-0">
          <ExternalLink className="mr-1.5 h-4 w-4" />
          Open Editor
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-5 py-4 space-y-5">

          {/* SKILL.md preview */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                SKILL.md
              </span>
            </div>

            {skillMdLoading ? (
              <div className="flex items-center gap-2 py-3 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-xs">Loading preview...</span>
              </div>
            ) : skillMdMissing ? (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-md border border-yellow-500/30 bg-yellow-500/5 text-yellow-700 dark:text-yellow-400">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold">SKILL.md not found</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Open the editor to create SKILL.md and document this skill.
                  </p>
                </div>
              </div>
            ) : skillMdContent !== null ? (
              <div className="rounded-md border bg-muted/30 overflow-hidden">
                <pre className="p-3 text-xs font-mono leading-relaxed whitespace-pre-wrap break-words text-foreground">
                  {previewLines.join("\n")}
                  {!showFullPreview && hasMore && (
                    <span className="text-muted-foreground"> ...</span>
                  )}
                </pre>
                {hasMore && (
                  <button
                    onClick={() => setShowFullPreview((v) => !v)}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 border-t transition-colors"
                  >
                    {showFullPreview ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Show {allLines.length - PREVIEW_LINES} more lines
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : null}
          </div>

          <Separator />

          {/* Tags */}
          {skill.tags && skill.tags.length > 0 && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Tags
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skill.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs capitalize">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Version history */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Version History
              </span>
            </div>
            <div className="space-y-1.5">
              {skill.history?.slice().reverse().map((v) => (
                <div
                  key={v.version}
                  className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-primary">v{v.version}</span>
                    {v.label && (
                      <span className="text-muted-foreground truncate max-w-[180px]">{v.label}</span>
                    )}
                  </div>
                  <span className="text-muted-foreground flex-shrink-0">
                    {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-primary">
                    v{skill.current_version ?? 1}
                  </span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">current</Badge>
                </div>
                <span className="text-muted-foreground">
                  {formatDistanceToNow(new Date(skill.updatedAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Access control */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Access Control
                </span>
              </div>
              {hasWriteAccess && !editingAccess && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1 px-2"
                  onClick={() => setEditingAccess(true)}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
              )}
              {editingAccess && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs gap-1 px-2 text-destructive hover:text-destructive"
                    onClick={() => {
                      setEditingAccess(false);
                      setPendingRbac(null);
                    }}
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 text-xs gap-1 px-2"
                    onClick={handleSaveAccess}
                    disabled={savingAccess || !pendingRbac}
                  >
                    {savingAccess ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="h-3 w-3" />
                    )}
                    Save
                  </Button>
                </div>
              )}
            </div>

            {!editingAccess ? (
              <div className={`flex items-center gap-2 text-sm font-medium ${rightsCfg.color}`}>
                <RightsIcon className="h-4 w-4" />
                <span>{rightsCfg.label}</span>
              </div>
            ) : (
              <div className="pt-1">
                <RBACControl
                  modalMode
                  initialRightsMode={skill.rights_mode as any}
                  initialUsers={skill.RBAC?.users ?? []}
                  initialRoles={skill.RBAC?.roles ?? []}
                  onChange={(rights_mode, users, roles) =>
                    setPendingRbac({ rights_mode, users, roles })
                  }
                />
              </div>
            )}
          </div>

          {/* Stats */}
          <Separator />
          <div className="flex gap-4">
            <div className="text-center">
              <p className="text-lg font-bold">{versionCount}</p>
              <p className="text-xs text-muted-foreground">Versions</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold">{skill.usage_count ?? 0}</p>
              <p className="text-xs text-muted-foreground">Uses</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
