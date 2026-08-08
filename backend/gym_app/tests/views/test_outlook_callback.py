"""Tests for the Microsoft (MSAL) OAuth redirect URI page.

The MSAL popup redirects here after Microsoft authenticates the user. It must be
served as a minimal document instead of the SPA: booting the Vue app inside the
popup renders the sign-in form there and races with MSAL for the URL fragment.
"""

import os

import pytest
from django.conf import settings
from django.urls import resolve

from gym_app.views.spa import SPAView

CALLBACK_URL = "/auth/outlook/callback"


def _spa_build_present():
    """Report whether one of the paths SPAView serves from actually exists."""
    base_dir = settings.BASE_DIR
    candidates = [
        os.path.join(base_dir.parent, "frontend", "dist", "index.html"),
        os.path.join(base_dir, "static", "frontend", "index.html"),
    ]
    static_root = getattr(settings, "STATIC_ROOT", None)
    if static_root:
        candidates.append(os.path.join(static_root, "frontend", "index.html"))
    return any(os.path.exists(c) for c in candidates)


def test_outlook_callback_returns_200(client):
    """Serve the redirect URI so Microsoft's redirect does not 404."""
    response = client.get(CALLBACK_URL)

    assert response.status_code == 200


def test_outlook_callback_does_not_serve_the_spa_shell(client):
    """The popup must not boot the Vue application."""
    response = client.get(CALLBACK_URL)

    assert b'id="app"' not in response.content


def test_outlook_callback_tells_the_user_the_window_can_be_closed(client):
    """Give a readable message if the popup is left open."""
    response = client.get(CALLBACK_URL)

    assert "puede cerrar esta ventana" in response.content.decode().lower()


def test_outlook_callback_is_never_cached(client):
    """A cached popup document could replay a stale authorization response."""
    response = client.get(CALLBACK_URL)

    assert response["Cache-Control"] == "no-store"


def test_outlook_callback_does_not_sever_the_popup_opener(client):
    """Keep the popup in its opener's browsing context group.

    A stricter COOP moves the popup to a new browsing context group on its way
    back from Microsoft, severing window.opener so MSAL can never close it.
    """
    response = client.get(CALLBACK_URL)

    assert response["Cross-Origin-Opener-Policy"] == "unsafe-none"


def test_outlook_callback_with_trailing_slash_returns_200(client):
    """Accept the trailing-slash variant so APPEND_SLASH cannot break the popup."""
    response = client.get(f"{CALLBACK_URL}/")

    assert response.status_code == 200


def test_unknown_route_still_serves_the_spa(client):
    """The callback route must not shadow the SPA catch-all."""
    # The routing half is what this test is actually about, and it holds in every
    # environment: /some-vue-route must resolve to the SPA catch-all rather than
    # being swallowed by the callback route registered just above it.
    assert resolve("/some-vue-route").func.view_class is SPAView

    # The rendering half needs a built SPA, and NONE of the four candidates
    # SpaView looks for is tracked in git (two are gitignored outright:
    # backend/static/frontend/ and backend/staticfiles/). The backend-tests CI
    # job checks out clean and never builds the frontend, so asserting a 200
    # unconditionally made this test permanently red there while passing on any
    # machine with a deployed build — a false signal in both directions. Assert
    # it only where the artifact exists.
    if not _spa_build_present():
        pytest.skip("no built SPA index.html on this machine — routing asserted above")

    response = client.get("/some-vue-route")

    assert response.status_code == 200
    assert b'id="app"' in response.content
