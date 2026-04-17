#!/usr/bin/env bash
set -euo pipefail

THEME_DIR="$(cd "$(dirname "$0")" && pwd)"
DEV_DIR="/tmp/broadside-dev"

# Clean previous dev site
rm -rf "$DEV_DIR"
mkdir -p "$DEV_DIR/themes"

# Symlink theme into dev site
ln -sf "$THEME_DIR" "$DEV_DIR/themes/broadside"

# Symlink content and config into dev site
ln -sf "$THEME_DIR/content" "$DEV_DIR/content"
ln -sf "$THEME_DIR/config.toml" "$DEV_DIR/config.toml"

echo "→ Dev site at $DEV_DIR (theme symlinked)"
echo "→ Starting zola serve with live reload..."
echo ""

cd "$DEV_DIR"
exec zola serve --open --port 1111
