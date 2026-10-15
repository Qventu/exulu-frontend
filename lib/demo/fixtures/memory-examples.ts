import type { Item } from "@/types/models/item";

import { demoItem } from "./item";

/**
 * Sixty EXAMPLE memories for the map in chapter 6 (spec, sub-project 8):
 * what a service team teaches an assistant over eight weeks. Invented, and
 * declared as examples on screen — chapter 6's copy says so, the way chapters
 * 8 and 11 mark their numbers. The four real memories in chapter-memory.ts
 * sit among them. Product identifiers follow the pseudonym scheme (KS-…).
 */
export type MemoryTopic = { id: string; label: string; x: number; y: number; z: number };

export const MEMORY_TOPICS: readonly MemoryTopic[] = [
  { id: "topic-steuerung", label: "Steuerung & Inbetriebnahme", x: -6, y: 2, z: 0 },
  { id: "topic-fehler", label: "Fehlerbilder & Diagnose", x: 6, y: 2, z: 0 },
  { id: "topic-normen", label: "Normen & Prüfung", x: 0, y: -5, z: 3 },
  { id: "topic-ablaeufe", label: "Kunden & Abläufe", x: 0, y: 5, z: -3 },
];

export type MemoryExample = Item & { topic: string };

type Example = [
  day: number,
  topic: 0 | 1 | 2 | 3,
  type: "FACT" | "PREFERENCE" | "INSIGHT",
  name: string,
  information: string,
];

const EXAMPLES: Example[] = [
  [0, 0, "FACT", "KS-2XT Lernfahrt vor Kalibrierfahrt", "Die Lernfahrt muss vor der Kalibrierfahrt abgeschlossen sein, sonst bricht die Kalibrierfahrt mit Meldung 41 ab."],
  [1, 1, "FACT", "Meldung 12 bei Türzonenfehler", "Meldung 12 erscheint, wenn der Türzonenschalter im Stand nicht schließt; zuerst den Magneten am Fahrkorb prüfen."],
  [2, 2, "FACT", "Prüffrist Notrufsystem", "Das Notrufsystem ist alle drei Tage automatisch zu testen; der Test wird im Prüfbuch dokumentiert."],
  [3, 3, "PREFERENCE", "Angebote immer mit Kommissionsnummer", "Ersatzteilangebote tragen die Kommissionsnummer der Anlage im Betreff, damit der Kunde sie zuordnen kann."],
  [4, 0, "FACT", "Parameter P07 Verzögerungsweg", "P07 setzt den Verzögerungsweg in Millimetern; bei Hydraulik typischerweise 900 bis 1200."],
  [5, 1, "INSIGHT", "Sporadischer Nothalt nach Umbau", "Ein sporadischer Nothalt nach Umbau auf KS-2XT lag bisher immer an einer losen Schirmung am CAN-Bus."],
  [6, 2, "FACT", "EN 81-20 Lichtstärke Fahrkorb", "Die Beleuchtungsstärke im Fahrkorb muss mindestens 100 Lux am Boden erreichen, auch bei Notbeleuchtung 5 Lux."],
  [7, 3, "FACT", "Ansprechpartner Kundendienst Nord", "Für Anlagen im Bezirk Nord ist der Kundendienst über die Hotline mit Vorwahl 040 erreichbar, nicht über das Ticketportal."],
  [8, 0, "FACT", "Menüpfad Fehlerspeicher KS-3", "Der Fehlerspeicher der KS-3 liegt unter HAUPTMENUE/Diagnose/Fehlerspeicher; Einträge lassen sich dort einzeln quittieren."],
  [9, 1, "FACT", "Meldung 27 Überlast", "Meldung 27 bedeutet Überlast; vor dem Quittieren die Lastmessung kalibrieren, sonst kehrt die Meldung zurück."],
  [10, 2, "FACT", "Prüfung Fangvorrichtung", "Die Fangvorrichtung ist bei der Hauptprüfung mit Prüflast zu testen; das Protokoll gehört in die Anlagenakte."],
  [11, 3, "PREFERENCE", "Antworten an Techniker kurz halten", "Techniker im Einsatz wollen den Menüpfad und den Parameterwert, keine Einleitung."],
  [12, 0, "FACT", "KS-2 Softwarestand ablesen", "Der Softwarestand der KS-2 steht unter HAUPTMENUE/Info/Version; für Updates ist V2.19 der Mindeststand."],
  [13, 1, "INSIGHT", "Türfehler bei Kälte", "Türfehler in den Wintermonaten häufen sich bei Anlagen mit Außenschacht; die Türmotorparameter um 10 Prozent anheben hilft."],
  [14, 2, "FACT", "Dokumentationspflicht Änderungen", "Jede Änderung an sicherheitsrelevanten Parametern wird mit Datum, Wert und Name im Anlagenbuch festgehalten."],
  [15, 3, "FACT", "Ersatzteile Lieferzeit Standard", "Standard-Ersatzteile sind ab Lager in zwei Werktagen verfügbar; Sonderanfertigungen brauchen drei Wochen."],
  [16, 0, "FACT", "Einfahrtweg bei Hydraulik", "Der Einfahrtweg wird bei Hydraulikanlagen über P12 gesetzt und nach jeder Ölwechsel-Wartung geprüft."],
  [17, 1, "FACT", "Meldung 55 Schachtkopiersystem", "Meldung 55 zeigt eine Störung des Schachtkopiersystems; zuerst den Magnetbandsensor auf Verschmutzung prüfen."],
  [18, 2, "FACT", "Wartungsintervall Seile", "Tragseile werden halbjährlich auf Drahtbrüche geprüft; ab zehn Brüchen je Schlaglänge ist der Austausch fällig."],
  [19, 3, "INSIGHT", "Rückfragen zu Angeboten", "Rückfragen kommen fast immer zur Dichtungsgröße; ein Satz zur Zylindergröße im Angebot spart die Rückfrage."],
  [20, 0, "FACT", "Kalibrierfahrt Dauer", "Eine Kalibrierfahrt über zehn Haltestellen dauert etwa vier Minuten; vorher alle Türen schließen."],
  [21, 1, "FACT", "Meldung 08 Phasenfolge", "Meldung 08 meldet eine falsche Phasenfolge; zwei Phasen am Hauptschalter tauschen, nicht am Umrichter."],
  [22, 2, "FACT", "Prüfbuch Aufbewahrung", "Das Prüfbuch verbleibt an der Anlage und wird mindestens zehn Jahre aufbewahrt."],
  [23, 3, "PREFERENCE", "Anrede in Kundenmails", "Kunden der Region Süd werden in Mails förmlich angesprochen; die Vorlage Angebot-Süd verwenden."],
  [24, 0, "FACT", "Parameterreset KS-2XT", "Ein Parameterreset erfolgt über HAUPTMENUE/Konfig/Werkseinstellungen und löscht auch die Lernfahrt."],
  [25, 1, "INSIGHT", "Bündigkeit nach Antriebstausch", "Nach einem Antriebstausch stimmt die Bündigkeit erst nach erneuter Lernfahrt; eine Korrektur über P12 allein reicht nicht."],
  [26, 2, "FACT", "Notbefreiung Unterweisung", "Beauftragte Personen für die Notbefreiung werden jährlich unterwiesen; die Unterweisung wird dokumentiert."],
  [27, 3, "FACT", "Störungsannahme Zeiten", "Störungen außerhalb der Geschäftszeit laufen über die Bereitschaft; Reaktionszeit zwei Stunden."],
  [28, 0, "FACT", "KS-3 Anzeigehelligkeit", "Die Anzeigehelligkeit des DP-TFT wird unter HAUPTMENUE/Anzeige/Helligkeit eingestellt, Werte 1 bis 10."],
  [29, 1, "FACT", "Meldung 33 Übertemperatur", "Meldung 33 zeigt Übertemperatur im Schaltschrank; Lüfterfilter prüfen, bevor der Umrichter getauscht wird."],
  [30, 2, "FACT", "Hauptprüfung Frist", "Die Hauptprüfung ist alle zwei Jahre fällig, die Zwischenprüfung jeweils dazwischen."],
  [31, 3, "INSIGHT", "Angebotsannahme per Mail", "Kunden bestätigen Angebote meist per Antwortmail ohne Unterschrift; das reicht für die Auftragsanlage."],
  [32, 0, "FACT", "Gruppensteuerung Adresse", "In einer Gruppe trägt jede Steuerung eine eindeutige Adresse unter HAUPTMENUE/Konfig/Gruppe; Adresse 0 ist der Master."],
  [33, 1, "FACT", "Meldung 61 Lichtschranke", "Meldung 61 zeigt eine unterbrochene Lichtschranke; nach dem Reinigen den Sender neu ausrichten."],
  [34, 2, "FACT", "Aufzugswärter Aufgaben", "Der Aufzugswärter prüft wöchentlich Notruf, Beleuchtung und Türfunktion und trägt das Ergebnis ein."],
  [35, 3, "FACT", "Sammelrechnung Monatsende", "Kunden mit Rahmenvertrag erhalten eine Sammelrechnung zum Monatsende, keine Einzelrechnungen."],
  [36, 0, "PREFERENCE", "Menüpfade immer vollständig", "Menüpfade werden immer vollständig ab HAUPTMENUE angegeben, nicht nur der letzte Punkt."],
  [37, 1, "INSIGHT", "Wiederkehrende Meldung 12", "Kehrt Meldung 12 nach dem Magnetentausch zurück, ist in der Regel das Kabel zum Türzonenschalter gebrochen."],
  [38, 2, "FACT", "Barrierefreiheit Rufknöpfe", "Rufknöpfe sind in 900 bis 1100 mm Höhe anzubringen, taktil erkennbar und mit Kontrast zum Tableau."],
  [39, 3, "FACT", "Zendesk Ticketkategorien", "Tickets werden nach Störung, Wartung und Angebot kategorisiert; Angebote nicht als Störung anlegen."],
  [40, 0, "FACT", "Firmware-Update Ablauf", "Firmware-Updates werden per Speicherkarte eingespielt; vorher die Parameter unter HAUPTMENUE/Konfig/Sichern exportieren."],
  [41, 1, "FACT", "Meldung 19 Fahrzeitüberschreitung", "Meldung 19 bedeutet Fahrzeitüberschreitung; die Laufzeitüberwachung LSU prüft die Fahrzeit zwischen zwei Haltestellen."],
  [42, 2, "FACT", "Schachtbeleuchtung Abstand", "Schachtleuchten sitzen höchstens sieben Meter auseinander, mit je einer Leuchte am Kopf und an der Grube."],
  [43, 3, "INSIGHT", "Zwei Angebotsvarianten", "Kunden wählen schneller, wenn ein Angebot zwei Varianten enthält: Dichtungssatz allein und Satz mit Kolbenring."],
  [44, 0, "FACT", "KS-2XT Anzahl Haltestellen", "Die KS-2XT verwaltet bis zu 32 Haltestellen; darüber ist die KS-3 einzusetzen."],
  [45, 1, "FACT", "Meldung 44 Bremse", "Meldung 44 zeigt eine nicht öffnende Bremse; zuerst den Bremsgleichrichter messen."],
  [46, 2, "FACT", "Prüfung nach Ölwechsel", "Nach einem Ölwechsel an Hydraulikanlagen ist eine Probefahrt mit Prüflast vorgeschrieben."],
  [47, 3, "FACT", "Ersatzteilkatalog Stand", "Der Ersatzteilkatalog gilt in der Fassung vom März; ältere Artikelnummern mit der Umschlüsselungsliste prüfen."],
  [48, 0, "FACT", "Zeitfenster Nachtabsenkung", "Die Nachtabsenkung der Fahrgeschwindigkeit wird unter HAUPTMENUE/Konfig/Zeiten eingestellt."],
  [49, 1, "INSIGHT", "Meldung 27 bei Lastmessung", "Meldung 27 ohne tatsächliche Überlast deutet auf eine verschobene Lastmessung; nach jedem Seiltausch neu kalibrieren."],
  [50, 2, "FACT", "Notruf Zweiwegesprechverbindung", "Der Notruf muss eine Zweiwegesprechverbindung zur ständig besetzten Stelle herstellen und sich selbst prüfen."],
  [51, 3, "PREFERENCE", "Erst Bestand, dann Angebot", "Vor einem Angebot wird der Lagerbestand geprüft; nur lieferbare Positionen anbieten."],
  [52, 0, "FACT", "Türparameter Öffnungszeit", "Die Türöffnungszeit wird unter HAUPTMENUE/Türen/Zeiten eingestellt; Standard sind vier Sekunden."],
  [53, 1, "FACT", "Meldung 70 Umrichter", "Meldung 70 kommt vom Umrichter; der Umrichter-Fehlercode steht im Fehlerspeicher als Zusatzwert."],
  [54, 2, "FACT", "Kennzeichnung Fahrkorb", "Im Fahrkorb sind Tragfähigkeit, Personenzahl und Anlagennummer dauerhaft anzubringen."],
  [55, 3, "INSIGHT", "Anfragen am Montagmorgen", "Die meisten Ersatzteilanfragen kommen am Montagmorgen; die Routine arbeitet sie bis Mittag ab."],
  [56, 0, "FACT", "Sprache der Anzeige", "Die Anzeigesprache wird unter HAUPTMENUE/Anzeige/Sprache gesetzt und gilt für alle Tableaus."],
  [57, 1, "FACT", "Meldung 03 Sicherheitskreis", "Meldung 03 zeigt einen offenen Sicherheitskreis; die Kontakte von der Grube aufwärts prüfen."],
  [58, 2, "FACT", "Prüfung Geschwindigkeitsbegrenzer", "Der Geschwindigkeitsbegrenzer wird bei jeder Hauptprüfung ausgelöst und sein Ansprechwert dokumentiert."],
  [59, 3, "FACT", "Rahmenvertrag Rabattstufen", "Rahmenvertragskunden erhalten die Rabattstufe aus dem Vertrag; die Routine liest sie aus dem Kundenstamm."],
];

const START_MS = Date.parse("2026-07-02T08:00:00.000Z");
/** ~0.85 days apart: sixty entries over fifty-one days, never more than two a day. */
const SPACING_MS = 20.5 * 3_600_000;

export const MEMORY_EXAMPLES: MemoryExample[] = EXAMPLES.map(([day, topic, type, name, information], i) => ({
  ...demoItem({
    id: `demo-memory-${String(i + 1).padStart(3, "0")}`,
    name,
    type,
    information,
    createdAt: new Date(START_MS + day * SPACING_MS).toISOString(),
  }),
  // Not a field the product reads; the map resolver clusters by it.
  topic: MEMORY_TOPICS[topic].id,
}));

/** Deterministic jitter, so the cloud is the same on every build and every reload. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The topic a memory belongs to: its fixture tag, or the nearest by wording for the four real ones. */
export function topicOf(item: Item & { topic?: string }): MemoryTopic {
  if (item.topic) return MEMORY_TOPICS.find((t) => t.id === item.topic) ?? MEMORY_TOPICS[0];
  const text = `${item.name ?? ""} ${(item as { information?: string }).information ?? ""}`;
  if (/Fehler|Meldung|Reset/.test(text)) return MEMORY_TOPICS[1];
  if (/Norm|Prüf|Ticket|Statistic|ELA/.test(text)) return MEMORY_TOPICS[2];
  if (/Kunde|Angebot|Zendesk/.test(text)) return MEMORY_TOPICS[3];
  return MEMORY_TOPICS[0];
}

/** One map point per memory, clustered around its topic's centre. */
export function memoryMapPoints(items: (Item & { topic?: string })[]) {
  return items.map((item, i) => {
    const centre = topicOf(item);
    const rnd = mulberry32(i * 7919 + 17);
    const jitter = () => (rnd() - 0.5) * 4.4;
    return {
      id: `${item.id}-p0`,
      itemId: item.id,
      x: centre.x + jitter(),
      y: centre.y + jitter(),
      z: centre.z + jitter(),
      itemName: item.name ?? "",
      group: (item as { type?: string }).type ?? null,
      chunks: 1,
      createdAtMs: item.createdAt ? Date.parse(item.createdAt) : null,
    };
  });
}
