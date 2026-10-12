//! realtime-leaderboard backend.
//!
//! The crate is split into a library ([`app`]) and a binary (`src/main.rs`) so
//! integration tests can build the router and exercise it without binding a
//! port. See `PROJECT_CONTEXT.md` for the architecture.

pub mod config;
pub mod error;
pub mod openapi;
pub mod routes;
pub mod services;
pub mod state;
pub mod storage;

use axum::routing::{get, post};
use axum::Router;
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

pub use config::Config;
pub use state::AppState;

/// Build the application router. Kept free of I/O so tests can construct it.
pub fn app(state: AppState) -> Router {
    Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url(
            "/swagger-ui/api-docs/openapi.json",
            openapi::ApiDoc::openapi(),
        ))
        .route("/healthz", get(routes::health::healthz))
        .route("/scores", post(routes::scores::submit_score))
        .route("/players", get(routes::players::search_players))
        .route("/players/{player_id}/rank", get(routes::rank::get_rank))
        .route("/leaderboard", get(routes::leaderboard::get_leaderboard))
        .route("/stats", get(routes::stats::get_stats))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
