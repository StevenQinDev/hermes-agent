//! Hermes Setup — Tauri entrypoint.
//!
//! Spawns a single window pointed at the React frontend (apps/bootstrap-installer/src/).
//! All install-time work lives in `bootstrap.rs` and is invoked through the Tauri
//! commands registered at the bottom of `run()`.
//!
//! The Windows-subsystem strip lives on the binary crate (src/main.rs), not
//! here — a crate-level attribute on a lib doesn't propagate to the linker
//! flags of the executable that consumes it.

mod bootstrap;
mod events;
mod install_script;
mod powershell;
mod paths;

use std::sync::Arc;
use tokio::sync::Mutex;

/// Process-wide install state, shared across Tauri commands.
///
/// The bootstrap is a one-shot, single-tenant process — we only need one
/// of these per window. `Arc<Mutex<...>>` lets command handlers grab it
/// without lifetime gymnastics.
pub struct AppState {
    pub bootstrap: Mutex<Option<bootstrap::BootstrapHandle>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            bootstrap: Mutex::new(None),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Tracing → bootstrap-installer.log under HERMES_HOME/logs/ so install
    // failures leave a trail for support. Console output also goes here in
    // debug builds.
    let _guard = paths::init_logging();

    tracing::info!("Hermes Setup starting");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Arc::new(AppState::default()))
        .invoke_handler(tauri::generate_handler![
            // Bootstrap lifecycle
            bootstrap::start_bootstrap,
            bootstrap::cancel_bootstrap,
            bootstrap::get_bootstrap_status,
            // Hand-off
            bootstrap::launch_hermes_desktop,
            // Diagnostics
            paths::get_log_path,
            paths::get_hermes_home,
            paths::open_log_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hermes Setup");
}
