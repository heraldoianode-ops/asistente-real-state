import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

MOCK_USER = {
    "id": "user-uuid-1",
    "email": "agent@test.com",
    "full_name": "Test Agent",
    "role": "agent",
    "is_active": True,
    "wa_contact_id": None,
    "auth_user_id": "auth-uuid-1",
    "created_at": "2026-06-09T00:00:00+00:00",
    "updated_at": "2026-06-09T00:00:00+00:00",
}

MOCK_SESSION = MagicMock()
MOCK_SESSION.access_token = "mock.jwt.token"
MOCK_SESSION.expires_in = 3600


# ── POST /auth/login ────────────────────────────────────────────────────────

class TestLogin:
    def test_login_success(self):
        mock_resp = MagicMock()
        mock_resp.session = MOCK_SESSION

        with patch("app.routers.auth.get_supabase") as mock_sb:
            mock_sb.return_value.auth.sign_in_with_password.return_value = mock_resp
            r = client.post("/auth/login", json={"email": "agent@test.com", "password": "pass"})

        assert r.status_code == 200
        data = r.json()
        assert data["access_token"] == "mock.jwt.token"
        assert data["expires_in"] == 3600

    def test_login_invalid_credentials(self):
        with patch("app.routers.auth.get_supabase") as mock_sb:
            mock_sb.return_value.auth.sign_in_with_password.side_effect = Exception("Invalid login")
            r = client.post("/auth/login", json={"email": "bad@test.com", "password": "wrong"})

        assert r.status_code == 401

    def test_login_no_session(self):
        mock_resp = MagicMock()
        mock_resp.session = None

        with patch("app.routers.auth.get_supabase") as mock_sb:
            mock_sb.return_value.auth.sign_in_with_password.return_value = mock_resp
            r = client.post("/auth/login", json={"email": "a@b.com", "password": "p"})

        assert r.status_code == 401

    def test_login_missing_fields(self):
        r = client.post("/auth/login", json={"email": "only@email.com"})
        assert r.status_code == 422


# ── GET /auth/me ────────────────────────────────────────────────────────────

class TestMe:
    def test_me_returns_current_user(self):
        with patch("app.core.auth.get_supabase") as mock_sb, \
             patch("app.core.auth._decode_supabase_token") as mock_decode:

            mock_decode.return_value = {"sub": "auth-uuid-1"}
            mock_sb.return_value.schema.return_value.table.return_value \
                .select.return_value.eq.return_value.single.return_value \
                .execute.return_value.data = MOCK_USER

            r = client.get("/auth/me", headers={"Authorization": "Bearer mock.jwt.token"})

        assert r.status_code == 200
        assert r.json()["email"] == "agent@test.com"

    def test_me_no_token(self):
        r = client.get("/auth/me")
        assert r.status_code == 403

    def test_me_inactive_user(self):
        inactive = {**MOCK_USER, "is_active": False}

        with patch("app.core.auth.get_supabase") as mock_sb, \
             patch("app.core.auth._decode_supabase_token") as mock_decode:

            mock_decode.return_value = {"sub": "auth-uuid-1"}
            mock_sb.return_value.schema.return_value.table.return_value \
                .select.return_value.eq.return_value.single.return_value \
                .execute.return_value.data = inactive

            r = client.get("/auth/me", headers={"Authorization": "Bearer mock.jwt.token"})

        assert r.status_code == 403


# ── POST /auth/logout ───────────────────────────────────────────────────────

class TestLogout:
    def test_logout_success(self):
        with patch("app.core.auth.get_supabase") as mock_sb_auth, \
             patch("app.core.auth._decode_supabase_token") as mock_decode, \
             patch("app.routers.auth.get_supabase") as mock_sb_logout:

            mock_decode.return_value = {"sub": "auth-uuid-1"}
            mock_sb_auth.return_value.schema.return_value.table.return_value \
                .select.return_value.eq.return_value.single.return_value \
                .execute.return_value.data = MOCK_USER
            mock_sb_logout.return_value.auth.sign_out.return_value = None

            r = client.post("/auth/logout", headers={"Authorization": "Bearer mock.jwt.token"})

        assert r.status_code == 204
