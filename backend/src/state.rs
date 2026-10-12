//! Shared application state handed to every route handler.

use redis::aio::ConnectionManager;
use sqlx::PgPool;

/// Cheap to clone: `PgPool` and `ConnectionManager` are both `Arc`-backed.
#[derive(Clone)]
pub struct AppState {
    pub db: PgPool,
    pub redis: ConnectionManager,
    /// Shared secret guarding the admin routes; `None` disables them.
    pub admin_token: Option<String>,
}
