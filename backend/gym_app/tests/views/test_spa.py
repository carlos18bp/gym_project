"""Tests for SPAView fallback behavior and static index serving.

Covers both branches of `_render_spa`:
- Production (DEBUG=False) path: Django template render succeeds.
- Production fallback: render raises TemplateDoesNotExist → candidate file paths.
- Dev (DEBUG=True) path: skips template render, goes straight to candidate files.
"""

from unittest.mock import mock_open, patch

from django.http import HttpResponse
from django.template import TemplateDoesNotExist

from gym_app.views.spa import SPAView


# ------------------------------------------------------------------
# Production-mode path (DEBUG=False)
# ------------------------------------------------------------------


def test_renders_template_when_debug_false_and_template_exists(rf, settings):
    settings.DEBUG = False
    request = rf.get('/some/route')

    rendered = HttpResponse('rendered by django', content_type='text/html; charset=utf-8')
    with patch('gym_app.views.spa.render', return_value=rendered) as mock_render:
        response = SPAView.as_view()(request)

    mock_render.assert_called_once_with(request, 'index.html')
    assert response.status_code == 200
    assert response.content == b'rendered by django'


def test_falls_back_to_candidate_paths_when_template_missing_in_production(rf, settings):
    settings.DEBUG = False
    request = rf.get('/route')

    with patch('gym_app.views.spa.render', side_effect=TemplateDoesNotExist('index.html')), \
         patch('gym_app.views.spa.os.path.exists', return_value=True), \
         patch('gym_app.views.spa.open', mock_open(read_data='<!doctype html>FALLBACK'), create=True):
        response = SPAView.as_view()(request)

    assert response.status_code == 200
    assert b'FALLBACK' in response.content
    assert response['Content-Type'] == 'text/html; charset=utf-8'


# ------------------------------------------------------------------
# Debug-mode path (DEBUG=True) — skips Django render
# ------------------------------------------------------------------


def test_serves_first_candidate_file_in_debug_mode(rf, settings):
    settings.DEBUG = True
    request = rf.get('/some/route')

    with patch('gym_app.views.spa.os.path.exists', return_value=True), \
         patch('gym_app.views.spa.open', mock_open(read_data='<!doctype html>DEV SPA'), create=True):
        response = SPAView.as_view()(request)

    assert response.status_code == 200
    assert response['Content-Type'] == 'text/html; charset=utf-8'
    assert b'DEV SPA' in response.content


def test_uses_static_root_candidate_when_other_paths_missing(rf, settings):
    settings.DEBUG = True
    settings.STATIC_ROOT = '/tmp/fake_static'
    request = rf.get('/route')

    def exists_side_effect(path):
        return 'fake_static' in path

    with patch('gym_app.views.spa.os.path.exists', side_effect=exists_side_effect), \
         patch('gym_app.views.spa.open', mock_open(read_data='<!doctype html>STATIC ROOT'), create=True):
        response = SPAView.as_view()(request)

    assert response.status_code == 200
    assert b'STATIC ROOT' in response.content


def test_returns_500_when_no_candidate_exists(rf, settings):
    settings.DEBUG = True
    request = rf.get('/missing')

    with patch('gym_app.views.spa.os.path.exists', return_value=False):
        response = SPAView.as_view()(request)

    assert response.status_code == 500
    assert response.content == b'SPA index.html not found.'


def test_skips_static_root_candidate_when_setting_is_none(rf, settings):
    settings.DEBUG = True
    settings.STATIC_ROOT = None
    request = rf.get('/route')

    with patch('gym_app.views.spa.os.path.exists', return_value=False):
        response = SPAView.as_view()(request)

    assert response.status_code == 500


# ------------------------------------------------------------------
# HTTP method coverage
# ------------------------------------------------------------------


def test_post_method_also_serves_index(rf, settings):
    settings.DEBUG = True
    request = rf.post('/some/route')

    with patch('gym_app.views.spa.os.path.exists', return_value=True), \
         patch('gym_app.views.spa.open', mock_open(read_data='<!doctype html>POST'), create=True):
        response = SPAView.as_view()(request)

    assert response.status_code == 200
    assert b'POST' in response.content


def test_post_method_returns_500_when_missing(rf, settings):
    settings.DEBUG = True
    request = rf.post('/missing')

    with patch('gym_app.views.spa.os.path.exists', return_value=False):
        response = SPAView.as_view()(request)

    assert response.status_code == 500
