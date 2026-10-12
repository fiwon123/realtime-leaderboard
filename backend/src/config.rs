//! Environment-driven configuration.

use std::collections::HashMap;

/// Runtime configuration, read once at startup.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Config {
    /// Postgres connection string (`DATABASE_URL`).
    pub database_url: String,
    /// Redis connection string (`REDIS_URL`).
    pub redis_url: String,
    /// HTTP listen port (`PORT`, defaults to 8080).
    pub port: u16,
    /// Shared secret guarding the admin routes (`ADMIN_TOKEN`). `None` disables
    /// them, so a deployment that forgets to set the token exposes no admin
    /// surface rather than an unguarded one.
    pub admin_token: Option<String>,
}

/// Reasons configuration could not be built.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum ConfigError {
    #[error("missing required environment variable: {0}")]
    Missing(&'static str),
    #[error("invalid value for {name}: {value:?}")]
    Invalid { name: &'static str, value: String },
}

impl Config {
    /// Read configuration from the process environment.
    ///
    /// Uses `vars_os` so a non-UTF-8 environment value cannot panic startup.
    pub fn from_env() -> Result<Self, ConfigError> {
        let vars = std::env::vars_os()
            .filter_map(|(key, value)| Some((key.into_string().ok()?, value.into_string().ok()?)))
            .collect();
        Self::from_vars(vars)
    }

    /// Build configuration from an explicit variable map (used by tests).
    pub fn from_vars(vars: HashMap<String, String>) -> Result<Self, ConfigError> {
        let database_url = required(&vars, "DATABASE_URL")?;
        let redis_url = required(&vars, "REDIS_URL")?;

        let port = match vars.get("PORT") {
            Some(raw) if !raw.is_empty() => {
                raw.parse::<u16>().map_err(|_| ConfigError::Invalid {
                    name: "PORT",
                    value: raw.clone(),
                })?
            }
            _ => 8080,
        };

        // A blank token is treated as absent: an empty bearer value must never
        // authenticate, and "set but empty" is a common config mistake.
        let admin_token = vars
            .get("ADMIN_TOKEN")
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .map(str::to_string);

        Ok(Self {
            database_url,
            redis_url,
            port,
            admin_token,
        })
    }
}

fn required(vars: &HashMap<String, String>, name: &'static str) -> Result<String, ConfigError> {
    match vars.get(name) {
        Some(value) if !value.trim().is_empty() => Ok(value.clone()),
        _ => Err(ConfigError::Missing(name)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vars(pairs: &[(&str, &str)]) -> HashMap<String, String> {
        pairs
            .iter()
            .map(|(k, v)| ((*k).to_string(), (*v).to_string()))
            .collect()
    }

    #[test]
    fn reads_all_values() {
        let config = Config::from_vars(vars(&[
            ("DATABASE_URL", "postgres://localhost/db"),
            ("REDIS_URL", "redis://localhost"),
            ("PORT", "9000"),
        ]))
        .expect("valid config");

        assert_eq!(config.database_url, "postgres://localhost/db");
        assert_eq!(config.redis_url, "redis://localhost");
        assert_eq!(config.port, 9000);
    }

    #[test]
    fn port_defaults_to_8080() {
        let config = Config::from_vars(vars(&[("DATABASE_URL", "x"), ("REDIS_URL", "y")])).unwrap();
        assert_eq!(config.port, 8080);
    }

    #[test]
    fn admin_token_defaults_to_disabled() {
        let config = Config::from_vars(vars(&[("DATABASE_URL", "x"), ("REDIS_URL", "y")])).unwrap();
        assert_eq!(config.admin_token, None);
    }

    #[test]
    fn blank_admin_token_is_disabled() {
        let config = Config::from_vars(vars(&[
            ("DATABASE_URL", "x"),
            ("REDIS_URL", "y"),
            ("ADMIN_TOKEN", "   "),
        ]))
        .unwrap();
        assert_eq!(config.admin_token, None);
    }

    #[test]
    fn admin_token_is_read() {
        let config = Config::from_vars(vars(&[
            ("DATABASE_URL", "x"),
            ("REDIS_URL", "y"),
            ("ADMIN_TOKEN", "s3cret"),
        ]))
        .unwrap();
        assert_eq!(config.admin_token.as_deref(), Some("s3cret"));
    }

    #[test]
    fn missing_database_url_is_an_error() {
        let err = Config::from_vars(vars(&[("REDIS_URL", "y")])).unwrap_err();
        assert_eq!(err, ConfigError::Missing("DATABASE_URL"));
    }

    #[test]
    fn empty_database_url_is_an_error() {
        let err = Config::from_vars(vars(&[("DATABASE_URL", ""), ("REDIS_URL", "y")])).unwrap_err();
        assert_eq!(err, ConfigError::Missing("DATABASE_URL"));
    }

    #[test]
    fn invalid_port_is_an_error() {
        let err = Config::from_vars(vars(&[
            ("DATABASE_URL", "x"),
            ("REDIS_URL", "y"),
            ("PORT", "not-a-port"),
        ]))
        .unwrap_err();
        assert_eq!(
            err,
            ConfigError::Invalid {
                name: "PORT",
                value: "not-a-port".to_string()
            }
        );
    }
}
