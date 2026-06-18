use serde::Serialize;
use serde_json::Value;
use std::process::Command;

#[derive(Serialize)]
pub struct Pr {
    repo: String,
    number: u64,
    title: String,
    url: String,
    ci: String,     // failing | pending | passing | no-checks
    review: String, // approved | changes_requested | none
    draft: bool,
    conflict: bool,
    authored: bool,
    assigned: bool,
    review_requested_of_me: bool,
    updated_at: String,
}

#[derive(Serialize)]
pub struct Account {
    login: String,
    name: String,
    avatar_url: String,
}

const GH_CANDIDATES: [&str; 5] = [
    "gh",
    "/opt/homebrew/bin/gh",
    "/usr/local/bin/gh",
    "/usr/bin/gh",
    "/home/linuxbrew/.linuxbrew/bin/gh",
];

const PR_QUERY: &str = r#"
query($a:String!,$b:String!,$c:String!){
  authored: search(query:$a, type:ISSUE, first:50){ nodes{ ...F } }
  assigned: search(query:$b, type:ISSUE, first:50){ nodes{ ...F } }
  review:   search(query:$c, type:ISSUE, first:50){ nodes{ ...F } }
}
fragment F on PullRequest {
  number title url isDraft updatedAt mergeable reviewDecision
  repository{ nameWithOwner }
  commits(last:1){ nodes{ commit{ statusCheckRollup{ state } } } }
}
"#;

fn run_gh(args: &[&str]) -> Result<String, String> {
    for bin in GH_CANDIDATES {
        match Command::new(bin).args(args).output() {
            Ok(out) => {
                if out.status.success() {
                    return Ok(String::from_utf8_lossy(&out.stdout).into_owned());
                }
                let err = String::from_utf8_lossy(&out.stderr).to_lowercase();
                if err.contains("not logged into")
                    || err.contains("gh auth login")
                    || err.contains("authentication")
                {
                    return Err("not-authed".into());
                }
                return Err(String::from_utf8_lossy(&out.stderr).into_owned());
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
            Err(e) => return Err(e.to_string()),
        }
    }
    Err("gh-missing".into())
}

pub fn status() -> String {
    match run_gh(&["auth", "status"]) {
        Ok(_) => "ok".into(),
        Err(e) if e == "gh-missing" => "gh-missing".into(),
        Err(_) => "not-authed".into(),
    }
}

pub fn account() -> Result<Option<Account>, String> {
    match run_gh(&["api", "user"]) {
        Ok(s) => {
            let j: Value = serde_json::from_str(&s).map_err(|e| e.to_string())?;
            Ok(Some(Account {
                login: j
                    .get("login")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                name: j
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                avatar_url: j
                    .get("avatar_url")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
            }))
        }
        Err(e) if e == "not-authed" => Ok(None),
        Err(e) => Err(e),
    }
}

fn ci_from_state(state: Option<&str>) -> String {
    match state {
        Some("FAILURE") | Some("ERROR") => "failing",
        Some("PENDING") | Some("EXPECTED") => "pending",
        Some("SUCCESS") => "passing",
        _ => "no-checks",
    }
    .into()
}

fn merge_node(map: &mut std::collections::HashMap<String, Pr>, node: &Value, slot: u8) {
    let url = match node.get("url").and_then(|v| v.as_str()) {
        Some(u) if !u.is_empty() => u.to_string(),
        _ => return,
    };
    let rollup_state = node
        .get("commits")
        .and_then(|c| c.get("nodes"))
        .and_then(|n| n.as_array())
        .and_then(|a| a.first())
        .and_then(|n| n.get("commit"))
        .and_then(|c| c.get("statusCheckRollup"))
        .and_then(|r| r.get("state"))
        .and_then(|v| v.as_str());

    let entry = map.entry(url.clone()).or_insert_with(|| Pr {
        repo: node
            .get("repository")
            .and_then(|r| r.get("nameWithOwner"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        number: node.get("number").and_then(|v| v.as_u64()).unwrap_or(0),
        title: node
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        url,
        ci: ci_from_state(rollup_state),
        review: match node
            .get("reviewDecision")
            .and_then(|v| v.as_str())
            .unwrap_or("")
        {
            "APPROVED" => "approved",
            "CHANGES_REQUESTED" => "changes_requested",
            _ => "none",
        }
        .to_string(),
        draft: node
            .get("isDraft")
            .and_then(|v| v.as_bool())
            .unwrap_or(false),
        conflict: node.get("mergeable").and_then(|v| v.as_str()) == Some("CONFLICTING"),
        authored: false,
        assigned: false,
        review_requested_of_me: false,
        updated_at: node
            .get("updatedAt")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
    });
    match slot {
        0 => entry.authored = true,
        1 => entry.assigned = true,
        _ => entry.review_requested_of_me = true,
    }
}

/// Given PR URLs, return the subset that have been merged.
pub fn merged(urls: Vec<String>) -> Result<Vec<String>, String> {
    let mut out = Vec::new();
    for url in urls {
        if let Ok(s) = run_gh(&["pr", "view", &url, "--json", "state", "--jq", ".state"]) {
            if s.trim() == "MERGED" {
                out.push(url);
            }
        }
    }
    Ok(out)
}

pub fn pull_requests() -> Result<Vec<Pr>, String> {
    let login = run_gh(&["api", "user", "--jq", ".login"])?
        .trim()
        .to_string();
    if login.is_empty() {
        return Err("no-login".into());
    }

    let a = format!("is:pr is:open author:{}", login);
    let b = format!("is:pr is:open assignee:{}", login);
    let c = format!("is:pr is:open review-requested:{}", login);

    let out = run_gh(&[
        "api",
        "graphql",
        "-f",
        &format!("query={}", PR_QUERY),
        "-f",
        &format!("a={}", a),
        "-f",
        &format!("b={}", b),
        "-f",
        &format!("c={}", c),
    ])?;

    let j: Value = serde_json::from_str(&out).map_err(|e| e.to_string())?;
    let data = j.get("data").unwrap_or(&Value::Null);

    let mut map: std::collections::HashMap<String, Pr> = std::collections::HashMap::new();
    for (alias, slot) in [("authored", 0u8), ("assigned", 1u8), ("review", 2u8)] {
        if let Some(nodes) = data
            .get(alias)
            .and_then(|s| s.get("nodes"))
            .and_then(|n| n.as_array())
        {
            for node in nodes {
                merge_node(&mut map, node, slot);
            }
        }
    }

    let mut prs: Vec<Pr> = map.into_values().collect();
    prs.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(prs)
}
