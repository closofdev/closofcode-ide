use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

#[derive(Serialize, Clone)]
pub struct FsChange {
    pub path: String,
    pub kind: String,
}

#[derive(Default)]
pub struct WatchState {
    watcher: Mutex<Option<RecommendedWatcher>>,
}

/// Start (or restart) a recursive watch on `path`. Emits a `fs-change` event
/// for every relevant filesystem change so the frontend can refresh.
#[tauri::command]
pub fn watch_root(
    app: AppHandle,
    state: State<'_, WatchState>,
    path: String,
) -> Result<(), String> {
    let mut guard = state.watcher.lock().map_err(|_| "watch lock poisoned")?;

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(event) = res else { return };
        let kind = format!("{:?}", event.kind);
        for p in event.paths {
            let _ = app.emit(
                "fs-change",
                FsChange {
                    path: p.to_string_lossy().to_string(),
                    kind: kind.clone(),
                },
            );
        }
    })
    .map_err(|e| format!("watcher: {e}"))?;

    watcher
        .watch(std::path::Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| format!("watch {path}: {e}"))?;

    *guard = Some(watcher);
    Ok(())
}
