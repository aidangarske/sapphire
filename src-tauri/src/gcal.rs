use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[derive(Serialize)]
pub struct RawEvent {
    id: Option<String>,
    summary: String,
    start: String,
    end: String,
    all_day: bool,
    url: Option<String>,  // google meet link (hangoutLink)
    link: Option<String>, // event page (htmlLink)
}

#[derive(Serialize, Deserialize, Default)]
struct Store {
    client_id: String,
    client_secret: String,
    refresh_token: String,
    access_token: String,
    expiry: u64,
}

const SCOPE: &str = "openid email https://www.googleapis.com/auth/calendar.readonly";
const AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";

fn store_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_default();
    PathBuf::from(home).join(".config/sapphire/google.json")
}

fn load_store() -> Store {
    fs::read_to_string(store_path())
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_store(s: &Store) -> Result<(), String> {
    let p = store_path();
    if let Some(dir) = p.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        let _ = fs::set_permissions(dir, fs::Permissions::from_mode(0o700));
    }
    fs::write(&p, serde_json::to_string_pretty(s).unwrap_or_default())
        .map_err(|e| e.to_string())?;
    let _ = fs::set_permissions(&p, fs::Permissions::from_mode(0o600));
    Ok(())
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn percent(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}

fn b64url(bytes: &[u8]) -> String {
    const T: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut out = String::new();
    for chunk in bytes.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        out.push(T[(b[0] >> 2) as usize] as char);
        out.push(T[(((b[0] & 0x03) << 4) | (b[1] >> 4)) as usize] as char);
        if chunk.len() > 1 {
            out.push(T[(((b[1] & 0x0f) << 2) | (b[2] >> 6)) as usize] as char);
        }
        if chunk.len() > 2 {
            out.push(T[(b[2] & 0x3f) as usize] as char);
        }
    }
    out
}

fn random_bytes(n: usize) -> Result<Vec<u8>, String> {
    let mut buf = vec![0u8; n];
    let mut f = fs::File::open("/dev/urandom").map_err(|e| e.to_string())?;
    f.read_exact(&mut buf).map_err(|e| e.to_string())?;
    Ok(buf)
}

fn sha256_b64url(s: &str) -> String {
    let mut h = Sha256::new();
    h.update(s.as_bytes());
    b64url(&h.finalize())
}

fn hex_val(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

fn url_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => match (hex_val(bytes[i + 1]), hex_val(bytes[i + 2])) {
                (Some(h), Some(l)) => {
                    out.push((h << 4) | l);
                    i += 3;
                }
                _ => {
                    out.push(b'%');
                    i += 1;
                }
            },
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            c => {
                out.push(c);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn parse_param(req: &str, key: &str) -> Option<String> {
    let line = req.lines().next()?;
    let qs = line.split_whitespace().nth(1)?.split('?').nth(1)?;
    for pair in qs.split('&') {
        let mut kv = pair.splitn(2, '=');
        if kv.next() == Some(key) {
            return kv.next().map(|s| s.to_string());
        }
    }
    None
}

fn curl_config(cfg: &str) -> Result<Vec<u8>, String> {
    let mut child = Command::new("curl")
        .args(["-K", "-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    let mut si = child.stdin.take().ok_or("no stdin")?;
    si.write_all(cfg.as_bytes()).map_err(|e| e.to_string())?;
    drop(si);
    let out = child.wait_with_output().map_err(|e| e.to_string())?;
    Ok(out.stdout)
}

fn token_post(form: &[(&str, &str)]) -> Result<Value, String> {
    let mut cfg = format!("silent\nrequest = \"POST\"\nurl = \"{}\"\n", TOKEN_URL);
    for (k, v) in form {
        cfg.push_str(&format!("data = \"{}={}\"\n", k, percent(v)));
    }
    let bytes = curl_config(&cfg)?;
    serde_json::from_slice(&bytes).map_err(|_| "bad token response".to_string())
}

pub fn oauth_login(client_id: String, client_secret: String) -> Result<(), String> {
    if client_id.is_empty() {
        return Err("no-client".into());
    }
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = listener.local_addr().map_err(|e| e.to_string())?.port();
    listener.set_nonblocking(true).ok();
    let redirect = format!("http://127.0.0.1:{}", port);
    let verifier = b64url(&random_bytes(32)?);
    let state = b64url(&random_bytes(16)?);
    let challenge = sha256_b64url(&verifier);

    let auth = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&scope={}&code_challenge={}&code_challenge_method=S256&state={}&access_type=offline&prompt=consent",
        AUTH_URL,
        percent(&client_id),
        percent(&redirect),
        percent(SCOPE),
        percent(&challenge),
        percent(&state)
    );
    Command::new("open")
        .arg(&auth)
        .spawn()
        .map_err(|e| e.to_string())?;

    let start = Instant::now();
    let code = loop {
        match listener.accept() {
            Ok((mut stream, _)) => {
                let mut buf = [0u8; 4096];
                let n = stream.read(&mut buf).unwrap_or(0);
                let req = String::from_utf8_lossy(&buf[..n]);
                let body = "<html><body style='font-family:sans-serif;background:#0d1117;color:#eef2f8'><h2>Sapphire — signed in</h2><p>You can close this tab.</p></body></html>";
                let resp = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    body.len(),
                    body
                );
                let _ = stream.write_all(resp.as_bytes());
                if let Some(c) = parse_param(&req, "code") {
                    let recv_state = parse_param(&req, "state").map(|s| url_decode(&s));
                    if recv_state.as_deref() != Some(state.as_str()) {
                        return Err("state mismatch".into());
                    }
                    break url_decode(&c);
                }
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                if start.elapsed() > Duration::from_secs(180) {
                    return Err("Timed out waiting for Google sign-in.".into());
                }
                std::thread::sleep(Duration::from_millis(200));
            }
            Err(e) => return Err(e.to_string()),
        }
    };

    let j = token_post(&[
        ("code", &code),
        ("client_id", &client_id),
        ("client_secret", &client_secret),
        ("redirect_uri", &redirect),
        ("grant_type", "authorization_code"),
        ("code_verifier", &verifier),
    ])?;

    let access = j.get("access_token").and_then(|v| v.as_str()).unwrap_or("");
    let refresh = j
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    if access.is_empty() || refresh.is_empty() {
        let err = j
            .get("error_description")
            .or_else(|| j.get("error"))
            .and_then(|v| v.as_str());
        return Err(err.unwrap_or("sign-in failed").to_string());
    }
    let expires = j.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(3600);
    save_store(&Store {
        client_id,
        client_secret,
        refresh_token: refresh.to_string(),
        access_token: access.to_string(),
        expiry: now_secs() + expires,
    })
}

pub fn status() -> String {
    if load_store().refresh_token.is_empty() {
        "none".into()
    } else {
        "ok".into()
    }
}

fn valid_token() -> Result<String, String> {
    let mut s = load_store();
    if s.refresh_token.is_empty() {
        return Err("none".into());
    }
    if now_secs() + 60 >= s.expiry {
        let j = token_post(&[
            ("client_id", &s.client_id),
            ("client_secret", &s.client_secret),
            ("refresh_token", &s.refresh_token),
            ("grant_type", "refresh_token"),
        ])?;
        let access = j.get("access_token").and_then(|v| v.as_str()).unwrap_or("");
        if access.is_empty() {
            return Err("token refresh failed — sign in again".into());
        }
        let expires = j.get("expires_in").and_then(|v| v.as_u64()).unwrap_or(3600);
        s.access_token = access.to_string();
        s.expiry = now_secs() + expires;
        save_store(&s)?;
    }
    Ok(s.access_token)
}

pub fn events(time_min: String, time_max: String) -> Result<Vec<RawEvent>, String> {
    let tok = valid_token()?;
    let url = format!(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={}&timeMax={}&singleEvents=true&orderBy=startTime&maxResults=100",
        percent(&time_min),
        percent(&time_max)
    );
    let cfg = format!(
        "silent\nheader = \"Authorization: Bearer {}\"\nurl = \"{}\"\n",
        tok, url
    );
    let bytes = curl_config(&cfg)?;
    let j: Value = serde_json::from_slice(&bytes).map_err(|_| "bad response".to_string())?;
    if let Some(err) = j.get("error") {
        let msg = err
            .get("message")
            .and_then(|v| v.as_str())
            .or_else(|| err.as_str())
            .unwrap_or("calendar error");
        return Err(msg.to_string());
    }

    let mut events = Vec::new();
    if let Some(items) = j.get("items").and_then(|v| v.as_array()) {
        for it in items {
            if it.get("eventType").and_then(|v| v.as_str()) == Some("workingLocation") {
                continue;
            }
            let summary = it
                .get("summary")
                .and_then(|v| v.as_str())
                .unwrap_or("(no title)")
                .to_string();
            let start_obj = it.get("start");
            let end_obj = it.get("end");
            let (start, all_day) = match start_obj
                .and_then(|s| s.get("dateTime"))
                .and_then(|v| v.as_str())
            {
                Some(dt) => (dt.to_string(), false),
                None => (
                    start_obj
                        .and_then(|s| s.get("date"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    true,
                ),
            };
            if start.is_empty() {
                continue;
            }
            let end = end_obj
                .and_then(|e| e.get("dateTime").or_else(|| e.get("date")))
                .and_then(|v| v.as_str())
                .unwrap_or(&start)
                .to_string();
            let url = it
                .get("hangoutLink")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let link = it
                .get("htmlLink")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let id = it
                .get("iCalUID")
                .or_else(|| it.get("id"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            events.push(RawEvent {
                id,
                summary,
                start,
                end,
                all_day,
                url,
                link,
            });
        }
    }
    Ok(events)
}
