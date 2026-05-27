# codespace-ping

Audio + browser notifications when long-running commands finish in GitHub Codespaces.

You walk away during a 10-minute test run. You come back 45 minutes later. This fixes that.

## Install

In your codespace terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/justinwang1985/codespace-ping/main/install.sh | bash
source ~/.bashrc
```

Then in VS Code, open the **Ports** tab (bottom panel), find port `3737`, and click the **🌐 globe icon** to open the listener in your real browser. (Not VS Code's Simple Browser — audio won't play there.) On the page that opens:

1. Click **Activate sound & notifications**
2. Pick your success and error sounds
3. Pin the tab

Test it:

```bash
ping-done
```

You should hear the sound on your laptop.

## How it works

```
┌─────────────────────────┐         ┌──────────────────────────┐
│ Codespace (Linux VM)    │         │ Your laptop (browser)    │
│                         │         │                          │
│  npm test               │         │  ┌────────────────────┐  │
│    └─► ping-done CLI    │         │  │ codespace-ping tab │  │
│          │              │         │  │  🔊 plays audio    │  │
│          ▼              │         │  │  🔔 shows notif    │  │
│   ┌──────────────┐  HTTP│         │  └────────────────────┘  │
│   │ notifier     │──────┼─────────┼─►        ▲               │
│   │ server :3737 │  SSE │ Codespaces        │ event          │
│   └──────────────┘      │ port-forward      │                │
└─────────────────────────┘         └──────────────────────────┘
```

The server runs inside the codespace. Codespaces port-forwards `:3737` — open it once in a browser tab on your laptop. The CLI sends an HTTP request to the server when your command finishes; the server fans out to every connected browser tab via Server-Sent Events. Audio plays on your laptop because the browser tab is on your laptop.

## Use

```bash
# Wrap a command — pings on success or failure, includes duration
ping-done npm test
ping-done mvn clean install

# Send a manual ping with custom message
ping-done "deploy complete"
ping-done                    # just sends "Done"

# Chain after any command
make build; ping-done
```

When wrapping a command, the success sound plays on exit 0 and the error sound plays on any non-zero exit. The listener log includes the duration.

## Server controls

```bash
ping-server status     # is it running?
ping-server start      # start if not running
ping-server stop       # stop the server
ping-server restart    # stop then start
ping-server logs       # tail the log
```

The installer starts the server. The devcontainer auto-starts it in fresh codespaces created from this repo. You generally won't need these — they're for when something seems off.

## Use with Claude Code

If you use Claude Code in your codespace, hooks can fire `ping-done` automatically when Claude finishes a turn or needs your input. Run this in the codespace:

```bash
mkdir -p ~/.claude
cat > ~/.claude/settings.json << 'EOF'
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
EOF
```

What this gives you:

- **Success sound** when Claude finishes a turn (`"Claude finished"` in the log)
- **Error sound** when Claude is waiting for your input or permission (`"Claude needs you"`)

The two distinct sounds let you tell from across the room whether Claude is done or stuck waiting on you.

Hooks load at session start, so restart Claude Code after adding the config.

## Custom sounds

Drop `.mp3`, `.wav`, `.ogg`, `.m4a`, or `.flac` files into `sounds/`. Refresh the listener tab. Pick which one plays on success and which on error from the settings card.

Filename tips:

- Use letters, digits, dots, underscores, hyphens only — special characters (`#`, `&`, spaces) can confuse URL encoding through Codespaces' port-forwarding proxy
- Keep clips short (under 2 seconds) and modest size (under 300 KB)
- Distinct timbres for success vs error help when you're not looking at the screen

## Install in every codespace automatically

Once you've used codespace-ping in a couple of codespaces, you'll want it everywhere by default. GitHub Codespaces supports automatic dotfiles installation:

1. Create a public repo on your GitHub account named `dotfiles`
2. Add a file `install.sh` containing:
   ```bash
   #!/usr/bin/env bash
   curl -fsSL https://raw.githubusercontent.com/justinwang1985/codespace-ping/main/install.sh | bash
   ```
3. Go to `https://github.com/settings/codespaces`
4. Toggle on **Automatically install dotfiles**

Every new codespace on any repo will have `ping-done` available immediately. No per-codespace setup.

## Manual install (if you don't want to pipe curl into bash)

Some people prefer not to pipe a remote script straight into a shell. Alternative:

```bash
curl -fsSL https://raw.githubusercontent.com/justinwang1985/codespace-ping/main/install.sh -o /tmp/install.sh
less /tmp/install.sh    # review it
bash /tmp/install.sh
```

Or clone and run directly:

```bash
git clone https://github.com/justinwang1985/codespace-ping.git ~/.codespace-ping
bash ~/.codespace-ping/install.sh
```

## Configuration

| Env var          | Default     | Purpose                                       |
| ---------------- | ----------- | --------------------------------------------- |
| `PING_DONE_PORT` | `3737`      | Port for the notifier server and CLI          |
| `PING_DONE_HOST` | `localhost` | Host the CLI POSTs to (rarely needs changing) |

## API

If you want to trigger pings from something other than the CLI (CI runner, GitHub Action, build tool plugin, your own scripts):

```bash
curl -X POST http://localhost:3737/notify \
  -H 'Content-Type: application/json' \
  -d '{"message":"build complete","status":"success","sound":"tada.mp3"}'
```

Fields:

- `message` — string shown in the notification and listener log
- `status` — `"success"` | `"error"` | `"info"` (picks the default sound)
- `sound` — optional filename to override the default

Other endpoints:

- `GET /api/status` → `{"listeners":N,"sounds":N,"port":3737}`
- `GET /api/sounds` → `{"sounds":["a.mp3","b.wav",...]}`
- `GET /events` → Server-Sent Events stream (used by the listener page)

## Notes

- The forwarded port can be marked **private** (default in the devcontainer config). Only you can reach it.
- Audio playback requires one user gesture on the page. The activation card handles that — click it once per session.
- Browser notifications require permission. The activation card prompts for it.
- The server is plain Node — no dependencies, no build step.
- **Use a real browser tab, not VS Code's Simple Browser.** Simple Browser is a webview and can't play audio reliably.
- Each codespace forwards port 3737 to a unique URL. If you work in multiple codespaces simultaneously, each needs its own listener tab in your browser.

## Roadmap

- [ ] Per-project sound profiles (`.ping-done.json` in repo root)
- [ ] Optional `ntfy.sh` fallback for when no browser tab is connected
- [ ] Auto-ping for any shell command over N seconds (`PROMPT_COMMAND` hook)
- [ ] Quiet hours

## License

MIT
