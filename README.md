# PlayStorage by sorokin

A full-screen, console-style game launcher for Windows 11: game tiles, dynamic backgrounds, library, profiles, gamepad (DualSense / Xbox) and keyboard control. Russian and English.

**Author: Sorokin Ivan** (GitHub: [sorokin](https://github.com/sorokin)) · MIT License · Version 1.0.0

> PlayStorage is an independent project. It is not affiliated with Sony Interactive Entertainment and uses none of its assets (logos, fonts, sounds, icons). "PlayStation" is a trademark of Sony Interactive Entertainment.

## For users

### Install
1. Run `PlayStorage_x.y.z_x64-setup.exe`.
2. If Windows shows the blue "Windows protected your PC" window, click **More info → Run anyway** (the installer is not signed with a paid certificate).
3. Choose the installer language and click Next. No administrator rights needed.
4. Start PlayStorage from the desktop shortcut or Start menu.

On first launch a short wizard asks for language, your name and finds your games.

### Controls
| Action | Gamepad | Keyboard |
|---|---|---|
| Move | D-pad / left stick | Arrow keys |
| Select | ✕ (Xbox: A) | Enter / Space |
| Back | ○ (Xbox: B) | Esc / Backspace |
| Game options ("…") | Options / Menu | I or F2 |
| Control Center | PS / Xbox / Create | Tab or Home |
| Switch tab | L1 / R1 | Q / E or PgUp / PgDn |
| Search | △ (Xbox: Y) | / or Ctrl+F |
| Full screen | — | F11 |

### Where things are
- **Home:** "Games" and "Media" tabs, tile shelf, Play button. The "+" tile adds games; the last tile opens the library.
- **Library:** All / Recent / Favorites, sorting and filters, search.
- **Game "…" menu:** favorite, rename, change cover and .exe, open folder, hide, remove from library (game files are never deleted).
- **Control Center:** home, library, volume, profile, settings, PC power (sleep, restart, shut down, exit).
- **Settings** (gear, top right): guide, accessibility, profile, system (language, autostart, backup), storage, sound, screen, accessories, games & library, notifications.

The full guide is also inside the app: **Settings → User guide & information**.

### Adding games
**"+" tile** → find Steam/Epic games, scan saved folders, pick a games folder (e.g. `D:\Games`) or choose an `.exe` manually. Uninstallers and helper executables are skipped; artwork comes from public Steam data (a generated cover is used otherwise).

### Profiles and data
Everything lives in `%APPDATA%\PlayStorage` (press `Win+R` and paste the path):

| Path | Contents |
|---|---|
| `global.json` | Game library, scanned folders, Media-tab sites |
| `profiles\<id>.json` | Profile: settings, language, favorites, hidden games, play time |
| `covers\` | Downloaded artwork |
| `session.json` | Temporary result of the last game session |

This folder is **kept** when you uninstall, so profiles and settings survive a reinstall. One-file backup: **Settings → System → Backup & restore**.

### How launching works
When a game starts, the launcher window closes to save memory. A tiny background process watches the game (by processes running from its folder), counts play time and reopens the launcher when the game exits. Toggle: **Settings → System → Startup & behavior**.

## For developers
Stack: **Tauri 2** (Rust) + plain HTML/CSS/JS (`src/`, no bundler, no Node needed).
Dev run: install Rust and `cargo install tauri-cli --version "^2"`, then `cd src-tauri && cargo tauri dev`. The frontend also opens in a normal browser with a stubbed backend.
Build the installer on GitHub: see [docs/BUILD.md](docs/BUILD.md) (Russian: [docs/BUILD.ru.md](docs/BUILD.ru.md)).

© Sorokin Ivan. MIT License.
