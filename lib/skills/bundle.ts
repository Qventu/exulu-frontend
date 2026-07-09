import { zipSync, unzipSync, strFromU8 } from "fflate";

export type CollectedFile = { path: string; data: Uint8Array };

const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_ENTRIES = 500;

export function isOsJunk(path: string): boolean {
  if (path.startsWith("__MACOSX/")) return true;
  if (path === ".git" || path.startsWith(".git/") || path.includes("/.git/")) return true;
  const base = path.split("/").pop() ?? "";
  return base === ".DS_Store" || base === "Thumbs.db" || base === "desktop.ini";
}

export function parseFrontmatter(md: string): Record<string, string> {
  // Only the leading --- fenced block; simple `key: value` scalar lines.
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!match) return {};
  const out: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

// Detect a single top-level wrapper folder shared by every path, matching the
// backend extractor's unwrap so "SKILL.md at root" is checked consistently.
function stripWrapper(paths: string[]): (p: string) => string {
  const heads = new Set(paths.map((p) => p.split("/")[0]).filter(Boolean));
  if (heads.size === 1) {
    const head = [...heads][0] + "/";
    if (paths.every((p) => p.startsWith(head))) return (p) => p.slice(head.length);
  }
  return (p) => p;
}

// From an <input webkitdirectory> FileList: each File carries a
// webkitRelativePath like "folder/sub/file"; we keep that as the entry path.
export async function collectFromFileList(list: FileList | File[]): Promise<CollectedFile[]> {
  const files: CollectedFile[] = [];
  for (const file of Array.from(list as ArrayLike<File>)) {
    const rel = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    if (isOsJunk(rel)) continue;
    files.push({ path: rel, data: new Uint8Array(await file.arrayBuffer()) });
  }
  return files;
}

export function validateBundleFiles(
  files: CollectedFile[],
): { ok: true } | { ok: false; error: string } {
  const clean = files.filter((f) => !isOsJunk(f.path));
  if (clean.length === 0) return { ok: false, error: "Folder is empty." };
  if (clean.length > MAX_ENTRIES)
    return { ok: false, error: `Too many files (${clean.length} > ${MAX_ENTRIES}).` };
  let total = 0;
  for (const f of clean) total += f.data.byteLength;
  if (total > MAX_TOTAL_BYTES)
    return { ok: false, error: "Folder exceeds 50 MB uncompressed." };
  const strip = stripWrapper(clean.map((f) => f.path));
  const hasSkillMd = clean.some((f) => strip(f.path) === "SKILL.md");
  if (!hasSkillMd) return { ok: false, error: "Folder must contain a SKILL.md at its root." };
  return { ok: true };
}

export function zipFiles(files: CollectedFile[], rootFolder: string): Uint8Array {
  const tree: Record<string, Uint8Array> = {};
  for (const f of files) {
    if (isOsJunk(f.path)) continue;
    tree[`${rootFolder}/${f.path}`] = f.data;
  }
  return zipSync(tree, { level: 6 });
}

export function readSkillMetaFromZip(
  zipBytes: Uint8Array,
): { name?: string; description?: string } {
  try {
    const entries = unzipSync(zipBytes);
    const paths = Object.keys(entries).filter((p) => !p.endsWith("/") && !isOsJunk(p));
    const strip = stripWrapper(paths);
    const skillPath = paths.find((p) => strip(p) === "SKILL.md");
    if (!skillPath) return {};
    const fm = parseFrontmatter(strFromU8(entries[skillPath]));
    return { name: fm.name, description: fm.description };
  } catch {
    return {};
  }
}
