use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

#[derive(Serialize)]
pub struct GitStatus {
    /// Absolute path -> one of "added" | "modified" | "deleted" | "untracked" | "renamed"
    pub files: HashMap<String, String>,
}

fn to_absolute(root: &str, rel: &str) -> String {
    let p = Path::new(root).join(rel);
    // git reports paths with forward slashes even on Windows; the file tree
    // uses native separators, so normalize everything to native here.
    p.to_string_lossy().replace('/', std::path::MAIN_SEPARATOR_STR)
}

fn classify(code: &str) -> &'static str {
    if code == "??" {
        return "untracked";
    }
    let bytes: Vec<char> = code.chars().collect();
    let x = bytes.first().copied().unwrap_or(' ');
    let y = bytes.get(1).copied().unwrap_or(' ');
    if x == 'D' || y == 'D' {
        return "deleted";
    }
    if x == 'A' {
        return "added";
    }
    if x == 'R' {
        return "renamed";
    }
    "modified"
}

/// Run `git status --porcelain` in `root` and map changed files to a status.
/// Returns an empty map when the directory is not a git repository.
#[tauri::command]
pub fn git_status(root: String) -> Result<GitStatus, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&root)
        .args(["status", "--porcelain", "--untracked-files=all"])
        .output()
        .map_err(|e| format!("git not available: {e}"))?;

    let mut files = HashMap::new();
    if !output.status.success() {
        // Not a repo, or git error: report nothing rather than failing the UI.
        return Ok(GitStatus { files });
    }

    let text = String::from_utf8_lossy(&output.stdout);
    for line in text.lines() {
        if line.as_bytes().len() < 4 {
            continue;
        }
        // Status codes are always two ASCII bytes followed by a space.
        let code = &line[0..2];
        let rest = &line[3..];
        // Renames are shown as "old -> new"; take the new path.
        let rel = match rest.split_once(" -> ") {
            Some((_, new)) => new,
            None => rest,
        };
        files.insert(to_absolute(&root, rel), classify(code).to_string());
    }

    Ok(GitStatus { files })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_separators() {
        let abs = to_absolute(r"C:\proj", "src/changed.txt");
        assert!(abs.ends_with(r"src\changed.txt"), "got {abs}");
    }

    #[test]
    fn classifies_codes() {
        assert_eq!(classify("A "), "added");
        assert_eq!(classify(" M"), "modified");
        assert_eq!(classify("??"), "untracked");
        assert_eq!(classify(" D"), "deleted");
        assert_eq!(classify("R "), "renamed");
    }
}
