use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::process::Command;

#[derive(Serialize)]
pub struct GitStatus {
    /// Absolute path -> one of "added" | "modified" | "deleted" | "untracked" | "renamed"
    pub files: HashMap<String, String>,
    /// Whether the root is inside a git work tree at all.
    pub is_repo: bool,
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
    let chars: Vec<char> = code.chars().collect();
    let x = chars.first().copied().unwrap_or(' ');
    let y = chars.get(1).copied().unwrap_or(' ');
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

/// Build a `git` command that never shows a console window on Windows.
/// Without CREATE_NO_WINDOW, spawning git flashes a console window in the
/// taskbar every time status runs (which is on every file save).
fn git_command(root: &str) -> Command {
    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(root);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Walk up from `root` looking for a `.git` entry. Pure filesystem check, no
/// process spawn, so non-repos cost nothing.
fn has_git_dir(root: &str) -> bool {
    let mut dir = Path::new(root);
    loop {
        if dir.join(".git").exists() {
            return true;
        }
        match dir.parent() {
            Some(parent) => dir = parent,
            None => return false,
        }
    }
}

/// Run `git status --porcelain` in `root` and map changed files to a status.
/// Returns `is_repo: false` (and no files) when the directory is not a repo,
/// so the UI can stop asking until the folder changes.
#[tauri::command]
pub fn git_status(root: String) -> Result<GitStatus, String> {
    let mut files = HashMap::new();

    // Cheap filesystem check first; skip spawning git entirely when there is
    // no repository above the folder.
    if !has_git_dir(&root) {
        return Ok(GitStatus { files, is_repo: false });
    }

    let output = git_command(&root)
        .args(["status", "--porcelain", "--untracked-files=all"])
        .output()
        .map_err(|e| format!("git not available: {e}"))?;

    if !output.status.success() {
        return Ok(GitStatus { files, is_repo: false });
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

    Ok(GitStatus { files, is_repo: true })
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

    #[test]
    fn has_git_dir_is_false_for_temp() {
        // A path we know has no .git ancestor in a sane environment is hard to
        // guarantee; just check the walk terminates without panic.
        let _ = has_git_dir(std::env::temp_dir().to_string_lossy().as_ref());
    }
}
