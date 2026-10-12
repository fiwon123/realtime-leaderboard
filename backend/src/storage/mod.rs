//! Postgres access layer. Most queries are compile-time checked with the sqlx
//! `query!`/`query_as!` macros; the few that build SQL dynamically at runtime
//! (e.g. a prefix search) use the runtime API with a fixed statement.

pub mod scores;
