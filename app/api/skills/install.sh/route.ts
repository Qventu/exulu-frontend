import { CLIENT_DIRS } from "@/lib/skills/clients";

export const dynamic = "force-dynamic";

function baseUrlFrom(request: Request): string {
  const h = request.headers;
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = host ? `${proto}://${host}` : new URL(request.url).origin;
  // Sanitize: only accept a plain http(s) origin to prevent shell injection via
  // attacker-controlled Host headers when the value is interpolated into sh.
  return /^https?:\/\/[A-Za-z0-9.\-:]+$/.test(origin)
    ? origin
    : new URL(request.url).origin;
}

export async function GET(request: Request) {
  const baseUrl = baseUrlFrom(request).replace(/\/+$/, "");
  // "id:dir" pairs the shell splits; agents first so it's the default.
  const clientPairs = CLIENT_DIRS.map((c) => `${c.id}:${c.dir}`).join(" ");
  const script = renderInstaller(baseUrl, clientPairs);
  return new Response(script, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function renderInstaller(baseUrl: string, clientPairs: string): string {
  return `#!/bin/sh
set -eu

BASE_URL="${baseUrl}"
CLIENT_PAIRS="${clientPairs}"
CONFIG_DIR="$HOME/.config/exulu"
CONFIG_FILE="$CONFIG_DIR/skills.json"

say() { printf '%s\\n' "$*"; }
die() { printf 'error: %s\\n' "$*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || die "curl is required"
command -v unzip >/dev/null 2>&1 || die "unzip is required"

# 1. Resolve the backend URL from the frontend base URL.
say "Resolving backend from $BASE_URL/api/config ..."
CONFIG_JSON="$(curl -fsSL "$BASE_URL/api/config")" || die "could not reach $BASE_URL/api/config"
BACKEND="$(printf '%s' "$CONFIG_JSON" | sed -n 's/.*"backend"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p')"
[ -n "$BACKEND" ] || die "no 'backend' field in /api/config response"
BACKEND="$(printf '%s' "$BACKEND" | sed 's:/*$::')"
say "Backend: $BACKEND"

# 2. Pick install root (project dir vs home).
ROOT="$(pwd)"
if [ -r /dev/tty ]; then
  printf 'Install into current project (%s) or home (~)? [project/home] ' "$ROOT" > /dev/tty
  read ANSWER < /dev/tty || ANSWER="project"
  [ "$ANSWER" = "home" ] && ROOT="$HOME"
fi
say "Install root: $ROOT"

# 3. Determine target clients: pre-select those whose dir already exists.
SELECTED=""
for pair in $CLIENT_PAIRS; do
  id="\${pair%%:*}"; dir="\${pair#*:}"
  if [ -d "$ROOT/\${dir%/skills}" ] || [ -d "$ROOT/$dir" ]; then
    SELECTED="$SELECTED $id"
  fi
done
[ -n "$SELECTED" ] || SELECTED="agents"
if [ -r /dev/tty ]; then
  printf 'Install into clients [%s]. Enter to accept, or type space-separated ids: ' "$(echo $SELECTED)" > /dev/tty
  read CHOICE < /dev/tty || CHOICE=""
  [ -n "$CHOICE" ] && SELECTED="$CHOICE"
fi
say "Clients: $(echo $SELECTED)"

# 4. Layout: copy (default) or symlink.
LINK_MODE="copy"
if [ -r /dev/tty ]; then
  printf 'Share one copy across clients via symlink? [y/N] ' > /dev/tty
  read S < /dev/tty || S="n"
  case "$S" in y|Y) LINK_MODE="symlink";; esac
fi
say "Layout: $LINK_MODE"

# 5. Download the bootstrap skill.
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$BACKEND/skills/agent/bootstrap" -o "$TMP/boot.zip" || die "could not download bootstrap skill"
unzip -q "$TMP/boot.zip" -d "$TMP/unpacked" || die "could not unzip bootstrap skill"
SRC="$TMP/unpacked/exulu-skills"
[ -d "$SRC" ] || die "unexpected bootstrap layout"

# dir_for CLIENT_ID -> relative skill dir
dir_for() { for pair in $CLIENT_PAIRS; do case "$pair" in "$1:"*) printf '%s' "\${pair#*:}"; return;; esac; done; }

place() { # place <dest-parent-skills-dir>
  dest="$1/exulu-skills"
  if [ -e "$dest" ] && [ ! -f "$dest/.exulu-skill.json" ] && [ ! -L "$dest" ]; then
    say "skip $dest (exists, not managed by exulu)"; return
  fi
  rm -rf "$dest"
  mkdir -p "$1"
  cp -R "$SRC" "$dest"
}

CANON="$ROOT/.agents/skills"
if [ "$LINK_MODE" = "symlink" ]; then
  mkdir -p "$CANON"; place "$CANON"
fi
for id in $SELECTED; do
  d="$(dir_for "$id")"; [ -n "$d" ] || continue
  parent="$ROOT/$d"
  if [ "$LINK_MODE" = "symlink" ] && [ "$id" != "agents" ]; then
    mkdir -p "$parent"
    if ln -s "$CANON/exulu-skills" "$parent/exulu-skills" 2>/dev/null; then
      say "linked $parent/exulu-skills"
    else
      say "symlink failed for $parent; copying"; place "$parent"
    fi
  elif [ "$LINK_MODE" = "copy" ]; then
    place "$parent"
  fi
  # symlink+agents: already placed by the pre-loop canonical install; skip.
done

# 6. API key + config.
mkdir -p "$CONFIG_DIR"
API_KEY=""
if [ -f "$CONFIG_FILE" ]; then
  API_KEY="$(sed -n 's/.*"api_key"[[:space:]]*:[[:space:]]*"\\([^"]*\\)".*/\\1/p' "$CONFIG_FILE")"
fi
if [ -r /dev/tty ]; then
  printf 'Exulu API key%s: ' "$( [ -n "$API_KEY" ] && echo ' (Enter to keep existing)')" > /dev/tty
  stty -echo </dev/tty 2>/dev/null || true
  read NEWKEY </dev/tty || NEWKEY=""
  stty echo </dev/tty 2>/dev/null || true
  printf '\\n' > /dev/tty
  [ -n "$NEWKEY" ] && API_KEY="$NEWKEY"
fi

CLIENTS_JSON="$(printf '%s' "$SELECTED" | awk '{for(i=1;i<=NF;i++){printf "%s\\"%s\\"",(i>1?",":""),$i}}')"
cat > "$CONFIG_FILE" <<EOF
{
  "base_url": "$BASE_URL",
  "backend": "$BACKEND",
  "api_key": "$API_KEY",
  "clients": [$CLIENTS_JSON],
  "link_mode": "$LINK_MODE"
}
EOF
chmod 600 "$CONFIG_FILE"

if [ -z "$API_KEY" ]; then
  say ""
  say "No API key set. Add one to $CONFIG_FILE (\\"api_key\\": \\"sk_...\\") to enable install/update/publish."
fi
say ""
say "Done. The 'exulu-skills' skill is installed. Ask your agent to \\"list Exulu skills\\" or \\"install skill <name>\\"."
`;
}
