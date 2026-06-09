import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

MOCK_ADMIN = {
    "id": "admin-uuid-1",
    "email": "admin@test.com",
    "full_name": "Admin User",
    "role": "admin",
    "is_active": True,
    "wa_contact_id": None,
    "auth_user_id": "auth-admin-uuid",
    "created_at": "2026-06-09T00:00:00+00:00",
    "updated_at": "2026-06-09T00:00:00+00:00",
}

MOCK_AGENT = {
    "id": "agent-uuid-1",
    "email": "agent@test.com",
    "full_name": "Test Agent",
    "role": "agent",
    "is_active": True,
    "wa_contact_id": None,
    "auth_user_id": "auth-agent-uuid",
    "created_at": "2026-06-09T00:00:00+00:00",
    "updated_at": "2026-06-09T00:00:00+00:00",
}

MOCK_WA = {
    "id": "wa-uuid-1",
    "agent_id": "agent-uuid-1",
    "phone_number": "+5491100000000",
    "phone_number_id": "meta-phone-id-1",
    "display_name": "Agente 1",
    "is_active": True,
    "enabled_by": "admin-uuid-1",
    "enabled_at": "2026-06-09T00:00:00+00:00",
    "disabled_at": None,
}

ADMIN_HEADERS = {"Authorization": "Bearer mock.admin.token"}


def _mock_admin_auth(mock_decode, mock_sb):
    """Patch auth so require_admin resolves to MOCK_ADMIN."""
    mock_decode.return_value = {"sub": "auth-admin-uuid"}
    mock_sb.return_value.schema.return_value.table.return_value \
        .select.return_value.eq.return_value.single.return_value \
        .execute.return_value.data = MOCK_ADMIN


# ── GET /admin/agents ───────────────────────────────────────────────────────

class TestListAgents:
    def test_returns_agent_list(self):
        with patch("app.core.auth.get_supabase") as mock_sb, \
             patch("app.core.auth._decode_supabase_token") as mock_decode, \
             patch("app.routers.admin.get_supabase") as mock_sb_admin:

            _mock_admin_auth(mock_decode, mock_sb)
            mock_sb_admin.return_value.schema.return_value.table.return_value \
                .select.return_value.eq.return_value.execute.return_value.data = [MOCK_AGENT]

            r = client.get("/admin/agents", headers=ADMIN_HEADERS)

        assert r.status_code == 200
        assert r.json()[0]["email"] == "agent@test.com"

    def test_rejects_non_admin(self):
        non_admin = {**MOCK_AGENT, "role": "agent"}

        with patch("app.core.auth.get_supabase") as mock_sb, \
             patch("app.core.auth._decode_supabase_token") as mock_decode:

            mock_decode.return_value = {"sub": "auth-agent-uuid"}
            mock_sb.return_value.schema.return_value.table.return_value \
                .select.return_value.eq.return_value.single.return_value \
                .execute.return_value.data = non_admin

            r = client.get("/admin/agents", headers={"Authorization": "Bearer agent.token"})

        assert r.status_code == 403


# ── POST /admin/agents ──────────────────────────────────────────────────────

class TestCreateAgent:
    def test_creates_agent(self):
        mock_auth_user = MagicMock()
        mock_auth_user.user.id = "new-auth-uuid"

        with patch("app.core.auth.get_supabase") as mock_sb, \
             patch("app.core.auth._decode_supabase_token") as mock_decode, \
             patch("app.routers.admin.get_supabase") as mock_sb_admin:

            _mock_admin_auth(mock_decode, mock_sb)
            sb = mock_sb_admin.return_value
            sb.auth.admin.create_user.return_value = mock_auth_user
            sb.schema.return_value.table.return_value.insert.return_value \
                .execute.return_value.data = [{**MOCK_AGENT, "auth_user_id": "new-auth-uuid"}]

            r = client.post("/admin/agents", headers=ADMIN_HEADERS, json={
                "email": "new@agent.com",
                "full_name": "New Agent",
                "password": "secure123",
            })

        assert r.status_code == 201
        assert r.json()["role"] == "agent"

    def test_create_agent_supabase_error(self):
        with patch("app.core.auth.get_supabase") as mock_sb, \
             patch("app.core.auth._decode_supabase_token") as mock_decode, \
             patch("app.routers.admin.get_supabase") as mock_sb_admin:

            _mock_admin_auth(mock_decode, mock_sb)
            mock_sb_admin.return_value.auth.admin.create_user.side_effect = Exception("Email taken")

            r = client.post("/admin/agents", headers=ADMIN_HEADERS, json={
                "email": "dup@agent.com",
                "full_name": "Dup",
                "password": "pass",
            })

        assert r.status_code == 400


# ── PATCH /admin/agents/{id}/activate ───────────────────────────────────────

class TestToggleAgent:
    def test_toggles_active_state(self):
        with patch("app.core.auth.get_supabase") as mock_sb, \
             patch("app.core.auth._decode_supabase_token") as mock_decode, \
             patch("app.routers.admin.get_supabase") as mock_sb_admin:

            _mock_admin_auth(mock_decode, mock_sb)
            sb = mock_sb_admin.return_value
            sb.schema.return_value.table.return_value.select.return_value \
                .eq.return_value.single.return_value.execute.return_value.data = {"is_active": True}
            sb.schema.return_value.table.return_value.update.return_value \
                .eq.return_value.execute.return_value.data = [{**MOCK_AGENT, "is_active": False}]

            r = client.patch("/admin/agents/agent-uuid-1/activate", headers=ADMIN_HEADERS)

        assert r.status_code == 200
        assert r.json()["is_active"] is False

    def test_toggle_agent_not_found(self):
        with patch("app.core.auth.get_supabase") as mock_sb, \
             patch("app.core.auth._decode_supabase_token") as mock_decode, \
             patch("app.routers.admin.get_supabase") as mock_sb_admin:

            _mock_admin_auth(mock_decode, mock_sb)
            mock_sb_admin.return_value.schema.return_value.table.return_value \
                .select.return_value.eq.return_value.single.return_value \
                .execute.return_value.data = None

            r = client.patch("/admin/agents/nonexistent/activate", headers=ADMIN_HEADERS)

        assert r.status_code == 404


# ── GET /admin/whatsapp ─────────────────────────────────────────────────────

class TestListWhatsApp:
    def test_returns_wa_list(self):
        with patch("app.core.auth.get_supabase") as mock_sb, \
             patch("app.core.auth._decode_supabase_token") as mock_decode, \
             patch("app.routers.admin.get_supabase") as mock_sb_admin:

            _mock_admin_auth(mock_decode, mock_sb)
            mock_sb_admin.return_value.schema.return_value.table.return_value \
                .select.return_value.execute.return_value.data = [MOCK_WA]

            r = client.get("/admin/whatsapp", headers=ADMIN_HEADERS)

        assert r.status_code == 200
        assert r.json()[0]["phone_number"] == "+5491100000000"


# ── POST /admin/whatsapp ────────────────────────────────────────────────────

class TestCreateWhatsApp:
    def test_registers_number(self):
        with patch("app.core.auth.get_supabase") as mock_sb, \
             patch("app.core.auth._decode_supabase_token") as mock_decode, \
             patch("app.routers.admin.get_supabase") as mock_sb_admin:

            _mock_admin_auth(mock_decode, mock_sb)
            mock_sb_admin.return_value.schema.return_value.table.return_value \
                .insert.return_value.execute.return_value.data = [MOCK_WA]

            r = client.post("/admin/whatsapp", headers=ADMIN_HEADERS, json={
                "agent_id": "agent-uuid-1",
                "phone_number": "+5491100000000",
                "phone_number_id": "meta-phone-id-1",
                "display_name": "Agente 1",
            })

        assert r.status_code == 201
        assert r.json()["phone_number"] == "+5491100000000"


# ── PATCH /admin/whatsapp/{id}/toggle ───────────────────────────────────────

class TestToggleWhatsApp:
    def test_disables_active_number(self):
        with patch("app.core.auth.get_supabase") as mock_sb, \
             patch("app.core.auth._decode_supabase_token") as mock_decode, \
             patch("app.routers.admin.get_supabase") as mock_sb_admin:

            _mock_admin_auth(mock_decode, mock_sb)
            sb = mock_sb_admin.return_value
            sb.schema.return_value.table.return_value.select.return_value \
                .eq.return_value.single.return_value.execute.return_value.data = {"is_active": True}
            sb.schema.return_value.table.return_value.update.return_value \
                .eq.return_value.execute.return_value.data = [{**MOCK_WA, "is_active": False, "disabled_at": "2026-06-09T01:00:00+00:00"}]

            r = client.patch("/admin/whatsapp/wa-uuid-1/toggle", headers=ADMIN_HEADERS)

        assert r.status_code == 200
        assert r.json()["is_active"] is False

    def test_toggle_wa_not_found(self):
        with patch("app.core.auth.get_supabase") as mock_sb, \
             patch("app.core.auth._decode_supabase_token") as mock_decode, \
             patch("app.routers.admin.get_supabase") as mock_sb_admin:

            _mock_admin_auth(mock_decode, mock_sb)
            mock_sb_admin.return_value.schema.return_value.table.return_value \
                .select.return_value.eq.return_value.single.return_value \
                .execute.return_value.data = None

            r = client.patch("/admin/whatsapp/nonexistent/toggle", headers=ADMIN_HEADERS)

        assert r.status_code == 404
