import { describe, expect, it } from "vitest";

import {
  CREATE_CONTEXT_FOLDER,
  DELETE_CONTEXT_FOLDER,
  GET_CONTEXT_FOLDERS,
  UPDATE_CONTEXT_FOLDER,
} from "@/app/(application)/data/queries";

import {
  runDemoMutationThroughCache as mutate,
  runDemoQueryThroughCache as query,
} from "./test-support";

/**
 * The knowledge folders in the demo (chapter 2's /data page).
 *
 * The demo user is a super admin, so the tour shows "Manage folders" and a
 * visitor can create one with a stray click. Unmapped, the mutations resolved
 * to `{}` and the folder never appeared — so these four operations are
 * answered from an in-memory list that starts empty.
 *
 * Both tests run the product's own documents through a real cache (a field the
 * dialog selects and the resolver omits is a console error on the screen the
 * visitor just clicked Save on), and the lifecycle test deletes what it
 * created, so neither depends on the other's order.
 */

type Folder = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  context_ids: string[];
};

async function listFolders(): Promise<Folder[]> {
  const data = await query(GET_CONTEXT_FOLDERS);
  return (data.context_foldersPagination as { items: Folder[] }).items;
}

describe("demo knowledge folders", () => {
  it("starts empty, so the demo Knowledge page renders exactly as before", async () => {
    expect(await listFolders()).toEqual([]);
  });

  it("creates, edits and deletes a folder through the dialog's own documents", async () => {
    const created = await mutate(CREATE_CONTEXT_FOLDER, {
      input: {
        name: "Angebote",
        description: "Alles, worauf wir bieten",
        icon: "books",
        sort_order: 2,
      },
    });
    const folder = (created.context_foldersCreateOne as { item: Folder }).item;
    expect(folder.id).toBeTruthy();
    expect(folder.name).toBe("Angebote");
    expect(folder.description).toBe("Alles, worauf wir bieten");
    expect(folder.icon).toBe("books");
    expect(folder.sort_order).toBe(2);
    // A new folder holds nothing until a context is moved into it.
    expect(folder.context_ids).toEqual([]);

    expect(await listFolders()).toEqual([folder]);

    const updated = await mutate(UPDATE_CONTEXT_FOLDER, {
      id: folder.id,
      input: { name: "Tender", context_ids: ["demo-context-1"] },
    });
    const after = (updated.context_foldersUpdateOneById as { item: Folder })
      .item;
    expect(after.name).toBe("Tender");
    expect(after.context_ids).toEqual(["demo-context-1"]);
    // Untouched fields survive the merge.
    expect(after.icon).toBe("books");
    expect(await listFolders()).toEqual([after]);

    const removed = await mutate(DELETE_CONTEXT_FOLDER, { id: folder.id });
    expect((removed.context_foldersRemoveOneById as { id: string }).id).toBe(
      folder.id,
    );
    expect(await listFolders()).toEqual([]);
  });
});
