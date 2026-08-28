#!/usr/bin/env python3
"""
Redacts the ALGI "Ersatzteil Angebot" session that chapter 6 is built on, and
reports every line it changed.

Run with --report to print the before/after without writing anything. That is
the mode to read before approving: the previous redaction in this repo shipped
a street address because the review truncated at 58 characters, so nothing here
truncates.

THE THREE CATEGORIES

  1. THE CUSTOMER — a named individual at a named company, with their address,
     phone, email and a recruitment link. A third party who was never asked.
     Redacted unconditionally; there is no argument for shipping it.

  2. ALGI'S OWN STAFF — two employees appear by full name and address, one as
     the forwarder and one on cc. ALGI consented to their company's data being
     shown; an individual's name is still personal data, and a sales rep did
     not personally agree to appear in a lead-generation demo. Replaced with
     role addresses by default, matching what the runs fixture already does
     for senders. Set KEEP_STAFF_NAMES = True to leave them.

  3. ALGI'S COMMERCIAL DATA — article numbers, type designations, the
     commission number and unit prices. Theirs to show, and the substance of
     what the chapter demonstrates: without prices the quote is a shell. Kept
     by default. Set REDACT_PRICES = True to blank the figures instead.
"""

import json
import re
import sys

SOURCE = "/tmp/algi-session.json"
OUT = "lib/demo/fixtures/algi-session.json"

KEEP_STAFF_NAMES = False
REDACT_PRICES = False

# --- 1. the customer ---------------------------------------------------------
CUSTOMER = [
    (r"Miquel@Variolift\.com", "einkauf@kunde-beispiel.nl"),
    (r"Miquel Alfarez", "⟨Kundenkontakt⟩"),
    (r"Miquel", "⟨Kundenkontakt⟩"),
    (r"Vario\s?[Ll]ift\s*(?:BV|b\.v\.|B\.V\.)?", "⟨Kundenfirma⟩"),
    (r"Variolift", "⟨Kundenfirma⟩"),
    (r"Joh\.\s*Enschedeweg\s*[\d-]+", "⟨Adresse⟩"),
    (r"\b1422\s*DR\s*Uithoorn\b", "⟨Ort⟩"),
    (r"https?://variolift\.com\S*", "⟨URL⟩"),
    # The "+" arrives HTML-encoded as &#43;, so it has to be part of the
    # pattern — matching only the digits leaves "Tel: &#43;⟨Telefon⟩" on screen.
    (r"(?:&#43;|\+)?\s*31\(?0\)?\s*\d[\d\s]{6,}", "⟨Telefon⟩"),
]

# The Dutch confidentiality footer is the customer's own legal boilerplate and
# names them twice more. It is noise in the demo and risk in the bundle, so the
# whole block goes rather than being picked at word by word.
DISCLAIMER = re.compile(
    r"E-mail disclaimer\s*Deze e-mail.*?van deze e-mail\.", re.S | re.I
)

# --- 2. ALGI staff -----------------------------------------------------------
STAFF = [
    (r"Bastian\.Kempenich@algi-hydraulic\.de", "vertrieb@algi-hydraulic.de"),
    (r"Kempenich,\s*Bastian", "⟨ALGI Vertrieb⟩"),
    (r"Sabrina Maurer", "⟨ALGI Vertrieb⟩"),
]

# --- 3. prices ---------------------------------------------------------------
PRICES = [(r"\b(?:Price|Preis):\s*\d+(?:[.,]\d+)?\s*(?:EUR)?", "Price: ⟨Preis⟩")]

# Asserted absent afterwards. Spelling variants included on purpose: the last
# redaction bug in this repo was a rule that matched one form of a name and
# missed the rest of the string.
BANNED = [
    "Miquel", "Alfarez", "Variolift", "Vario Lift", "Vario lift",
    "Enschedeweg", "Uithoorn", "variolift.com",
    "Sabrina", "Maurer", "Kempenich", "Bastian",
]


def redact(text: str) -> str:
    text = DISCLAIMER.sub("⟨Haftungsausschluss des Absenders entfernt⟩", text)
    rules = list(CUSTOMER)
    if not KEEP_STAFF_NAMES:
        rules += STAFF
    if REDACT_PRICES:
        rules += PRICES
    for pattern, replacement in rules:
        text = re.sub(pattern, replacement, text)
    return text


def walk(node):
    """Redacts every string in the message tree, including tool inputs/outputs."""
    if isinstance(node, str):
        return redact(node)
    if isinstance(node, list):
        return [walk(v) for v in node]
    if isinstance(node, dict):
        return {k: walk(v) for k, v in node.items()}
    return node


def main() -> None:
    report = "--report" in sys.argv
    messages = [json.loads(l) for l in open(SOURCE) if l.strip()]
    redacted = [walk(m) for m in messages]

    blob = json.dumps(redacted, ensure_ascii=False)
    for token in BANNED:
        if token in blob:
            sys.exit(f"FAILED: identifier survived redaction: {token}")

    if report:
        for i, (before, after) in enumerate(zip(messages, redacted)):
            for b, a in zip(before.get("parts", []), after.get("parts", [])):
                if b.get("type") != "text" or b.get("text") == a.get("text"):
                    continue
                for lb, la in zip(b["text"].split("\n"), a["text"].split("\n")):
                    if lb != la:
                        print(f"msg{i} [{before.get('role')}]")
                        print(f"  - {lb}")
                        print(f"  + {la}")
                        print()
        return

    with open(OUT, "w") as handle:
        json.dump(redacted, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    print(f"wrote {OUT}: {len(redacted)} messages")
    print("redaction assertions passed")


if __name__ == "__main__":
    main()
