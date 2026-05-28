#!/usr/bin/env bash
# codespace-ping installer
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/justinwang1985/codespace-ping/main/install.sh | bash
#
# Environment variables (skip the interactive prompt):
#   CODESPACE_PING_CLAUDE=yes   Install Claude Code hooks automatically
#   CODESPACE_PING_CLAUDE=no    Skip Claude Code hooks
#   CODESPACE_PING_DIR=...      Install directory (default: ~/.codespace-ping)

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

# Add bin to PATH and auto-start on shell open
SHELL_RC="$HOME/.bashrc"
[ -n "${ZSH_VERSION:-}" ] && SHELL_RC="$HOME/.zshrc"

if ! grep -q "codespace-ping/bin" "$SHELL_RC" 2>/dev/null; then
  {
    echo ""
    echo "# codespace-ping"
    echo "export PATH=\"\$PATH:$INSTALL_DIR/bin\""
    echo "command -v ping-server >/dev/null 2>&1 && ping-server start >/dev/null 2>&1"
  } >> "$SHELL_RC"
  echo "  Added PATH and auto-start to $SHELL_RC"
fi

# Start the server now
"$INSTALL_DIR/bin/ping-server" restart

# --- Claude Code hook setup -----------------------------------------------

setup_claude="${CODESPACE_PING_CLAUDE:-}"

if [ -z "$setup_claude" ]; then
  if [ -r /dev/tty ]; then
    echo ""
    echo "Claude Code integration:"
    echo "  Optional hooks make Claude play a sound when it finishes a turn"
    echo "  or needs your input. Your existing ~/.claude/settings.json is"
    echo "  preserved (only the hooks key is merged in)."
    echo ""
    printf "  Install Claude Code hooks? [Y/n] "
    read -r answer < /dev/tty || answer="y"
    case "${answer,,}" in
      n|no)  setup_claude="no" ;;
      *)     setup_claude="yes" ;;
    esac
  else
    setup_claude="yes"
    echo ""
    echo "Non-interactive install ? defaulting Claude Code hooks to ON."
    echo "  (Set CODESPACE_PING_CLAUDE=no to skip in the future.)"
  fi
fi

if [ "$setup_claude" = "yes" ]; then
  echo ""
  echo "Configuring Claude Code hooks..."

  if ! command -v jq >/dev/null 2>&1; then
    echo "  Installing jq..."
    if command -v sudo >/dev/null 2>&1; then
      sudo apt-get update -qq && sudo apt-get install -y -qq jq
    else
      apt-get update -qq && apt-get install -y -qq jq
    fi
  fi

  mkdir -p ~/.claude

  existing="{}"
  [ -f ~/.claude/settings.json ] && existing=$(cat ~/.claude/settings.json)

  hooks=$(cat <<'JSON'
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -m 2 -X POST http://localhost:${PING_DONE_PORT:-3737}/notify -H 'Content-Type: application/json' -d '{\"message\":\"Claude finished\",\"status\":\"success\"}' > /dev/null 2>&1"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -m 2 -X POST http://localhost:${PING_DONE_PORT:-3737}/notify -H 'Content-Type: application/json' -d '{\"message\":\"Claude needs you\",\"status\":\"error\"}' > /dev/null 2>&1"
          }
        ]
      }
    ]
  }
}
JSON
)

  echo "$existing $hooks" | jq -s '.[0] * .[1]' > ~/.claude/settings.json
  echo "  ? Claude Code hooks configured"
  echo "  (Restart Claude Code if it was already running)"
else
  echo ""
  echo "Skipping Claude Code hook setup."
fi

# --- Done ------------------------------------------------------------------

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