"""Tests for the Microsoft (MSAL) OAuth redirect URI page.

The MSAL popup redirects here after Microsoft authenticates the user. It must be
served as a minimal document instead of the SPA: booting the Vue app inside the
popup renders the sign-in form there and races with MSAL for the URL fragment.
"""

CALLBACK_URL = "/auth/outlook/callback"


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


def test_outlook_callback_with_trailing_slash_returns_200(client):
    """Accept the trailing-slash variant so APPEND_SLASH cannot break the popup."""
    response = client.get(f"{CALLBACK_URL}/")

    assert response.status_code == 200


def test_unknown_route_still_serves_the_spa(client):
    """The callback route must not shadow the SPA catch-all."""
    response = client.get("/some-vue-route")

    assert response.status_code == 200
    assert b'id="app"' in response.content
