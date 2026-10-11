//! Write the generated OpenAPI document to `openapi.json`.
//!
//! `cargo run --bin openapi` (from `backend/`) regenerates the committed spec.
//! CI runs the same command and fails if the file changes, so the checked-in
//! spec can never drift from the handler annotations.

use std::path::Path;
use std::process::ExitCode;

use utoipa::OpenApi;

use realtime_leaderboard::openapi::ApiDoc;

fn main() -> ExitCode {
    let spec = match ApiDoc::openapi().to_pretty_json() {
        Ok(spec) => spec,
        Err(err) => {
            eprintln!("cannot serialize OpenAPI document: {err}");
            return ExitCode::FAILURE;
        }
    };
    // Trailing newline keeps the file POSIX-friendly and the diff stable.
    let spec = format!("{spec}\n");

    let path = Path::new("openapi.json");
    if let Err(err) = std::fs::write(path, spec) {
        eprintln!("cannot write {}: {err}", path.display());
        return ExitCode::FAILURE;
    }

    println!("wrote {}", path.display());
    ExitCode::SUCCESS
}
