# === update-canopy ===
# Clone the canopy repo to a temp dir at $1 (or master if unset) and run its install.sh.
# install.sh writes .canopy-version (when --version is used) and the canopy-runtime ambient block.
VERSION="${1:-}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
if [ -n "$VERSION" ]; then
  git clone --depth=1 --branch "v$VERSION" \
    https://github.com/kostiantyn-matsebora/claude-canopy "$TMP/canopy"
  bash "$TMP/canopy/install.sh" --target both --version "$VERSION"
else
  git clone --depth=1 \
    https://github.com/kostiantyn-matsebora/claude-canopy "$TMP/canopy"
  bash "$TMP/canopy/install.sh" --target both
fi
