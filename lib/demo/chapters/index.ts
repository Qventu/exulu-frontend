import type { DemoChapter } from "../tour";
import { datenChapter } from "./daten";
import { strukturChapter } from "./struktur";
import { aufnahmeChapter } from "./aufnahme";
import { zugriffChapter } from "./zugriff";
import { techdocChapter } from "./techdoc";
import { memoryChapter } from "./memory";
import { ingestionChapter } from "./ingestion";
import { configChapter } from "./config";
import { evalsChapter } from "./evals";
import { emailChapter } from "./email";
import { meetingsChapter } from "./meetings";
import { contactChapter } from "./contact";

/**
 * The tour, in order. One module per chapter because this list is about to
 * carry twelve chapters of structured content — it was already 490 lines in
 * tour.ts as nine chapters of strings.
 *
 * ORDER IS LOAD-BEARING. The memory chapter's fixture is a correction
 * exchange, and a correction needs an answer to correct: it must follow the
 * chat chapter. chapters/index.test.ts asserts that.
 */
export const CHAPTERS: DemoChapter[] = [
  datenChapter,
  strukturChapter,
  aufnahmeChapter,
  zugriffChapter,
  techdocChapter,
  memoryChapter,
  ingestionChapter,
  configChapter,
  evalsChapter,
  emailChapter,
  meetingsChapter,
  contactChapter,
];
