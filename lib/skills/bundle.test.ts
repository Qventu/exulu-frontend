import { describe, it, expect } from "vitest";
import {
  zipFiles,
  readSkillMetaFromZip,
  parseFrontmatter,
  isOsJunk,
  validateBundleFiles,
  collectFromFileList,
  type CollectedFile,
} from "./bundle";

const enc = (s: string) => new TextEncoder().encode(s);

describe("parseFrontmatter", () => {
  it("extracts name and description from a --- fenced block", () => {
    const md = "---\nname: my-skill\ndescription: Does a thing\n---\n# Body\n";
    expect(parseFrontmatter(md)).toEqual({ name: "my-skill", description: "Does a thing" });
  });
  it("returns empty object when no frontmatter", () => {
    expect(parseFrontmatter("# just a heading")).toEqual({});
  });
});

describe("isOsJunk", () => {
  it("flags OS junk and .git", () => {
    expect(isOsJunk("__MACOSX/foo")).toBe(true);
    expect(isOsJunk("a/.DS_Store")).toBe(true);
    expect(isOsJunk(".git/config")).toBe(true);
    expect(isOsJunk("SKILL.md")).toBe(false);
  });
});

describe("validateBundleFiles", () => {
  it("requires SKILL.md at the folder root", () => {
    const files: CollectedFile[] = [{ path: "my-skill/SKILL.md", data: enc("---\nname: x\n---\n") }];
    expect(validateBundleFiles(files)).toEqual({ ok: true });
  });
  it("fails when SKILL.md is missing", () => {
    const files: CollectedFile[] = [{ path: "my-skill/other.md", data: enc("x") }];
    const r = validateBundleFiles(files);
    expect(r.ok).toBe(false);
  });
  it("fails when over 500 files", () => {
    const files: CollectedFile[] = [{ path: "s/SKILL.md", data: enc("---\nname: x\n---\n") }];
    for (let i = 0; i < 500; i++) files.push({ path: `s/f${i}.txt`, data: enc("y") });
    const r = validateBundleFiles(files);
    expect(r.ok).toBe(false);
  });
});

describe("collectFromFileList", () => {
  it("uses webkitRelativePath and strips the top folder name", async () => {
    const f = new File([enc("---\nname: x\n---\n")], "SKILL.md");
    Object.defineProperty(f, "webkitRelativePath", { value: "my-skill/SKILL.md" });
    const files = await collectFromFileList([f] as unknown as FileList);
    expect(files).toEqual([{ path: "my-skill/SKILL.md", data: expect.any(Uint8Array) }]);
  });
});

describe("zipFiles + readSkillMetaFromZip round-trip", () => {
  it("zips under a root folder and reads back frontmatter", () => {
    const files: CollectedFile[] = [
      { path: "SKILL.md", data: enc("---\nname: round-trip\ndescription: hi\n---\n# x") },
    ];
    const zip = zipFiles(files, "round-trip");
    expect(readSkillMetaFromZip(zip)).toEqual({ name: "round-trip", description: "hi" });
  });
});
