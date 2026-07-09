import { describe, it, expect } from "vitest";
import { unzipSync } from "fflate";
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
  it("uses webkitRelativePath and keeps the full relative path including the top folder name", async () => {
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

describe("folder upload integration: rooted paths produce single-wrapper zip", () => {
  it("zips already-rooted paths verbatim so backend finds SKILL.md at single depth", () => {
    // Simulate what collectFromFileList returns from a webkitdirectory picker:
    // paths already include the top folder name ("my-skill/...").
    const skillMd = "---\nname: my-skill\ndescription: Integration test skill\n---\n# Body\n";
    const collected: CollectedFile[] = [
      { path: "my-skill/SKILL.md", data: enc(skillMd) },
      { path: "my-skill/references/x.md", data: enc("# reference") },
    ];

    // 1. validateBundleFiles must pass with rooted paths.
    expect(validateBundleFiles(collected)).toEqual({ ok: true });

    // 2. zipFiles with no rootFolder prefix keeps paths as-is.
    const zip = zipFiles(collected);
    const entries = unzipSync(zip);
    const keys = Object.keys(entries);

    // Must contain the single-wrapper path.
    expect(keys).toContain("my-skill/SKILL.md");
    // Must NOT be double-nested — the old bug produced "my-skill/my-skill/SKILL.md".
    expect(keys).not.toContain("my-skill/my-skill/SKILL.md");

    // 3. readSkillMetaFromZip must extract frontmatter from the correctly
    //    single-wrapped archive (this was also broken with the double nesting).
    const meta = readSkillMetaFromZip(zip);
    expect(meta.name).toBe("my-skill");
    expect(meta.description).toBe("Integration test skill");
  });
});
