// PlayStorage by sorokin
// Copyright (c) Sorokin Ivan. Licensed under the MIT License.
//
// Rust backend: persistent storage in %APPDATA%\PlayStorage, game discovery,
// game launching and play-time tracking, cover download, Windows power actions.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use sysinfo::{Disks, ProcessesToUpdate, System};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use walkdir::WalkDir;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// True while a launched game is being tracked (keeps the app alive with no window).
static GAME_RUNNING: AtomicBool = AtomicBool::new(false);

/// Command that never flashes a console window.
#[allow(unused_mut)]
fn quiet(program: &str) -> Command {
    let mut c = Command::new(program);
    #[cfg(windows)]
    c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    c
}

// ───────────────────────────── storage ─────────────────────────────

fn data_root(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app.path().data_dir().map_err(|e| e.to_string())?; // %APPDATA% (Roaming)
    let p = base.join("PlayStorage");
    fs::create_dir_all(&p).map_err(|e| e.to_string())?;
    Ok(p)
}

fn rel_path(app: &AppHandle, rel: &str) -> Result<PathBuf, String> {
    let r = rel.replace('\\', "/");
    if r.starts_with('/') || r.contains("..") || r.contains(':') {
        return Err("invalid path".into());
    }
    let root = data_root(app)?;
    if r.is_empty() {
        Ok(root)
    } else {
        Ok(root.join(r))
    }
}

#[tauri::command]
fn data_dir(app: AppHandle) -> Result<String, String> {
    Ok(data_root(&app)?.to_string_lossy().to_string())
}

#[tauri::command]
fn storage_read(app: AppHandle, rel: String) -> Result<Option<String>, String> {
    let p = rel_path(&app, &rel)?;
    if !p.is_file() {
        return Ok(None);
    }
    fs::read_to_string(p).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
fn storage_write(app: AppHandle, rel: String, data: String) -> Result<(), String> {
    let p = rel_path(&app, &rel)?;
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let mut tmp = p.clone().into_os_string();
    tmp.push(".tmp");
    let tmp = PathBuf::from(tmp);
    fs::write(&tmp, data).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &p).map_err(|e| e.to_string())
}

#[tauri::command]
fn storage_delete(app: AppHandle, rel: String) -> Result<(), String> {
    let p = rel_path(&app, &rel)?;
    if p.is_dir() {
        fs::remove_dir_all(&p).map_err(|e| e.to_string())?;
    } else if p.is_file() {
        fs::remove_file(&p).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn storage_list(app: AppHandle, rel: String) -> Result<Vec<String>, String> {
    let p = rel_path(&app, &rel)?;
    let mut out = vec![];
    if let Ok(rd) = fs::read_dir(p) {
        for e in rd.flatten() {
            out.push(e.file_name().to_string_lossy().to_string());
        }
    }
    out.sort();
    Ok(out)
}

/// Copy an arbitrary file (e.g. a custom cover picked by the user) into the data folder.
#[tauri::command]
fn storage_import(app: AppHandle, src: String, rel: String) -> Result<(), String> {
    let dst = rel_path(&app, &rel)?;
    if let Some(dir) = dst.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    fs::copy(src, dst).map(|_| ()).map_err(|e| e.to_string())
}

// ───────────────────────────── file browser ─────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FsEntry {
    name: String,
    path: String,
    is_dir: bool,
}

fn entry(name: &str, path: &Path, is_dir: bool) -> FsEntry {
    FsEntry { name: name.to_string(), path: path.to_string_lossy().to_string(), is_dir }
}

#[tauri::command]
fn fs_roots() -> Vec<FsEntry> {
    let mut out = vec![];
    #[cfg(windows)]
    {
        if let Ok(home) = std::env::var("USERPROFILE") {
            for (n, sub) in [("Desktop", "Desktop"), ("Documents", "Documents"), ("Downloads", "Downloads")] {
                let p = Path::new(&home).join(sub);
                if p.is_dir() {
                    out.push(entry(n, &p, true));
                }
            }
        }
        for c in b'A'..=b'Z' {
            let p = format!("{}:\\", c as char);
            if Path::new(&p).exists() {
                out.push(entry(&p, Path::new(&p), true));
            }
        }
    }
    #[cfg(not(windows))]
    {
        if let Ok(home) = std::env::var("HOME") {
            out.push(entry("Home", Path::new(&home), true));
        }
        out.push(entry("/", Path::new("/"), true));
    }
    out
}

#[tauri::command]
fn fs_parent(path: String) -> Option<String> {
    Path::new(&path).parent().map(|p| p.to_string_lossy().to_string()).filter(|s| !s.is_empty())
}

#[tauri::command]
fn fs_list(path: String, filter: String) -> Result<Vec<FsEntry>, String> {
    let rd = fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut dirs = vec![];
    let mut files = vec![];
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name.starts_with('$') {
            continue;
        }
        let p = e.path();
        let Ok(ft) = e.file_type() else { continue };
        if ft.is_dir() {
            dirs.push(entry(&name, &p, true));
        } else if ft.is_file() {
            let ext = p.extension().map(|x| x.to_string_lossy().to_lowercase()).unwrap_or_default();
            let ok = match filter.as_str() {
                "exe" => ext == "exe",
                "image" => matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "webp"),
                "json" => ext == "json",
                _ => false,
            };
            if ok {
                files.push(entry(&name, &p, false));
            }
        }
    }
    dirs.sort_by_key(|x| x.name.to_lowercase());
    files.sort_by_key(|x| x.name.to_lowercase());
    dirs.extend(files);
    Ok(dirs)
}

#[tauri::command]
fn fs_read_text(path: String) -> Result<String, String> {
    let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 64 * 1024 * 1024 {
        return Err("file too large".into());
    }
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn fs_write_text(path: String, data: String) -> Result<(), String> {
    fs::write(path, data).map_err(|e| e.to_string())
}

// ───────────────────────────── game discovery ─────────────────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct Found {
    name: String,
    exe: String,
    dir: String,
    source: String, // "exe" | "steam" | "epic"
    steam_appid: Option<String>,
    candidates: Vec<String>,
}

const BAD_EXE: &[&str] = &[
    "unins", "uninst", "vcredist", "vc_redist", "dxsetup", "dxwebsetup", "dotnet", "crashhandler",
    "crashreport", "crashpad", "crashsender", "bugreport", "easyanticheat", "beservice", "battleye",
    "redist", "prereq", "updater", "cefsubprocess", "cefprocess", "webhelper", "oalinst", "physx",
    "notification_helper", "createdump", "launcherhelper", "installer",
];

const SKIP_DIRS: &[&str] = &[
    "$recycle.bin", "system volume information", "windows", "node_modules", "__macosx", "engine",
    "_commonredist", "commonredist", "redist", "redistributables", "directx", "vcredist", "dotnetfx",
    "prerequisites", "__installer", "crashreportclient",
];

fn norm(s: &str) -> String {
    s.chars().filter(|c| c.is_alphanumeric()).flat_map(|c| c.to_lowercase()).collect()
}

fn is_bad_exe(stem: &str) -> bool {
    let s = stem.to_lowercase();
    if s == "setup" || s == "install" || s.starts_with("setup_") || s.starts_with("setup-") {
        return true;
    }
    BAD_EXE.iter().any(|b| s.contains(b))
}

fn skip_dir(name: &str) -> bool {
    let l = name.to_lowercase();
    l.starts_with('.') || SKIP_DIRS.contains(&l.as_str())
}

/// Returns (best exe, other candidates sorted by score) for a game folder.
fn best_exe(dir: &Path, folder_name: &str, max_depth: usize) -> Option<(String, Vec<String>)> {
    let fnorm = norm(folder_name);
    let mut cands: Vec<(f64, String)> = vec![];
    let walker = WalkDir::new(dir)
        .max_depth(max_depth)
        .into_iter()
        .filter_entry(|e| !(e.depth() > 0 && e.file_type().is_dir() && skip_dir(&e.file_name().to_string_lossy())));
    for e in walker.flatten() {
        if !e.file_type().is_file() {
            continue;
        }
        let p = e.path();
        let is_exe = p.extension().map(|x| x.eq_ignore_ascii_case("exe")).unwrap_or(false);
        if !is_exe {
            continue;
        }
        let Some(stem) = p.file_stem().map(|s| s.to_string_lossy().to_string()) else { continue };
        if is_bad_exe(&stem) {
            continue;
        }
        let size = e.metadata().map(|m| m.len()).unwrap_or(0) as f64;
        let sn = norm(&stem);
        let mut score = (size / 1_048_576.0).min(300.0);
        if !sn.is_empty() && !fnorm.is_empty() {
            if sn == fnorm {
                score += 160.0;
            } else if sn.contains(&fnorm) || fnorm.contains(&sn) {
                score += 100.0;
            }
        }
        if sn.contains("shipping") {
            score += 60.0;
        }
        if sn.contains("launcher") {
            score -= 120.0;
        }
        if ["editor", "config", "benchmark", "server", "settings"].iter().any(|w| sn.contains(w)) {
            score -= 80.0;
        }
        score -= (e.depth().saturating_sub(1) as f64) * 8.0;
        cands.push((score, p.to_string_lossy().to_string()));
    }
    cands.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    let list: Vec<String> = cands.into_iter().map(|c| c.1).take(8).collect();
    list.first().cloned().map(|f| (f, list))
}

fn vdf_value(text: &str, key: &str) -> Option<String> {
    for line in text.lines() {
        let mut parts = line.trim().split('"').filter(|s| !s.trim().is_empty());
        if let (Some(k), Some(v)) = (parts.next(), parts.next()) {
            if k.eq_ignore_ascii_case(key) {
                return Some(v.replace("\\\\", "\\"));
            }
        }
    }
    None
}

/// installdir(lowercase) -> (appid, name)
fn steam_manifests(steamapps: &Path) -> HashMap<String, (String, String)> {
    let mut map = HashMap::new();
    let Ok(rd) = fs::read_dir(steamapps) else { return map };
    for e in rd.flatten() {
        let name = e.file_name().to_string_lossy().to_lowercase();
        if !(name.starts_with("appmanifest_") && name.ends_with(".acf")) {
            continue;
        }
        let Ok(text) = fs::read_to_string(e.path()) else { continue };
        if let (Some(id), Some(n), Some(dir)) =
            (vdf_value(&text, "appid"), vdf_value(&text, "name"), vdf_value(&text, "installdir"))
        {
            map.insert(dir.to_lowercase(), (id, n));
        }
    }
    map
}

fn steam_internal(name: &str, appid: &str) -> bool {
    appid == "228980" || name.starts_with("Steam Linux Runtime") || name.starts_with("Proton") || name.starts_with("Steamworks Common")
}

fn clean_folder_name(n: &str) -> String {
    n.replace('_', " ").trim().to_string()
}

fn scan_root(root: &Path, out: &mut Vec<Found>) {
    let mut steam_map = HashMap::new();
    if root.file_name().map(|n| n.to_string_lossy().eq_ignore_ascii_case("common")).unwrap_or(false) {
        if let Some(sa) = root.parent() {
            steam_map = steam_manifests(sa);
        }
    }
    let before = out.len();
    if let Ok(rd) = fs::read_dir(root) {
        for e in rd.flatten() {
            let Ok(ft) = e.file_type() else { continue };
            if !ft.is_dir() {
                continue;
            }
            let name = e.file_name().to_string_lossy().to_string();
            if skip_dir(&name) {
                continue;
            }
            let path = e.path();
            let Some((exe, cands)) = best_exe(&path, &name, 4) else { continue };
            let (display, source, appid) = match steam_map.get(&name.to_lowercase()) {
                Some((id, n)) => {
                    if steam_internal(n, id) {
                        continue;
                    }
                    (n.clone(), "steam".to_string(), Some(id.clone()))
                }
                None => (clean_folder_name(&name), "exe".to_string(), None),
            };
            out.push(Found {
                name: display,
                exe,
                dir: path.to_string_lossy().to_string(),
                source,
                steam_appid: appid,
                candidates: cands,
            });
        }
    }
    // The chosen folder may itself be a single game folder.
    if out.len() == before {
        let name = root.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        if let Some((exe, cands)) = best_exe(root, &name, 3) {
            out.push(Found {
                name: clean_folder_name(&name),
                exe,
                dir: root.to_string_lossy().to_string(),
                source: "exe".into(),
                steam_appid: None,
                candidates: cands,
            });
        }
    }
}

#[tauri::command]
async fn scan_folders(roots: Vec<String>) -> Result<Vec<Found>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut out = vec![];
        for r in roots {
            let p = PathBuf::from(&r);
            if p.is_dir() {
                scan_root(&p, &mut out);
            }
        }
        out
    })
    .await
    .map_err(|e| e.to_string())
}

fn steam_library_dirs() -> Vec<PathBuf> {
    let mut steam_dirs: Vec<PathBuf> = vec![];
    for var in ["ProgramFiles(x86)", "ProgramFiles"] {
        if let Ok(pf) = std::env::var(var) {
            steam_dirs.push(Path::new(&pf).join("Steam"));
        }
    }
    steam_dirs.push(PathBuf::from("C:\\Program Files (x86)\\Steam"));
    let mut libs: Vec<PathBuf> = vec![];
    for sd in steam_dirs {
        let sa = sd.join("steamapps");
        if !sa.is_dir() {
            continue;
        }
        if !libs.contains(&sa) {
            libs.push(sa.clone());
        }
        if let Ok(text) = fs::read_to_string(sa.join("libraryfolders.vdf")) {
            for line in text.lines() {
                if let Some(v) = vdf_value(line, "path") {
                    let l = Path::new(&v).join("steamapps");
                    if l.is_dir() && !libs.contains(&l) {
                        libs.push(l);
                    }
                }
            }
        }
    }
    libs
}

#[tauri::command]
async fn detect_launchers() -> Result<Vec<Found>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut out: Vec<Found> = vec![];
        // Steam
        for sa in steam_library_dirs() {
            for (dir_l, (id, name)) in steam_manifests(&sa) {
                if steam_internal(&name, &id) {
                    continue;
                }
                let common = sa.join("common");
                // match the real directory name case-insensitively
                let mut game_dir: Option<PathBuf> = None;
                if let Ok(rd) = fs::read_dir(&common) {
                    for e in rd.flatten() {
                        if e.file_name().to_string_lossy().to_lowercase() == dir_l && e.path().is_dir() {
                            game_dir = Some(e.path());
                        }
                    }
                }
                let Some(gd) = game_dir else { continue };
                let (exe, cands) = best_exe(&gd, &name, 4).unwrap_or((String::new(), vec![]));
                out.push(Found {
                    name,
                    exe,
                    dir: gd.to_string_lossy().to_string(),
                    source: "steam".into(),
                    steam_appid: Some(id),
                    candidates: cands,
                });
            }
        }
        // Epic Games Store
        if let Ok(pd) = std::env::var("ProgramData") {
            let dir = Path::new(&pd).join("Epic").join("EpicGamesLauncher").join("Data").join("Manifests");
            if let Ok(rd) = fs::read_dir(dir) {
                for e in rd.flatten() {
                    if e.path().extension().map(|x| x != "item").unwrap_or(true) {
                        continue;
                    }
                    let Ok(text) = fs::read_to_string(e.path()) else { continue };
                    let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else { continue };
                    let s = |k: &str| v.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string();
                    let (display, loc, launch) = (s("DisplayName"), s("InstallLocation"), s("LaunchExecutable"));
                    let (app, main) = (s("AppName"), s("MainGameAppName"));
                    if display.is_empty() || loc.is_empty() || launch.is_empty() {
                        continue;
                    }
                    if !main.is_empty() && main != app {
                        continue; // DLC
                    }
                    if v.get("bIsIncompleteInstall").and_then(|x| x.as_bool()).unwrap_or(false) {
                        continue;
                    }
                    let exe = Path::new(&loc).join(&launch);
                    if !exe.is_file() {
                        continue;
                    }
                    out.push(Found {
                        name: display,
                        exe: exe.to_string_lossy().to_string(),
                        dir: loc,
                        source: "epic".into(),
                        steam_appid: None,
                        candidates: vec![exe.to_string_lossy().to_string()],
                    });
                }
            }
        }
        out.sort_by_key(|f| f.name.to_lowercase());
        out
    })
    .await
    .map_err(|e| e.to_string())
}

// ───────────────────────────── covers ─────────────────────────────

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
struct ArtResult {
    steam_appid: Option<String>,
    matched: Option<String>,
    cover: Option<String>,
    hero: Option<String>,
    logo: Option<String>,
}

fn pct(s: &str) -> String {
    let mut o = String::new();
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.~".contains(&b) {
            o.push(b as char);
        } else {
            o.push_str(&format!("%{:02X}", b));
        }
    }
    o
}

fn http_get(url: &str, limit: u64) -> Option<Vec<u8>> {
    let r = ureq::get(url)
        .timeout(Duration::from_secs(12))
        .set("User-Agent", "PlayStorage/1.0 (by Sorokin Ivan)")
        .call()
        .ok()?;
    if r.status() != 200 {
        return None;
    }
    let mut buf = vec![];
    r.into_reader().take(limit).read_to_end(&mut buf).ok()?;
    if buf.len() < 1500 {
        return None;
    }
    Some(buf)
}

const STEAM_HOSTS: &[&str] = &[
    "https://cdn.akamai.steamstatic.com/steam/apps",
    "https://cdn.cloudflare.steamstatic.com/steam/apps",
    "https://steamcdn-a.akamaihd.net/steam/apps",
];

fn steam_asset(appid: &str, files: &[&str]) -> Option<(Vec<u8>, String)> {
    for f in files {
        for h in STEAM_HOSTS {
            if let Some(b) = http_get(&format!("{}/{}/{}", h, appid, f), 25_000_000) {
                let ext = if f.ends_with(".png") { "png" } else { "jpg" };
                return Some((b, ext.to_string()));
            }
        }
    }
    None
}

fn steam_search(name: &str) -> Option<(String, String)> {
    let url = format!("https://store.steampowered.com/api/storesearch/?term={}&l=english&cc=us", pct(name));
    let r = ureq::get(&url)
        .timeout(Duration::from_secs(12))
        .set("User-Agent", "PlayStorage/1.0 (by Sorokin Ivan)")
        .call()
        .ok()?;
    let v: serde_json::Value = r.into_json().ok()?;
    let items = v.get("items")?.as_array()?;
    let want = norm(name);
    let mut fallback: Option<(String, String)> = None;
    for it in items {
        let n = it.get("name").and_then(|x| x.as_str()).unwrap_or("");
        let id = it.get("id").and_then(|x| x.as_u64()).map(|x| x.to_string());
        let Some(id) = id else { continue };
        let nn = norm(n);
        if nn == want {
            return Some((id, n.to_string()));
        }
        if fallback.is_none() && !want.is_empty() && (nn.starts_with(&want) || want.starts_with(&nn)) && nn.len() > 2 {
            fallback = Some((id, n.to_string()));
        }
    }
    fallback
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

#[tauri::command]
async fn fetch_art(app: AppHandle, game_id: String, name: String, steam_appid: Option<String>) -> Result<ArtResult, String> {
    let root = data_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let mut res = ArtResult::default();
        let (appid, matched) = match steam_appid {
            Some(id) => (id, None),
            None => match steam_search(&name) {
                Some((id, n)) => (id, Some(n)),
                None => return res,
            },
        };
        res.steam_appid = Some(appid.clone());
        res.matched = matched;
        let dir = root.join("covers");
        let _ = fs::create_dir_all(&dir);
        let stamp = now_secs();
        let save = |kind: &str, files: &[&str]| -> Option<String> {
            let (bytes, ext) = steam_asset(&appid, files)?;
            let rel = format!("covers/{}_{}_{}.{}", game_id, kind, stamp, ext);
            fs::write(root.join(&rel), bytes).ok()?;
            Some(rel)
        };
        res.cover = save("cover", &["library_600x900_2x.jpg", "library_600x900.jpg"]);
        res.hero = save("hero", &["library_hero_2x.jpg", "library_hero.jpg", "header.jpg"]);
        res.logo = save("logo", &["logo_2x.png", "logo.png"]);
        res
    })
    .await
    .map_err(|e| e.to_string())
}

/// Extract the exe's own icon to a PNG (Windows only, uses PowerShell + System.Drawing).
#[tauri::command]
async fn extract_icon(app: AppHandle, game_id: String, exe: String) -> Result<Option<String>, String> {
    let root = data_root(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        #[cfg(windows)]
        {
            let dir = root.join("covers");
            let _ = fs::create_dir_all(&dir);
            let rel = format!("covers/{}_icon_{}.png", game_id, now_secs());
            let out = root.join(&rel);
            let q = |s: &str| s.replace('\'', "''");
            let script = format!(
                "Add-Type -AssemblyName System.Drawing; $i=[System.Drawing.Icon]::ExtractAssociatedIcon('{}'); $b=$i.ToBitmap(); $b.Save('{}',[System.Drawing.Imaging.ImageFormat]::Png)",
                q(&exe),
                q(&out.to_string_lossy())
            );
            let ok = quiet("powershell").args(["-NoProfile", "-NonInteractive", "-Command", &script]).status().map(|s| s.success()).unwrap_or(false);
            if ok && out.is_file() {
                return Some(rel);
            }
        }
        #[cfg(not(windows))]
        {
            let _ = (&root, &game_id, &exe);
        }
        None
    })
    .await
    .map_err(|e| e.to_string())
}

// ───────────────────────────── launching & tracking ─────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LaunchSpec {
    id: String,
    exe: String,
    dir: String,
    steam_appid: Option<String>,
    args: Option<String>,
    profile: String,
    free_memory: bool,
}

fn open_target(url: &str) -> Result<(), String> {
    let ok = ["http://", "https://", "steam://", "com.epicgames.launcher://"].iter().any(|p| url.starts_with(p));
    if !ok || url.contains('"') || url.contains(' ') {
        return Err("unsupported link".into());
    }
    #[cfg(windows)]
    {
        quiet("rundll32").args(["url.dll,FileProtocolHandler", url]).spawn().map(|_| ()).map_err(|e| e.to_string())
    }
    #[cfg(not(windows))]
    {
        Command::new("xdg-open").arg(url).spawn().map(|_| ()).map_err(|e| e.to_string())
    }
}

fn norm_path(p: &str) -> String {
    p.replace('\\', "/").to_lowercase()
}

fn spawn_game(spec: &LaunchSpec) -> Result<(), String> {
    if let Some(id) = &spec.steam_appid {
        return open_target(&format!("steam://rungameid/{}", id));
    }
    if !Path::new(&spec.exe).is_file() {
        return Err(format!("File not found: {}", spec.exe));
    }
    let work = if spec.dir.is_empty() || !Path::new(&spec.dir).is_dir() {
        Path::new(&spec.exe).parent().map(|p| p.to_path_buf()).unwrap_or_default()
    } else {
        PathBuf::from(&spec.dir)
    };
    let mut c = Command::new(&spec.exe);
    c.current_dir(&work);
    if let Some(a) = &spec.args {
        for part in a.split_whitespace() {
            c.arg(part);
        }
    }
    match c.spawn() {
        Ok(_) => Ok(()),
        Err(e) => {
            // 740 = the program requires elevation: go through the shell (UAC prompt).
            if e.raw_os_error() == Some(740) {
                quiet("cmd")
                    .args(["/C", "start", "", "/D", &work.to_string_lossy(), &spec.exe])
                    .spawn()
                    .map(|_| ())
                    .map_err(|e| e.to_string())
            } else {
                Err(e.to_string())
            }
        }
    }
}

fn create_main_window(app: &AppHandle) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .title("PlayStorage")
        .fullscreen(true)
        .decorations(false)
        .inner_size(1280.0, 720.0)
        .min_inner_size(960.0, 540.0)
        .visible(false) // shown by the UI once the first frame is ready (no white flash)
        .build()?;
    // Safety net: show the window even if the UI never reports ready.
    let h = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(6));
        if let Some(w) = h.get_webview_window("main") {
            let _ = w.show();
        }
    });
    Ok(())
}

fn restore_window(app: &AppHandle) {
    let a = app.clone();
    let _ = app.run_on_main_thread(move || {
        if let Some(w) = a.get_webview_window("main") {
            let _ = w.show();
            let _ = w.unminimize();
            let _ = w.set_focus();
            let _ = w.emit("session-ended", ());
        } else {
            let _ = create_main_window(&a);
        }
    });
}

fn track_game(app: AppHandle, spec: LaunchSpec) {
    let started = Instant::now();
    let dir = if spec.dir.is_empty() {
        Path::new(&spec.exe).parent().map(|p| p.to_string_lossy().to_string()).unwrap_or_default()
    } else {
        spec.dir.clone()
    };
    let mut prefix = norm_path(&dir);
    if !prefix.ends_with('/') {
        prefix.push('/');
    }
    let exe_name = Path::new(&spec.exe).file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
    let mut sys = System::new();
    let mut first_seen: Option<Instant> = None;
    let mut last_seen = Instant::now();
    loop {
        std::thread::sleep(Duration::from_secs(2));
        sys.refresh_processes(ProcessesToUpdate::All, true);
        let running = sys.processes().values().any(|p| {
            let by_path = p.exe().map(|e| norm_path(&e.to_string_lossy()).starts_with(&prefix)).unwrap_or(false);
            let by_name = !exe_name.is_empty() && p.name().to_string_lossy().to_lowercase() == exe_name;
            by_path || by_name
        });
        if running {
            if first_seen.is_none() {
                first_seen = Some(Instant::now());
            }
            last_seen = Instant::now();
        } else if first_seen.is_none() && started.elapsed() > Duration::from_secs(240) {
            break; // never started
        } else if first_seen.is_some() && last_seen.elapsed() > Duration::from_secs(12) {
            break;
        }
    }
    let seconds = first_seen.map(|f| last_seen.saturating_duration_since(f).as_secs()).unwrap_or(0);
    let session = serde_json::json!({
        "profile": spec.profile, "gameId": spec.id, "seconds": seconds, "endedAt": now_secs() * 1000
    });
    if let Ok(root) = data_root(&app) {
        let _ = fs::write(root.join("session.json"), session.to_string());
    }
    GAME_RUNNING.store(false, Ordering::SeqCst);
    restore_window(&app);
}

#[tauri::command]
fn launch_game(app: AppHandle, spec: LaunchSpec) -> Result<(), String> {
    if GAME_RUNNING.swap(true, Ordering::SeqCst) {
        return Err("A game is already running".into());
    }
    if let Err(e) = spawn_game(&spec) {
        GAME_RUNNING.store(false, Ordering::SeqCst);
        return Err(e);
    }
    if let Some(w) = app.get_webview_window("main") {
        if spec.free_memory {
            let _ = w.destroy();
        } else {
            let _ = w.hide();
        }
    }
    let a = app.clone();
    std::thread::spawn(move || track_game(a, spec));
    Ok(())
}

// ───────────────────────────── system ─────────────────────────────

#[tauri::command]
fn ui_ready(app: AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[tauri::command]
fn open_url(url: String, mode: String) -> Result<(), String> {
    #[cfg(windows)]
    if mode == "edge" && (url.starts_with("http://") || url.starts_with("https://")) {
        for base in ["ProgramFiles(x86)", "ProgramFiles"] {
            if let Ok(pf) = std::env::var(base) {
                let edge = Path::new(&pf).join("Microsoft").join("Edge").join("Application").join("msedge.exe");
                if edge.is_file() {
                    return Command::new(edge)
                        .args(["--start-fullscreen", &format!("--app={}", url)])
                        .spawn()
                        .map(|_| ())
                        .map_err(|e| e.to_string());
                }
            }
        }
    }
    let _ = mode;
    open_target(&url)
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    if !Path::new(&path).exists() {
        return Err("Folder not found".into());
    }
    #[cfg(windows)]
    {
        Command::new("explorer").arg(&path).spawn().map(|_| ()).map_err(|e| e.to_string())
    }
    #[cfg(not(windows))]
    {
        Command::new("xdg-open").arg(&path).spawn().map(|_| ()).map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn system_power(app: AppHandle, action: String) -> Result<(), String> {
    match action.as_str() {
        "exit" => {
            app.exit(0);
            Ok(())
        }
        #[cfg(windows)]
        "shutdown" => quiet("shutdown").args(["/s", "/t", "0"]).spawn().map(|_| ()).map_err(|e| e.to_string()),
        #[cfg(windows)]
        "restart" => quiet("shutdown").args(["/r", "/t", "0"]).spawn().map(|_| ()).map_err(|e| e.to_string()),
        #[cfg(windows)]
        "sleep" => quiet("rundll32.exe")
            .args(["powrprof.dll,SetSuspendState", "0,1,0"])
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string()),
        _ => Err("unsupported on this platform".into()),
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DiskInfo {
    mount: String,
    total: u64,
    free: u64,
}

#[tauri::command]
fn disk_info() -> Vec<DiskInfo> {
    let disks = Disks::new_with_refreshed_list();
    disks
        .list()
        .iter()
        .filter(|d| d.total_space() > 0)
        .map(|d| DiskInfo {
            mount: d.mount_point().to_string_lossy().to_string(),
            total: d.total_space(),
            free: d.available_space(),
        })
        .collect()
}

#[tauri::command]
async fn dir_sizes(paths: Vec<String>) -> Result<Vec<u64>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let deadline = Instant::now() + Duration::from_secs(90);
        paths
            .iter()
            .map(|p| {
                let mut total = 0u64;
                for e in WalkDir::new(p).into_iter().flatten() {
                    if Instant::now() > deadline {
                        break;
                    }
                    if e.file_type().is_file() {
                        total += e.metadata().map(|m| m.len()).unwrap_or(0);
                    }
                }
                total
            })
            .collect()
    })
    .await
    .map_err(|e| e.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MonitorInfo {
    name: String,
    width: u32,
    height: u32,
}

#[tauri::command]
fn list_monitors(app: AppHandle) -> Vec<MonitorInfo> {
    let Some(w) = app.get_webview_window("main") else { return vec![] };
    w.available_monitors()
        .unwrap_or_default()
        .iter()
        .enumerate()
        .map(|(i, m)| MonitorInfo {
            name: m.name().cloned().unwrap_or_else(|| format!("Monitor {}", i + 1)),
            width: m.size().width,
            height: m.size().height,
        })
        .collect()
}

#[tauri::command]
fn set_monitor(app: AppHandle, index: usize) -> Result<(), String> {
    let w = app.get_webview_window("main").ok_or("no window")?;
    let monitors = w.available_monitors().map_err(|e| e.to_string())?;
    let m = monitors.get(index).ok_or("no such monitor")?;
    let _ = w.set_fullscreen(false);
    w.set_position(*m.position()).map_err(|e| e.to_string())?;
    w.set_fullscreen(true).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_fullscreen(app: AppHandle, on: bool) -> Result<(), String> {
    let w = app.get_webview_window("main").ok_or("no window")?;
    if on {
        w.set_fullscreen(true).map_err(|e| e.to_string())
    } else {
        w.set_fullscreen(false).map_err(|e| e.to_string())?;
        let _ = w.set_decorations(true);
        Ok(())
    }
}

#[tauri::command]
fn get_autostart() -> bool {
    #[cfg(windows)]
    {
        quiet("reg")
            .args(["query", r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run", "/v", "PlayStorage"])
            .status()
            .map(|s| s.success())
            .unwrap_or(false)
    }
    #[cfg(not(windows))]
    {
        false
    }
}

#[tauri::command]
fn set_autostart(on: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        let key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
        let status = if on {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            quiet("reg")
                .args(["add", key, "/v", "PlayStorage", "/t", "REG_SZ", "/d", &format!("\"{}\"", exe.display()), "/f"])
                .status()
        } else {
            quiet("reg").args(["delete", key, "/v", "PlayStorage", "/f"]).status()
        };
        match status {
            Ok(s) if s.success() || !on => Ok(()),
            Ok(_) => Err("registry write failed".into()),
            Err(e) => Err(e.to_string()),
        }
    }
    #[cfg(not(windows))]
    {
        let _ = on;
        Err("unsupported on this platform".into())
    }
}

#[tauri::command]
fn app_info() -> serde_json::Value {
    serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "author": "Sorokin Ivan"
    })
}

// ───────────────────────────── entry point ─────────────────────────────

fn main() {
    // Let UI sounds play without a prior mouse click (the launcher is used with a gamepad).
    #[cfg(windows)]
    std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", "--autoplay-policy=no-user-gesture-required");

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .setup(|app| {
            create_main_window(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            data_dir, storage_read, storage_write, storage_delete, storage_list, storage_import,
            fs_roots, fs_parent, fs_list, fs_read_text, fs_write_text,
            scan_folders, detect_launchers, fetch_art, extract_icon,
            launch_game, ui_ready, open_url, open_folder, system_power,
            disk_info, dir_sizes, list_monitors, set_monitor, set_fullscreen,
            get_autostart, set_autostart, app_info
        ])
        .build(tauri::generate_context!())
        .expect("error while building PlayStorage");

    app.run(|_app, event| {
        if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
            // Last window closed while a game is running: stay alive in the background.
            if code.is_none() && GAME_RUNNING.load(Ordering::SeqCst) {
                api.prevent_exit();
            }
        }
    });
}
