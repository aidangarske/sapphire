mod gcal;
mod github;

use serde::Serialize;
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use std::time::UNIX_EPOCH;

/// The chosen workspace root. File commands are confined to it.
#[derive(Default)]
struct Ws(Mutex<Option<std::path::PathBuf>>);

fn guard(ws: &tauri::State<Ws>, path: &str) -> Result<(), String> {
    let root = match &*ws.0.lock().unwrap() {
        Some(r) => r.clone(),
        None => return Err("workspace is not initialized".into()),
    };
    let p = Path::new(path);
    let resolved = match fs::canonicalize(p) {
        Ok(c) => c,
        Err(_) => fs::canonicalize(p.parent().ok_or("invalid path")?)
            .map_err(|e| e.to_string())?
            .join(p.file_name().ok_or("invalid path")?),
    };
    if resolved.starts_with(&root) {
        Ok(())
    } else {
        Err("path is outside the workspace".into())
    }
}

#[derive(Serialize)]
struct NoteEntry {
    name: String,
    path: String,
    modified: u64,
}

#[derive(Serialize)]
struct SearchHit {
    name: String,
    path: String,
    line: u32,
    snippet: String,
    title_match: bool,
}

fn md_files(dir: &str) -> Result<Vec<std::path::PathBuf>, String> {
    let mut out = Vec::new();
    let rd = match fs::read_dir(dir) {
        Ok(rd) => rd,
        Err(_) => return Ok(out),
    };
    for entry in rd {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            out.push(path);
        }
    }
    Ok(out)
}

#[tauri::command]
fn list_notes(ws: tauri::State<Ws>, dir: String) -> Result<Vec<NoteEntry>, String> {
    guard(&ws, &dir)?;
    let mut out = Vec::new();
    for path in md_files(&dir)? {
        let modified = path
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        out.push(NoteEntry {
            name: path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string(),
            path: path.to_string_lossy().to_string(),
            modified,
        });
    }
    out.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(out)
}

#[tauri::command]
fn read_note(ws: tauri::State<Ws>, path: String) -> Result<String, String> {
    guard(&ws, &path)?;
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_note(ws: tauri::State<Ws>, path: String, contents: String) -> Result<(), String> {
    guard(&ws, &path)?;
    fs::write(&path, contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_note(ws: tauri::State<Ws>, path: String) -> Result<(), String> {
    guard(&ws, &path)?;
    fs::remove_file(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_note(ws: tauri::State<Ws>, from: String, to: String) -> Result<(), String> {
    guard(&ws, &from)?;
    guard(&ws, &to)?;
    if Path::new(&to).exists() {
        return Err("A note with that name already exists.".into());
    }
    fs::rename(&from, &to).map_err(|e| e.to_string())
}

#[tauri::command]
fn search_notes(
    ws: tauri::State<Ws>,
    dir: String,
    query: String,
) -> Result<Vec<SearchHit>, String> {
    guard(&ws, &dir)?;
    let mut hits = Vec::new();
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Ok(hits);
    }
    for path in md_files(&dir)? {
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let title_match = name.to_lowercase().contains(&q);
        let body = fs::read_to_string(&path).unwrap_or_default();
        let mut line_hit: Option<(u32, String)> = None;
        for (i, line) in body.lines().enumerate() {
            if line.to_lowercase().contains(&q) {
                line_hit = Some((i as u32 + 1, line.trim().to_string()));
                break;
            }
        }
        if title_match || line_hit.is_some() {
            let (line, snippet) = line_hit.unwrap_or((0, String::new()));
            hits.push(SearchHit {
                name,
                path: path.to_string_lossy().to_string(),
                line,
                snippet,
                title_match,
            });
        }
    }
    Ok(hits)
}

#[tauri::command]
fn create_note(ws: tauri::State<Ws>, dir: String, title: String) -> Result<String, String> {
    guard(&ws, &dir)?;
    let base: String = title
        .trim()
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' => '-',
            _ => c,
        })
        .collect();
    let base = if base.is_empty() {
        "Untitled".to_string()
    } else {
        base
    };
    let mut i = 0u32;
    loop {
        let name = if i == 0 {
            format!("{}.md", base)
        } else {
            format!("{} {}.md", base, i)
        };
        let path = Path::new(&dir).join(&name);
        guard(&ws, &path.to_string_lossy())?;
        match fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&path)
        {
            Ok(mut f) => {
                use std::io::Write;
                let title_line = name.trim_end_matches(".md");
                f.write_all(format!("# {}\n\n", title_line).as_bytes())
                    .map_err(|e| e.to_string())?;
                return Ok(path.to_string_lossy().to_string());
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                i += 1;
                if i > 9999 {
                    return Err("too many notes with that name".into());
                }
            }
            Err(e) => return Err(e.to_string()),
        }
    }
}

#[tauri::command]
fn ensure_workspace(ws: tauri::State<Ws>, dir: String) -> Result<(), String> {
    let root = Path::new(&dir);
    fs::create_dir_all(root).map_err(|e| e.to_string())?;
    let canon = fs::canonicalize(root).map_err(|e| e.to_string())?;
    let home = std::env::var("HOME").ok().map(std::path::PathBuf::from);
    if canon.parent().is_none() || home.as_deref() == Some(canon.as_path()) {
        return Err("refusing to use that folder as a workspace".into());
    }
    for sub in ["notes", "tasks", "config"] {
        fs::create_dir_all(canon.join(sub)).map_err(|e| e.to_string())?;
    }
    *ws.0.lock().unwrap() = Some(canon.clone());
    let root = canon.as_path();
    let welcome = root.join("notes").join("Welcome.md");
    if !welcome.exists() {
        fs::write(
            &welcome,
            "# Welcome to Sapphire\n\nType Markdown and it renders **inline** as you go.\n\n- [ ] Try a checkbox\n- [x] This one is done\n\n> A quote, and `inline code`.\n",
        )
        .map_err(|e| e.to_string())?;
    }
    let board = root.join("tasks").join("board.md");
    if !board.exists() {
        fs::write(
            &board,
            "## Todo\n\n- [ ] First task #sapphire\n\n## In Progress\n\n## Blocked\n\n## Done\n\n## Want To Do\n",
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn github_status() -> String {
    tauri::async_runtime::spawn_blocking(github::status)
        .await
        .unwrap_or_else(|_| "not-authed".into())
}

#[tauri::command]
async fn github_account() -> Result<Option<github::Account>, String> {
    tauri::async_runtime::spawn_blocking(github::account)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn github_prs() -> Result<Vec<github::Pr>, String> {
    tauri::async_runtime::spawn_blocking(github::pull_requests)
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn google_status() -> String {
    tauri::async_runtime::spawn_blocking(gcal::status)
        .await
        .unwrap_or_else(|_| "not-authed".into())
}

#[tauri::command]
async fn google_calendar(
    time_min: String,
    time_max: String,
) -> Result<Vec<gcal::RawEvent>, String> {
    tauri::async_runtime::spawn_blocking(move || gcal::events(time_min, time_max))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn google_oauth_login(client_id: String, client_secret: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || gcal::oauth_login(client_id, client_secret))
        .await
        .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn fetch_ics(url: String) -> Result<String, String> {
    if !url.starts_with("https://") {
        return Err("iCal URL must be https".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        use std::io::Write;
        const MAX_ICS_BYTES: usize = 5 * 1024 * 1024;
        let cfg = format!(
            "silent\nfail\nlocation\nproto = \"=https\"\nmax-redirs = 3\nmax-time = 20\nmax-filesize = {}\nurl = \"{}\"\n",
            MAX_ICS_BYTES,
            url.replace('\\', "\\\\").replace('"', "\\\"")
        );
        let mut child = std::process::Command::new("curl")
            .args(["-K", "-"])
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?;
        let mut si = child.stdin.take().ok_or("no stdin")?;
        si.write_all(cfg.as_bytes()).map_err(|e| e.to_string())?;
        drop(si);
        let out = child.wait_with_output().map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err("network error".into());
        }
        if out.stdout.len() > MAX_ICS_BYTES {
            return Err("iCal response too large".into());
        }
        Ok(String::from_utf8_lossy(&out.stdout).into_owned())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Ws::default())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_notes,
            read_note,
            write_note,
            delete_note,
            rename_note,
            search_notes,
            create_note,
            ensure_workspace,
            github_status,
            github_account,
            github_prs,
            fetch_ics,
            google_status,
            google_calendar,
            google_oauth_login
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
