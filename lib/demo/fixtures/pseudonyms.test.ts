import { describe, expect, it } from "vitest";

import { originalIn, pseudonymise } from "./pseudonyms";

describe("pseudonymise", () => {
  it("renames NEW Lift's controller family, longest token first", () => {
    expect(pseudonymise("FST-2XT, FST-2, FST-3 und die FST")).toBe("KS-2XT, KS-2, KS-3 und die KS");
    expect(pseudonymise("Nothalt COP im FST-Fehlerspeicher")).toBe("Nothalt COP im KS-Fehlerspeicher");
    expect(pseudonymise("FST-2XT-Parameter, FST3, FST2XT")).toBe("KS-2XT-Parameter, KS3, KS2XT");
  });

  it("renames file names where the token follows an underscore or a prefix", () => {
    expect(pseudonymise("mia_fst2-2s_2015-05_de.pdf")).toBe("mia_ks2-2s_2015-05_de.pdf");
    expect(pseudonymise("br_FST-2XT_2019-10_de.pdf")).toBe("br_KS-2XT_2019-10_de.pdf");
    expect(pseudonymise("hb_FST-2XT-MRL_2013-11_de.pdf")).toBe("hb_KS-2XT-MRL_2013-11_de.pdf");
    expect(pseudonymise("FST2XTchanges-customer-DE.docx")).toBe("KS2XTchanges-customer-DE.docx");
    expect(pseudonymise("FSTBugFixes.docx")).toBe("KSBugFixes.docx");
    expect(pseudonymise("FST-FSM2-changes-customer-EN.docx")).toBe("KS-SM2-changes-customer-EN.docx");
    expect(pseudonymise("MIPA_FST-3_DE.pdf")).toBe("MIPA_KS-3_DE.pdf");
    expect(pseudonymise("fst2xt-fahrkurve")).toBe("ks2xt-fahrkurve");
    expect(pseudonymise("EAZTFT-110_changes.doc, EAZ-TFT.110_Neuron_Changes.docx")).toBe("DPTFT-110_changes.doc, DP-TFT.110_Neuron_Changes.docx");
  });

  it("leaves industry terms and longer words alone", () => {
    for (const s of ["ADM, SHK, UCM", "LSU (Laufzeitüberwachung)", "MIPA", "CAN-to-LON_DE.pdf", "TC221811", "DISABLED", "Festplatte", "ALGI_AGENT_ID", "ALFREDO_2"]) {
      expect(pseudonymise(s), s).toBe(s);
    }
  });

  it("renames ALGI's cylinders, seal kits, article numbers and company", () => {
    expect(pseudonymise("AZKBZ 110, AZK-110, AZK 110, AZK 90 bis AZK 350")).toBe("HKB 110, HK-110, HK 110, HK 90 bis HK 350");
    expect(pseudonymise("DISA-T-AZK-110, DISA-SAZK-110, DISA-AZ-110-KDD, DISA-HAZ-120-KDD, DISA-AZR-50, DISA-AZM-70, DISA-AZK-110-RILLEN"))
      .toBe("DS-T-HK-110, DS-SHK-110, DS-HA-110-KDD, DS-HHA-120-KDD, DS-HR-50, DS-HM-70, DS-HK-110-RILLEN");
    expect(pseudonymise("Art.Nr. 118112, 113139 und 134466; Commission No. G47490")).toBe("Art.Nr. 418112, 413139 und 434466; Commission No. G58301");
    expect(pseudonymise("AHT Alfred Giehl GmbH & Co. KG, kurz Giehl")).toBe("AHT Hydraulik GmbH, kurz Hydraulik");
    expect(pseudonymise("Mit ALGI den Antrieb neu eingestellt; ⟨ALGI Vertrieb⟩")).toBe("Mit AHT den Antrieb neu eingestellt; ⟨AHT Vertrieb⟩");
  });

  it("is idempotent", () => {
    const once = pseudonymise("FST-2XT AZKBZ 110 DISA-SAZK-110 118112 Giehl ALGI");
    expect(pseudonymise(once)).toBe(once);
  });
});

describe("originalIn", () => {
  it("names the first original token, and none in pseudonymised text", () => {
    expect(originalIn("Seit Umbau auf neue FST-2XT")).toBe("FST-2XT");
    expect(originalIn("Art.Nr. 134466")).toBe("134466");
    expect(originalIn("DS-T-HK-110, KS-2XT, HKB 110, 434466, AHT Hydraulik GmbH")).toBeNull();
    expect(originalIn("DISABLED budget policy")).toBeNull();
  });
});

import fs from "node:fs";
import path from "node:path";

/** TS with its comments removed, so provenance notes may still say "ALGI". */
const withoutComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const listFiles = (dir: string, keep: (name: string) => boolean): string[] =>
  fs.readdirSync(dir).filter(keep).map((name) => path.join(dir, name));

describe("no original product identifier is left", () => {
  const fixtures = listFiles(path.join(__dirname), (n) => (n.endsWith(".ts") || n.endsWith(".json")) && !n.endsWith(".test.ts") && n !== "pseudonyms.ts");
  const copy = [
    ...listFiles(path.join(__dirname, "..", "chapters"), (n) => n.endsWith(".ts") && !n.endsWith(".test.ts")),
    path.join(__dirname, "..", "scenes.ts"),
    path.join(__dirname, "..", "overlays.ts"),
    path.join(__dirname, "..", "resolvers.ts"),
    path.join(__dirname, "..", "rest-fixtures.ts"),
  ];

  it.each([...fixtures, ...copy].map((f) => [path.relative(path.join(__dirname, ".."), f), f]))("%s", (_name, file) => {
    const raw = fs.readFileSync(file, "utf8");
    const text = file.endsWith(".json") ? raw : withoutComments(raw);
    expect(originalIn(text)).toBeNull();
  });

  it("keeps ALGI out of fixture strings outside the reference chapter", () => {
    for (const file of fixtures) {
      const text = file.endsWith(".json") ? fs.readFileSync(file, "utf8") : withoutComments(fs.readFileSync(file, "utf8"));
      expect(/\bALGI\b/.test(text), path.basename(file)).toBe(false);
    }
  });
});
