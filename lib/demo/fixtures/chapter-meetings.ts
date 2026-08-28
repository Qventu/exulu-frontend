import RAW_MEETINGS from "./algi-meetings.json";

/**
 * Chapter 7 — what was said in the room.
 *
 * ALGI records their internal meetings with a bot and keeps the transcripts.
 * Twenty-eight of them, seventeen hours, in ./algi-meetings.json — real
 * titles, durations, languages and statuses, and nothing else. See
 * scripts/build-algi-meetings-fixture.py for what was dropped and why.
 *
 * THE TRANSCRIPT IS THE PROBLEM, NOT THE PRODUCT.
 *
 * The obvious chapter would put a transcript on screen as the artifact. Having
 * read one — 346 segments, 3,900 words, seven speakers — that would have been
 * a mistake twice over. It names customers and staff on nearly every page; and
 * 43% of its segments are three words or fewer, because that is how six people
 * in a room actually talk. Shown at length it makes the transcription look
 * poor when the transcription is fine.
 *
 * So the messiness is the setup, not the payoff. The excerpt below is
 * deliberately short and deliberately raw — interruptions and half-sentences
 * intact — and the finished work instruction underneath is what the chapter is
 * actually for.
 *
 * ON THE REDACTION IN THIS FILE. It was done by reading, not by pattern. An
 * earlier pass picked this passage automatically because it contained none of
 * the names on a list; reading it showed three customers the list did not know
 * about, one of them a household name. Free text does not redact by allowlist.
 */

export interface MeetingRecording {
  id: string;
  title: string;
  status: string;
  language: string | null;
  duration_seconds: number | null;
  createdAt: string;
  updatedAt: string;
  source: string;
  bot_status: string | null;
}

export const ALGI_MEETINGS = RAW_MEETINGS as MeetingRecording[];

/** The production meeting chapter 7 opens: Bausatz Kabine, 30 minutes. */
export const ALGI_MEETING_ID = "000cf053-e361-47b2-8f53-536ff29d912d";

/**
 * Nine consecutive segments from 25:20, verbatim except that the four speakers
 * are replaced by their function and three customer names by ⟨Kunde⟩.
 *
 * Kept ugly on purpose. The overlaps, the "6, 8." with no sentence around it,
 * the sentence that starts in one turn and finishes two turns later — all of
 * that is what a real recording sounds like, and the chapter's argument
 * depends on the reader believing nobody could usefully read this.
 */
export const TRANSCRIPT_EXCERPT: Array<{
  at: string;
  speaker: string;
  text: string;
}> = [
  { at: "25:20", speaker: "Arbeitsvorbereitung", text: "ich noch im Anschluss. Okay," },
  { at: "25:22", speaker: "Geschäftsführung", text: "weil der wird ja" },
  { at: "25:22", speaker: "Arbeitsvorbereitung", text: "die Freigabe ist jetzt da." },
  {
    at: "25:23",
    speaker: "Geschäftsführung",
    text:
      "dann, die Freigabe ist da und dann können wir den irgendwann hinter den ⟨Kunde⟩ setzen. Also ich glaube jetzt nicht, dass wir dann beim ⟨Kunde⟩, wenn nicht, ist halt mal ein, zwei Wochen. Das wird alles noch vertretbar sein. Wir dürfen dann nur nicht in 3 Wochen Verzug kommen, Aber ich glaube, das sollten wir halten. Okay, also ist dann offen bekannt zu geben, bis wann diese drei Kabinen dann eingeplant sind und ⟨Kunde⟩ die technische Klärung, Was ist da jetzt noch offen? Kriegen wir? Haben wir da eine Antwort?",
  },
  {
    at: "26:17",
    speaker: "Konstruktion",
    text:
      "Ganz kurz zusammengefasst, die Kabinen haben keine Tür, deswegen haben wir uns um die Belüftung keine Gedanken gemacht. Das stimmt aber nicht, weil der Spalt vorne und hinten halt doch zu eng ist für diese riesen Kabine. Und obwohl die Kabine keine Türen hat, müssen wir auf einmal jetzt doch Lüftungen reinmachen und das müssen wir uns halt jetzt noch freigeben lassen.",
  },
  {
    at: "26:41",
    speaker: "Geschäftsführung",
    text:
      "Gut, was ist mit dem Premium? Haben wir da eine Freigabezeichnung schon was bekommen von dem Premium oder Weil das wird dann alles ziemlich eng. Da sehe ich für die Fertigung, da müssen wir irgendwann nächste Woche in Aktion treten mit dem Vertrieb und müssen mit den Kunden sprechen. Da müssen wir den Premium wahrscheinlich nach hinten schieben.",
  },
  { at: "27:11", speaker: "Konstruktion", text: "Premium ist freigegeben," },
  { at: "27:14", speaker: "Fertigung", text: "6, 8." },
  { at: "27:15", speaker: "Konstruktion", text: "geklärt, Tableaus geklärt, freigegeben, Alles" },
];

/**
 * THE ONE ARTEFACT IN THIS TOUR THAT THE PRODUCT DID NOT PRODUCE.
 *
 * Everything else the visitor sees came out of a real deployment. This did
 * not: /transcriptions exposes RunTranscriptPostProcessing(id, prompt, agent),
 * so the capability is real and shipped — ALGI simply has not used it, and
 * `post_processing_outputs` is null on all twenty-eight recordings.
 *
 * Rather than leave the chapter without a payoff, this was written by hand
 * FROM the transcript above and the surrounding conversation. It is accurate
 * to what was discussed and it is not machine output. The tour copy says so
 * in as many words; a demo that has been this careful about provenance for six
 * chapters should not start blurring it in the seventh.
 *
 * Replace this the moment ALGI runs post-processing on any recording.
 */
export const GENERATED_GUIDE = {
  title: "Freigabeprozess Kabinen-Bausatz",
  subtitle:
    "Arbeitsanweisung, erzeugt aus: Produktionsbesprechung Bausatz Kabine",
  illustrative: true,
  sections: [
    {
      heading: "1. Freigabe prüfen",
      body: "Vor der Einplanung eines Kabinen-Bausatzes muss die Freigabezeichnung vorliegen. Liegt sie vor, wird der Bausatz in die Fertigungsreihenfolge aufgenommen. Ein Verzug von ein bis zwei Wochen ist vertretbar; ab drei Wochen ist die Einplanung mit der Geschäftsführung abzustimmen.",
    },
    {
      heading: "2. Belüftung: nicht von der Tür ableiten",
      body: "Türlose Kabinen brauchen nicht automatisch keine Belüftung. Bei großen Kabinen ist der Spalt vorne und hinten zu eng, um ausreichend Luftaustausch sicherzustellen — in diesem Fall sind Lüftungen vorzusehen und gesondert freigeben zu lassen. Die Türsituation allein ist kein Freigabekriterium.",
    },
    {
      heading: "3. Varianten getrennt verfolgen",
      body: "Premium-Ausführungen laufen mit eigener Freigabezeichnung. Ist die Fertigungskapazität knapp, wird die Premium-Variante nach hinten geschoben — vorher ist der Vertrieb einzubinden, damit der Kunde den neuen Termin vor der Umplanung erfährt.",
    },
    {
      heading: "4. Offene Punkte benennen",
      body: "Am Ende der Besprechung wird für jede Kabine festgehalten, bis wann sie eingeplant ist und welche technische Klärung noch offen ist. Tableaus und Freigaben werden einzeln bestätigt, nicht gesammelt.",
    },
  ],
};

/** Total recorded time, for the chapter's opening line. */
export const ALGI_MEETING_HOURS = Math.round(
  ALGI_MEETINGS.reduce((sum, m) => sum + (m.duration_seconds ?? 0), 0) / 3600,
);
