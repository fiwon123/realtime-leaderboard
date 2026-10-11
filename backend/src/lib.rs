//! realtime-leaderboard backend.
//!
//! The crate is split into a library ([`app`]) and a binary (`src/main.rs`) so
//! integration tests can build the router and exercise it without binding a
//! port. See `PROJECT_CONTEXT.md` for the architecture.

pub mod config;
pub mod error;
pub mod routes;
pub mod state;

use axum::{routing::get, Router};
use tower_http::trace::TraceLayer;

pub use config::Config;
pub use state::AppState;

/// Build the application router. Kept free of I/O so tests can construct it.
pub fn app(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(routes::health::healthz))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
