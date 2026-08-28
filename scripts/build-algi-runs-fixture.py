#!/usr/bin/env python3
"""
Builds lib/demo/fixtures/algi-runs.json from a read-only export of the ALGI
deployment's routine runs.

Kept in the repo rather than run ad hoc so the redaction is auditable: what was
removed, and why, is reviewable in the same diff as the fixture it produced.

WHAT IS REDACTED, AND WHY
  ALGI consented to their own data appearing in the demo. Their CUSTOMERS did
  not. The email subjects name several — a railway operator, a museum, a street
  address, a distributor — along with those customers' own ticket references.
  Each is replaced with a bracketed placeholder that keeps the sentence shape,
  so a reader still sees a real enquiry rather than a blanked-out line.

WHAT IS DELIBERATELY KEPT
  ALGI's own quote numbers, part numbers and enquiry numbers: theirs to show,
  and they are what makes the screen read as real traffic rather than lorem
  ipsum. The sender DOMAIN is kept because the trigger's allowlist rule is
  *@algi-hydraulic.de — redact the domain and the mechanism stops
  demonstrating. Individual staff mailboxes are replaced by role addresses,
  preserving the number of distinct senders so the per-sender rate limit
  (10/hour) still reads correctly.

Inputs are psql exports (see the header of each loop for the query shape).
"""

import json
import os
import re
import sys

RUNS_EXPORT = "/tmp/algi-runs.txt"     # id|state|trigger_metadata|session
TIMES_EXPORT = "/tmp/algi-times.txt"   # id|createdAt|tries
OUT = "lib/demo/fixtures/algi-runs.json"

# Each entry names a third party: a customer, a customer's site, or a
# customer's own ticketing reference.
SUBJECT_REDACTIONS = [
    (r"ÖBB Bruck/\s*Mur", "⟨Kunde⟩"),
    (r"National Gallery", "⟨Kunde⟩"),
    # Matches the whole address, not its opening words. The first version of
    # this rule was `Brückner Str\.?` and it left "aße 1, 96146 Altendorf"
    # standing — the street number, postcode and town all survived, and the
    # BANNED check below still passed because the word "Brückner" was gone.
    # A partial redaction reads as a complete one, which is worse than none.
    (r"[A-ZÄÖÜ][\wäöüß.-]*\s*(?:Str\.|Straße|Strasse|str\.|straße)\s*\d*[a-z]?", "⟨Adresse⟩"),
    # Postcode + town, as a net for any address the rule above starts too late
    # to catch. German postcodes are five digits; part numbers in these
    # subjects are longer or carry letters, so this does not eat them.
    (r"\b\d{5}\s+[A-ZÄÖÜ][\wäöüß.-]+(?:\s+[A-ZÄÖÜ][\wäöüß.-]+)?", "⟨Ort⟩"),
    # NOT redacted, and worth recording why: "Giehl" was on this list until the
    # email signatures showed the company is "ALGI Alfred Giehl GmbH & Co. KG".
    # It is ALGI's own name, so "Giehl Nummer" is their internal reference —
    # redacting it turned a sentence about ALGI's own paperwork into one about
    # a mystery customer. Over-redaction is the safer failure, but it is still
    # a failure, and one that only surfaced by reading the underlying data.
    (r"Requestor Case#\s*ESM-[0-9A-Za-z-]+", "Requestor Case# ⟨Vorgang⟩"),
    (r"BSC Case#\s*ESM-[0-9A-Za-z-]*", "⟨Kunde⟩ Case# ⟨Vorgang⟩"),
]

# Asserted absent from the output. A redaction that silently stops matching —
# because a subject was reworded upstream — is the failure this catches.
BANNED = ["ÖBB", "National Gallery", "Brückner", "BSC", "ESM-", "Altendorf", "96146", "traße", "Str."]

ROLES = ["vertrieb", "service", "ersatzteile", "technik", "info"]


def load_times():
    times = {}
    if not os.path.exists(TIMES_EXPORT):
        return times
    for line in open(TIMES_EXPORT):
        parts = line.rstrip("\n").split("|")
        if len(parts) >= 3 and parts[0]:
            times[parts[0]] = {"createdAt": parts[1], "tries": parts[2]}
    return times


def main():
    times = load_times()
    sender_map = {}
    out = []

    for line in open(RUNS_EXPORT):
        line = line.rstrip("\n")
        if not line.strip():
            continue
        head = line.split("|", 2)
        if len(head) < 3:
            continue
        run_id, state, rest = head
        # trigger_metadata is JSON and may itself contain "|", so take the
        # session off the RIGHT rather than splitting left-to-right.
        meta, _, session = rest.rpartition("|")
        try:
            m = json.loads(meta) if meta.strip() else {}
        except json.JSONDecodeError:
            m = {}

        subject = m.get("subject") or ""
        for pattern, replacement in SUBJECT_REDACTIONS:
            subject = re.sub(pattern, replacement, subject)

        sender = (m.get("from") or "").strip("<> ")
        if "@" in sender:
            _local, domain = sender.rsplit("@", 1)
            if sender not in sender_map:
                sender_map[sender] = (
                    f"{ROLES[len(sender_map) % len(ROLES)]}@{domain}"
                    if domain == "algi-hydraulic.de"
                    else f"noreply@{domain}"
                )
            sender = sender_map[sender]

        stamp = times.get(run_id, {})
        try:
            tries = int(float(stamp.get("tries") or 1))
        except ValueError:
            tries = 1

        metadata = {"from": sender, "subject": subject}
        if m.get("filtered_reason"):
            metadata["filtered_reason"] = m["filtered_reason"]

        out.append({
            "id": run_id,
            "state": state,
            "trigger": "email",
            "session": session or None,
            "tries": tries,
            "createdAt": stamp.get("createdAt", ""),
            "trigger_metadata": metadata,
        })

    blob = json.dumps(out, ensure_ascii=False)
    for token in BANNED:
        if token in blob:
            sys.exit(f"FAILED: third-party identifier survived redaction: {token}")
    if "@algi-hydraulic.de" not in blob:
        sys.exit("FAILED: sender domain lost — the allowlist rule stops demonstrating")

    with open(OUT, "w") as handle:
        json.dump(out, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    states = {}
    for run in out:
        states[run["state"]] = states.get(run["state"], 0) + 1
    print(f"wrote {OUT}: {len(out)} runs")
    print("states:", states)
    print("senders shipped:", sorted({r["trigger_metadata"]["from"] for r in out}))
    print("redaction assertions passed")


if __name__ == "__main__":
    main()
