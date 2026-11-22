import hashlib
import os
import re
import secrets
import time
from pathlib import Path

import click
import psycopg
from flask import Blueprint, current_app, g, jsonify, request
from psycopg.rows import dict_row
from werkzeug.security import check_password_hash, generate_password_hash


auth = Blueprint("auth", __name__, url_prefix="/api/auth")
COOKIE_NAME = "gesture_session"
SESSION_AGE = 7 * 24 * 60 * 60
EMAIL_PATTERN = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")
DUMMY_PASSWORD_HASH = generate_password_hash(secrets.token_hex(16))


def configure_auth(app):
    app.config["DATABASE_URL"] = os.environ.get("DATABASE_URL", "")
    app.config["AUTH_COOKIE_SECURE"] = os.environ.get("AUTH_COOKIE_SECURE") == "1"
    app.register_blueprint(auth)

    @app.cli.command("init-auth-db")
    def init_auth_db():
        if not app.config["DATABASE_URL"]:
            raise click.ClickException("Set DATABASE_URL to your Neon Postgres connection string.")
        schema = Path(__file__).with_name("auth_schema.sql").read_text(encoding="utf-8")
        with get_database().transaction():
            get_database().execute(schema)
        click.echo("Authentication tables are ready.")

    @app.teardown_appcontext
    def close_database(_error):
        database = g.pop("auth_database", None)
        if database is not None:
            database.close()


def get_database():
    if "auth_database" not in g:
        database_url = current_app.config["DATABASE_URL"]
        if not database_url:
            raise psycopg.OperationalError("DATABASE_URL is missing.")
        g.auth_database = psycopg.connect(
            database_url, autocommit=True, row_factory=dict_row, prepare_threshold=None,
            connect_timeout=10,
        )
    return g.auth_database


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def account_response(user):
    return jsonify({"user": {"name": user["name"], "email": user["email"]}})


def start_session(database, user):
    token = secrets.token_urlsafe(32)
    previous_token = request.cookies.get(COOKIE_NAME)
    now = int(time.time())
    if previous_token:
        database.execute("DELETE FROM gesture_auth.sessions WHERE token_hash = %s", (token_hash(previous_token),))
    database.execute("DELETE FROM gesture_auth.sessions WHERE expires_at <= %s", (now,))
    database.execute(
        "INSERT INTO gesture_auth.sessions (token_hash, user_id, expires_at) VALUES (%s, %s, %s)",
        (token_hash(token), user["id"], now + SESSION_AGE),
    )
    response = account_response(user)
    response.set_cookie(
        COOKIE_NAME, token, max_age=SESSION_AGE, httponly=True, samesite="Lax",
        secure=request.is_secure or current_app.config["AUTH_COOKIE_SECURE"],
        path=auth.url_prefix,
    )
    return response


@auth.after_request
def prevent_caching(response):
    response.headers["Cache-Control"] = "no-store"
    return response


@auth.errorhandler(psycopg.Error)
def database_unavailable(error):
    current_app.logger.error("Authentication database error (%s)", type(error).__name__)
    return jsonify(error="The account database is unavailable. Try again."), 503


@auth.before_request
def require_json_for_writes():
    if request.method == "POST":
        request.max_content_length = 4096
        if not request.is_json:
            return jsonify(error="Send account requests as JSON."), 415


def credentials():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return "", "", ""
    name, email, password = (data.get(field) for field in ("name", "email", "password"))
    return (
        name.strip() if isinstance(name, str) else "",
        email.strip().casefold() if isinstance(email, str) else "",
        password if isinstance(password, str) else "",
    )


@auth.post("/register")
def register():
    name, email, password = credentials()
    if not 1 <= len(name) <= 80:
        return jsonify(error="Enter a name between 1 and 80 characters."), 400
    if len(email) > 254 or not EMAIL_PATTERN.fullmatch(email):
        return jsonify(error="Enter a valid email address."), 400
    if not 8 <= len(password) <= 128:
        return jsonify(error="Use a password between 8 and 128 characters."), 400

    database = get_database()
    with database.transaction():
        user = database.execute(
            "INSERT INTO gesture_auth.users (name, email, password_hash) VALUES (%s, %s, %s) "
            "ON CONFLICT (email) DO NOTHING RETURNING id, name, email",
            (name, email, generate_password_hash(password)),
        ).fetchone()
        if user is None:
            return jsonify(error="An account with that email already exists."), 409
        response = start_session(database, user)
    return response, 201


@auth.post("/login")
def login():
    _, email, password = credentials()
    if not email or not password or len(email) > 254 or len(password) > 128:
        return jsonify(error="Enter a valid email and password."), 400
    database = get_database()
    user = database.execute(
        "SELECT id, name, email, password_hash FROM gesture_auth.users WHERE email = %s", (email,)
    ).fetchone()
    stored_hash = user["password_hash"] if user else DUMMY_PASSWORD_HASH
    if not check_password_hash(stored_hash, password) or user is None:
        return jsonify(error="Email or password is incorrect."), 401
    with database.transaction():
        return start_session(database, user)


@auth.get("/me")
def current_user():
    token = request.cookies.get(COOKIE_NAME)
    if token:
        user = get_database().execute(
            "SELECT users.name, users.email FROM gesture_auth.sessions AS sessions "
            "JOIN gesture_auth.users AS users ON users.id = sessions.user_id "
            "WHERE sessions.token_hash = %s AND sessions.expires_at > %s",
            (token_hash(token), int(time.time())),
        ).fetchone()
        if user:
            return account_response(user)
    return jsonify(error="Sign in to continue."), 401


@auth.post("/logout")
def logout():
    token = request.cookies.get(COOKIE_NAME)
    if token:
        get_database().execute(
            "DELETE FROM gesture_auth.sessions WHERE token_hash = %s", (token_hash(token),)
        )
    response = jsonify({"user": None})
    response.delete_cookie(
        COOKIE_NAME, path=auth.url_prefix, httponly=True, samesite="Lax",
        secure=request.is_secure or current_app.config["AUTH_COOKIE_SECURE"],
    )
    return response
