#!/usr/bin/env python3
"""
Generates the demo illustrations via the OpenAI images API.

Run from the frontend repo root, with the REAL key (not the truncated one from
chat — it must end in ...Dhbd8OEAA):

    export OPENAI_API_KEY='sk-proj-...'
    python3 /tmp/generate-demo-image.py style-test

The HTTP request goes through curl rather than urllib. The python.org build of
Python 3.13 on macOS ships without the system certificate bundle, so urllib
fails every HTTPS handshake with CERTIFICATE_VERIFY_FAILED; curl uses the
system trust store and just works. Nothing else here touches the network.

Prompts live in DEMO_PROMPTS so the house style is defined once and every
image inherits it — regenerating after a prompt edit is then one word, and the
prompt that produced a given file stays in version control beside it.

Writes to public/demo/<name>.png.
"""

import base64
import json
import os
import subprocess
import sys
import tempfile

OUT_DIR = "public/demo"
MODEL = "gpt-image-2"

# The seven chapters are deliberately plain — real German transcripts, a red
# failing eval cell, eight failed email runs. Illustration that competes with
# that undercuts it. So the house style is a technical drawing: the visual
# language of the industry being sold to, not of a marketing site.
STYLE = (
    "Technical schematic line illustration in the style of an engineering "
    "drawing. Thin uniform strokes, no fills, no shading, no gradients. "
    "Monochrome: dark charcoal-grey lines on a fully transparent background "
    "(the drawing is inverted in CSS for dark mode, so the lines must be dark). "
    "Precise, orthographic, diagrammatic. No text, no labels, no lettering, "
    "no numbers anywhere in the image. No people. Generous negative space. "
    "Restrained and clinical rather than decorative."
)

# Fraction of the frame height to keep, centred, before encoding.
#
# The model composes to the frame it is given, and a subject that does not fill
# it leaves dead space. The door row occupies the middle band of a 3:2 frame,
# so at popover height a third of the box was empty and the doors rendered
# smaller than they needed to. Cropping here rather than by hand means
# regenerating the image does not silently lose the crop.
CROP = {
    "structure": 0.45,
}

DEMO_PROMPTS = {
    # One test image to settle the style before generating a set.
    "style-test": (
        "An elevator control cabinet seen from the front, door open, showing "
        "a neat array of circuit boards, terminal strips and wiring ducts. "
        "Cutaway engineering view."
    ),
    # The structure visual: the seven chapters as a hoistway, so the shape of
    # the tour reads as a machine rather than a slide deck.
    # LANDSCAPE BY DESIGN. The first version was a hoistway in cross-section:
    # a good drawing, but a tall subject in a wide frame, and inside a 380px
    # popover it reduced to an unreadable sliver. Seven landing doors in a row
    # says the same thing — seven discrete stages, unmistakably an elevator —
    # in the shape the frame actually is.
    "structure": (
        "Seven identical elevator landing doors in a horizontal row, front "
        "elevation, evenly spaced across the full width of the frame. Each "
        "pair of doors closed, with a call button panel and a floor indicator "
        "above it. A continuous floor line runs beneath all seven. The "
        "leftmost doors stand slightly open."
    ),
    "ch1-answer": (
        "A single elevator control board in flat orthographic view: relays, "
        "terminal blocks, a small seven-segment display module, ribbon cable "
        "headers. One connector picked out with a thin leader line."
    ),
    "ch2-ingestion": (
        "A stack of technical manuals fanned open, with fine lines flowing "
        "from their pages into a grid of small uniform rectangles arranged in "
        "neat rows — documents becoming indexed fragments."
    ),
    "ch3-config": (
        "A control panel of toggle switches and rotary selectors in "
        "orthographic elevation, several rows, some switches up and some "
        "down. Clean instrument-panel geometry."
    ),
    "ch4-memory": (
        "A card-index drawer pulled open in cross-section, one card lifted "
        "slightly proud of the others, fine guide rails inside the drawer."
    ),
    "ch5-evals": (
        "A calibration test rig: a measuring column with graduated tick marks "
        "beside a row of identical specimens on a bench, one specimen marked "
        "with a small cross."
    ),
    "ch6-email": (
        "An envelope entering a mechanical sorting mechanism of rollers and "
        "guide plates in cross-section, with a document emerging from the "
        "far side onto a small tray."
    ),
    "ch7-meetings": (
        "A ceiling-mounted microphone above an empty meeting table in "
        "orthographic elevation, with fine concentric arcs indicating sound, "
        "and a single sheet of paper resting on the table."
    ),
}


def post(payload: dict, key: str) -> dict:
    """POSTs via curl. See the module docstring for why not urllib."""
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as body:
        json.dump(payload, body)
        body_path = body.name
    try:
        result = subprocess.run(
            [
                "curl", "-sS", "--fail-with-body",
                "https://api.openai.com/v1/images/generations",
                "-H", f"Authorization: Bearer {key}",
                "-H", "Content-Type: application/json",
                "--data-binary", f"@{body_path}",
            ],
            capture_output=True,
            text=True,
            timeout=600,
        )
    finally:
        os.unlink(body_path)

    if result.returncode != 0:
        sys.exit(f"request failed:\n{(result.stdout or result.stderr)[:600]}")
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        sys.exit(f"unexpected response:\n{result.stdout[:600]}")


def generate(name: str, size: str) -> None:
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        sys.exit("OPENAI_API_KEY is not set")
    if key.endswith("...") or len(key) < 60:
        sys.exit("OPENAI_API_KEY looks truncated — paste the whole key")
    if name not in DEMO_PROMPTS:
        sys.exit(f"unknown image '{name}'. known: {', '.join(DEMO_PROMPTS)}")

    payload = {
        "model": MODEL,
        "prompt": f"{DEMO_PROMPTS[name]}\n\n{STYLE}",
        "size": size,
        # Transparent so the drawing sits on whatever the app background is,
        # in either theme, instead of a dark rectangle that nearly matches.
        "background": "transparent",
    }
    data = post(payload, key)

    if "data" not in data:
        sys.exit(f"no image in response: {json.dumps(data)[:600]}")

    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, f"{name}.png")
    with open(path, "wb") as handle:
        handle.write(base64.b64decode(data["data"][0]["b64_json"]))
    # 1536px PNGs land at ~1.5 MB each; nine of those is 14 MB of page
    # weight for decoration. WebP at display width is ~45 KB with no visible
    # loss, so the PNG is an intermediate and the WebP is the asset.
    if name in CROP:
        info = subprocess.run(
            ["sips", "-g", "pixelHeight", "-g", "pixelWidth", path],
            capture_output=True, text=True, check=True,
        ).stdout
        height = int([l for l in info.splitlines() if "pixelHeight" in l][0].split(":")[1])
        width = int([l for l in info.splitlines() if "pixelWidth" in l][0].split(":")[1])
        subprocess.run(
            ["sips", "-c", str(round(height * CROP[name])), str(width), path, "--out", path],
            capture_output=True, check=True,
        )

    # 800px is generous for decoration that never renders larger than a
    # popover; alpha costs WebP a lot, so this is where the weight is.
    webp = os.path.join(OUT_DIR, f"{name}.webp")
    subprocess.run(
        ["cwebp", "-quiet", "-q", "78", "-resize", "800", "0", path, "-o", webp],
        check=True,
    )
    os.unlink(path)
    print(f"wrote {webp} ({os.path.getsize(webp) // 1024} KB)")


if __name__ == "__main__":
    names = [a for a in sys.argv[1:] if not a.startswith("--")]
    size = "1536x1024"
    for arg in sys.argv[1:]:
        if arg.startswith("--size="):
            size = arg.split("=", 1)[1]
    if not names:
        sys.exit(f"usage: generate-demo-image.py <{'|'.join(DEMO_PROMPTS)}> [--size=WxH]")
    for n in names:
        generate(n, size)
