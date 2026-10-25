# Building the PlayStorage installer (one time)

GitHub builds it for you; you don't need Rust, Node or Git locally. The result is a single `PlayStorage_1.0.0_x64-setup.exe` you can share freely.

1. Create a **public** GitHub repository named `PlayStorage`.
2. Upload the whole project (drag the folders `src`, `src-tauri`, `docs`, `.github` and the root files) via **uploading an existing file**. Make sure `.github/workflows/build.yml` exists; if not, create it with **Add file → Create new file**.
3. Open **Actions → Build PlayStorage → Run workflow** (enable workflows if asked).
4. After ~10-15 minutes (green check) open **Releases → PlayStorage 1.0.0 → Assets** and download `PlayStorage_1.0.0_x64-setup.exe`.
5. If the build fails, copy the last ~50 log lines of the red step and send them to the developer.

New version: bump `version` in `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`, upload the changes, run the workflow again. Installing over the old version keeps profiles and settings (`%APPDATA%\PlayStorage`).

On the target PC: run the installer; if SmartScreen appears, click **More info → Run anyway**.
