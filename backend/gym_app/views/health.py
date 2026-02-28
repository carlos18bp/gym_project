import time

from django.db import connection
from django.http import JsonResponse
from redis import Redis

from django.conf import settings


def health_check(request):
    """
    Lightweight health-check endpoint for uptime monitors.
    Returns HTTP 200 when the app, database and Redis are reachable.
    """
    status = {"app": "ok"}
    healthy = True

    # Database check
    try:
        start = time.monotonic()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        status["database"] = "ok"
        status["database_ms"] = round((time.monotonic() - start) * 1000, 1)
    except Exception as exc:
        status["database"] = str(exc)
        healthy = False

    # Redis check
    try:
        redis_url = getattr(settings, "HUEY", None)
        if redis_url:
            r = Redis.from_url(settings.HUEY.storage.url if hasattr(settings.HUEY, "storage") else "redis://localhost:6379/1")
        else:
            r = Redis.from_url("redis://localhost:6379/1")
        start = time.monotonic()
        r.ping()
        status["redis"] = "ok"
        status["redis_ms"] = round((time.monotonic() - start) * 1000, 1)
    except Exception as exc:
        status["redis"] = str(exc)
        healthy = False

    return JsonResponse(status, status=200 if healthy else 503)
