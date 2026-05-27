# Sounds

Drop your audio files in this folder. Supported formats: `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`.

The listener page lists every file here and lets you pick which one plays on success vs. error. Refresh the page after adding new files.

## Tips

- Short clips (under 2 seconds) work best
- Keep it ≤300 KB so the page stays snappy
- If you want different sounds per project, override at call time:
  ```bash
  curl -X POST localhost:3737/notify -H 'Content-Type: application/json' \
    -d '{"message":"deploy done","status":"success","sound":"custom.mp3"}'
  ```

## Free sound sources

- [freesound.org](https://freesound.org) — Creative Commons sound effects
- [notificationsounds.com](https://notificationsounds.com)
- macOS users: `/System/Library/Sounds/*.aiff` (convert to mp3 first)
