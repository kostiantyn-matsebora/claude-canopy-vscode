#!/usr/bin/env bash
# Canopy installer — downloads a release and wires Claude Code or GitHub Copilot.
# Usage:
#   bash install.sh                                     # install latest release, wire Claude Code
#   bash install.sh --target copilot                    # install latest release, wire GitHub Copilot
#   bash install.sh v1.0.0                              # install specific version (Claude)
#   bash install.sh v1.0.0 --target copilot             # install specific version (Copilot)
#   curl -sSL <url>/install.sh | bash
#   curl -sSL <url>/install.sh | bash -s -- v1.0.0
#   curl -sSL <url>/install.sh | bash -s -- --target copilot

set -euo pipefail

REPO="kostiantyn-matsebora/claude-canopy"
VERSION_FILE=".canopy-version"

TARGET="claude"
VERSION=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="${2:-}"; shift 2
      ;;
    --target=*)
      TARGET="${1#*=}"; shift
      ;;
    -h|--help)
      sed -n '2,12p' "$0"; exit 0
      ;;
    *)
      if [[ -z "$VERSION" ]]; then VERSION="$1"; shift
      else echo "Unexpected argument: $1" >&2; exit 1
      fi
      ;;
  esac
done

if [[ "$TARGET" != "claude" && "$TARGET" != "copilot" ]]; then
  echo "Invalid --target: $TARGET (expected claude|copilot)" >&2
  exit 1
fi

if [[ "$TARGET" == "copilot" ]]; then
  BASE=".github"
else
  BASE=".claude"
fi
CANOPY_DIR="$BASE/canopy"

RED='\033[0;31m'
GREEN='\033[0;32m'
RESET='\033[0m'

info()  { echo -e "  ${GREEN}info${RESET}     $1"; }
error() { echo -e "  ${RED}error${RESET}    $1"; exit 1; }

if [[ -z "$VERSION" ]]; then
  info "Fetching latest release..."
  VERSION=$(curl -sSf "https://api.github.com/repos/$REPO/releases/latest" \
    | grep '"tag_name"' | head -1 | cut -d'"' -f4)
  [[ -n "$VERSION" ]] || error "Could not determine latest version. Specify one: bash install.sh v1.0.0"
fi

echo "Canopy installer"
echo "----------------"
info "Target:  $TARGET ($BASE/)"
info "Version: $VERSION"

TARBALL_URL="https://github.com/$REPO/archive/refs/tags/$VERSION.tar.gz"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

info "Downloading $TARBALL_URL"
curl -sSfL "$TARBALL_URL" | tar -xz --strip-components=1 -C "$TMP_DIR"

mkdir -p "$CANOPY_DIR"
cp -r "$TMP_DIR"/. "$CANOPY_DIR/"
echo "$VERSION" > "$VERSION_FILE"
info "Installed to $CANOPY_DIR/ ($VERSION_FILE updated)"

echo ""
bash "$CANOPY_DIR/setup.sh" --target "$TARGET"
