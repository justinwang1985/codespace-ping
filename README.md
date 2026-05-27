# codespace-ping

Audio + browser notifications when long-running commands finish in GitHub Codespaces.

You walk away during a 10-minute test run. You come back 45 minutes later. This fixes that.

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

The server runs inside the codespace. Codespaces port-forwards `:3737` to a public URL — open it once in a browser tab on your laptop. The CLI sends an HTTP request to the server when your command finishes; the server fans it out to every connected browser tab via Server-Sent Events. Audio plays on your laptop because the browser tab is on your laptop.

## Setup (in a Codespace)

Clone this repo into your codespace, then:

```bash
npm start                              # starts the server on :3737
chmod +x bin/ping-done
export PATH="$PATH:$(pwd)/bin"         # or add to your dotfiles
```

Open the forwarded URL (Codespaces will show a notification — or check the **Ports** tab in VS Code) in a browser tab on your local machine. Click "Activate sound & notifications" once. Pin the tab.

If you fork this repo, the included `.devcontainer/devcontainer.json` does all of the above automatically when you create a new codespace from it.

## Use

```bash
# Wrap a command — pings on success or failure, includes duration
ping-done npm test
ping-done mvn clean install

# Send a manual ping
ping-done "deploy finished"
ping-done                              # just sends "Done"

# Chain after any command
make build; ping-done
```

## Custom sounds

Drop `.mp3`, `.wav`, `.ogg`, `.m4a`, or `.flac` files into `sounds/`. Refresh the listener tab. Pick which one plays on success and which on error from the settings card.

## Configuration

| Env var          | Default     | Purpose                                          |
|------------------|-------------|--------------------------------------------------|
| `PING_DONE_PORT` | `3737`      | Port for the notifier server and CLI            |
| `PING_DONE_HOST` | `localhost` | Host the CLI POSTs to (rarely needs changing)   |

## API

If you want to trigger pings from something other than the CLI (CI runner, GitHub Action, build tool plugin):

```bash
curl -X POST http://localhost:3737/notify \
  -H 'Content-Type: application/json' \
  -d '{"message":"build complete","status":"success","sound":"chime.mp3"}'
```

Fields:
- `message` — string shown in the notification and log
- `status` — `"success"` | `"error"` | `"info"` (picks default sound)
- `sound` — optional filename to override the default for that ping

## Notes

- The forwarded port can be marked **private** in Codespaces (default in the devcontainer config). Only you can reach it.
- Audio playback requires one user gesture on the page. The activation card handles that.
- Browser notifications need permission. The activation card prompts for it.
- The server is plain Node — no dependencies, no build step.

## Roadmap

- [ ] Per-project sound profiles (`.ping-done.json` in repo root)
- [ ] Optional desktop push via `ntfy.sh` for when the browser tab isn't open
- [ ] VS Code task integration (auto-ping on task end)
- [ ] Quiet hours

## License

MIT
