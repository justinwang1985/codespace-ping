#!/usr/bin/env bash
# codespace-ping installer
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/justinwang1985/codespace-ping/main/install.sh | bash

set -e

INSTALL_DIR="${CODESPACE_PING_DIR:-$HOME/.codespace-ping}"
REPO="https://github.com/justinwang1985/codespace-ping.git"

echo "Installing codespace-ping..."

# Clone or update
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "  Updating $INSTALL_DIR"
  git -C "$INSTALL_DIR" pull --quiet --ff-only || {
    echo "  Could not fast-forward ? your local commits are in the way."
    echo "  Resetting to origin/main..."
    git -C "$INSTALL_DIR" fetch origin --quiet
    git -C "$INSTALL_DIR" reset --hard origin/main --quiet
  }
else
  echo "  Cloning to $INSTALL_DIR"
  git clone --quiet "$REPO" "$INSTALL_DIR"
fi

chmod +x "$INSTALL_DIR/bin/ping-done" "$INSTALL_DIR/bin/ping-server"

# Add bin to PATH on the right shell rc
SHELL_RC="$HOME/.bashrc"
[ -n "${ZSH_VERSION:-}" ] && SHELL_RC="$HOME/.zshrc"

if ! grep -q "codespace-ping/bin" "$SHELL_RC" 2>/dev/null; then
  echo "" >> "$SHELL_RC"
  echo "# codespace-ping" >> "$SHELL_RC"
  echo "export PATH=\"\$PATH:$INSTALL_DIR/bin\"" >> "$SHELL_RC"
  echo "  Added $INSTALL_DIR/bin to PATH in $SHELL_RC"
fi

# Start the server
"$INSTALL_DIR/bin/ping-server" restart

echo ""
echo "  ? codespace-ping installed"
echo ""
echo "Next steps:"
echo "  1. In VS Code: open Ports tab (bottom panel) ? find 3737 ? click the globe icon"
echo "  2. In the browser tab: click 'Activate sound & notifications' ? pick sounds"
echo "  3. In a NEW terminal (or run: source $SHELL_RC), try:"
echo "       ping-done"
echo ""
echo "Server controls:"
echo "  ping-server status    # is it running?"
echo "  ping-server restart   # restart it"
echo "  ping-server logs      # tail the log"