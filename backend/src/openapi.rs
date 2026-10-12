//! OpenAPI 3 document generated from the route handlers.
//!
//! The spec is built from the `#[utoipa::path]` annotations on the handlers, so
//! it cannot drift from the code without the annotations changing too. It is
//! served as JSON by [`SwaggerUi`](crate::app) and can be regenerated on disk
//! with `cargo run --bin openapi` (CI fails if that file is stale).

use utoipa::OpenApi;

use crate::error::ErrorBody;
use crate::routes::health::HealthBody;
use crate::routes::leaderboard::{LeaderboardEntry, LeaderboardResponse};
use crate::routes::rank::RankResponse;
use crate::routes::scores::{ScoreEvent, ScoreEventResponse};
use crate::routes::stats::StatsResponse;

/// The whole API, assembled from the handler annotations.
#[derive(OpenApi)]
#[openapi(
    paths(
        crate::routes::health::healthz,
        crate::routes::scores::submit_score,
        crate::routes::rank::get_rank,
        crate::routes::leaderboard::get_leaderboard,
        crate::routes::stats::get_stats,
    ),
    components(schemas(
        HealthBody,
        ScoreEvent,
        ScoreEventResponse,
        LeaderboardEntry,
        LeaderboardResponse,
        RankResponse,
        StatsResponse,
        ErrorBody,
    )),
    info(
        title = "realtime-leaderboard API",
        description = "Submit score events and read live leaderboard rankings.",
        version = env!("CARGO_PKG_VERSION"),
    ),
    tags(
        (name = "health", description = "Liveness probes"),
        (name = "scores", description = "Score event ingestion"),
        (name = "leaderboard", description = "Live ranking reads"),
    ),
)]
pub struct ApiDoc;

#[cfg(test)]
mod tests {
    use super::*;

    /// Guards against a handler being added without joining `ApiDoc` — the
    /// drift this module exists to prevent.
    #[test]
    fn spec_lists_every_endpoint() {
        let spec = ApiDoc::openapi();
        for path in [
            "/healthz",
            "/scores",
            "/players/{player_id}/rank",
            "/leaderboard",
            "/stats",
        ] {
            assert!(
                spec.paths.paths.contains_key(path),
                "OpenAPI spec is missing {path}"
            );
        }
    }

    #[test]
    fn leaderboard_query_params_are_documented() {
        let spec = ApiDoc::openapi();
        let leaderboard = spec
            .paths
            .paths
            .get("/leaderboard")
            .expect("leaderboard path present");
        let params = leaderboard
            .get
            .as_ref()
            .and_then(|op| op.parameters.as_ref())
            .expect("leaderboard has parameters");
        let names: Vec<&str> = params.iter().map(|p| p.name.as_str()).collect();
        assert!(names.contains(&"limit"), "limit not documented: {names:?}");
        assert!(
            names.contains(&"offset"),
            "offset not documented: {names:?}"
        );
    }

    /// Error responses must describe their body, not just a free-text
    /// description, so a generated client can type the failure case.
    #[test]
    fn error_responses_reference_the_error_body() {
        let spec = serde_json::to_value(ApiDoc::openapi()).expect("serialize");

        assert!(
            spec["components"]["schemas"].get("ErrorBody").is_some(),
            "ErrorBody schema is not registered"
        );

        let server_error = &spec["paths"]["/leaderboard"]["get"]["responses"]["500"];
        assert_eq!(
            server_error["content"]["application/json"]["schema"]["$ref"],
            "#/components/schemas/ErrorBody",
            "500 response should carry the ErrorBody schema: {server_error}"
        );
    }
}
