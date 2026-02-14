import pytest
from unittest.mock import mock_open, patch
from django.test import RequestFactory

from gym_app.views.spa import SPAView
def test_spa_view_serves_index_html_when_found(rf):
    request = rf.get('/some/route')

    with patch('gym_app.views.spa.os.path.exists', return_value=True), patch(
        'gym_app.views.spa.open', mock_open(read_data='<!doctype html>SPA'), create=True
    ):
        response = SPAView.as_view()(request)

    assert response.status_code == 200
    assert response['Content-Type'] == 'text/html; charset=utf-8'
    assert b'SPA' in response.content


def test_spa_view_returns_500_when_missing_index(rf):
    request = rf.get('/missing')

    with patch('gym_app.views.spa.os.path.exists', return_value=False):
        response = SPAView.as_view()(request)

    assert response.status_code == 500
    assert response.content == b'SPA index.html not found.'


def test_spa_view_post_serves_index_html(rf):
    """Cover SPAView.post method (line 49)."""
    request = rf.post('/some/route')

    with patch('gym_app.views.spa.os.path.exists', return_value=True), patch(
        'gym_app.views.spa.open', mock_open(read_data='<!doctype html>SPA POST'), create=True
    ):
        response = SPAView.as_view()(request)

    assert response.status_code == 200
    assert b'SPA POST' in response.content


def test_spa_view_post_returns_500_when_missing(rf):
    """Cover SPAView.post fallback to 500."""
    request = rf.post('/missing')

    with patch('gym_app.views.spa.os.path.exists', return_value=False):
        response = SPAView.as_view()(request)

    assert response.status_code == 500


def test_spa_view_static_root_candidate(rf, settings):
    """Cover STATIC_ROOT candidate path (lines 30-31)."""
    settings.STATIC_ROOT = '/tmp/fake_static'
    request = rf.get('/route')

    call_count = {'n': 0}
    def exists_side_effect(path):
        call_count['n'] += 1
        # Return True on the third candidate (STATIC_ROOT path)
        if 'fake_static' in path:
            return True
        return False

    with patch('gym_app.views.spa.os.path.exists', side_effect=exists_side_effect), patch(
        'gym_app.views.spa.open', mock_open(read_data='<!doctype html>STATIC'), create=True
    ):
        response = SPAView.as_view()(request)

    assert response.status_code == 200
    assert b'STATIC' in response.content
