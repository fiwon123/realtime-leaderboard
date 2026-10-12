//! Binary entrypoint: load config, connect pools, serve the router.

use std::net::SocketAddr;

use realtime_leaderboard::{app, AppState, Config};
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let config = Config::from_env()?;

    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await
        .map_err(|err| {
            // The detail may embed the connection string (with its password), so
            // log it rather than returning it to be printed on exit.
            tracing::error!(error = %err, "failed to connect to Postgres");
            StartupError("failed to connect to Postgres")
        })?;

    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .map_err(|err| {
            tracing::error!(error = %err, "failed to run migrations");
            StartupError("failed to run migrations")
        })?;

    let redis_client = redis::Client::open(config.redis_url.as_str()).map_err(|err| {
        tracing::error!(error = %err, "invalid REDIS_URL");
        StartupError("invalid REDIS_URL")
    })?;
    let redis = redis::aio::ConnectionManager::new(redis_client)
        .await
        .map_err(|err| {
            tracing::error!(error = %err, "failed to connect to Redis");
            StartupError("failed to connect to Redis")
        })?;

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let listener = tokio::net::TcpListener::bind(addr).await?;

    tracing::info!(%addr, "realtime-leaderboard listening");
    let state = AppState {
        db,
        redis,
        admin_token: config.admin_token.clone(),
    };
    axum::serve(listener, app(state))
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

/// A startup failure whose message is safe to print (no connection strings).
#[derive(Debug)]
struct StartupError(&'static str);

impl std::fmt::Display for StartupError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.0)
    }
}

impl std::error::Error for StartupError {}

/// Resolve when the process receives Ctrl+C or SIGTERM.
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("shutdown signal received");
}
