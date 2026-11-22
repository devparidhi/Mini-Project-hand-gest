CREATE SCHEMA IF NOT EXISTS gesture_auth;

CREATE TABLE IF NOT EXISTS gesture_auth.users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS gesture_auth.sessions (
    token_hash TEXT PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES gesture_auth.users(id) ON DELETE CASCADE,
    expires_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS gesture_auth_sessions_expiry ON gesture_auth.sessions (expires_at);
