import type { DemoChapter } from "../tour";
import { datenChapter } from "./daten";
import { strukturChapter } from "./struktur";
import { aufnahmeChapter } from "./aufnahme";
import { zugriffChapter } from "./zugriff";
import { techdocChapter } from "./techdoc";
import { memoryChapter } from "./memory";
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
 * ORDER IS LOAD-BEARING. The tour runs data-first: the customer's mess of data
 * (daten), structuring it (struktur), ingesting a document (aufnahme) and
 * permissioning it (zugriff) all come before the visitor ever meets the chat.
 * That is deliberate — the chat chapter follows the data chapters on
 * purpose, because by the time it opens, chapter 5's citation is a conclusion
 * the visitor can check against what they just watched arrive, not a claim
 * they have to take on faith.
 *
 * The memory chapter's fixture is a correction exchange, and a correction
 * needs an answer to correct: it must follow the chat chapter.
 * chapters/index.test.ts asserts both orderings.
 */
export const CHAPTERS: DemoChapter[] = [
  datenChapter, //     1 · the problem
  strukturChapter, //  2 · knowledge bases
  aufnahmeChapter, //  3 · ingestion
  zugriffChapter, //   4 · permissions
  techdocChapter, //   5 · the answer — now a payoff, not a claim
  memoryChapter, //    6 · the assistant writes knowledge back
  configChapter, //    7 · configuration
  evalsChapter, //     8 · evidence
  emailChapter, //     9 · unattended work
  meetingsChapter, // 10 · meetings
  // 11 · "Was es kostet" (/analytics + /budgets) is project 3 and lands here.
  contactChapter, // 11 today, 12 once the cost chapter lands
];
