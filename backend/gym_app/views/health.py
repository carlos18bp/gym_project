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
        huey_conf = getattr(settings, "HUEY", None)
        if huey_conf and hasattr(huey_conf, "storage") and hasattr(huey_conf.storage, "url"):
            redis_conn_url = huey_conf.storage.url
        else:
            from decouple import config as env_config
            redis_conn_url = env_config('REDIS_URL', default='redis://localhost:6379/1')
        r = Redis.from_url(redis_conn_url)
        start = time.monotonic()
        r.ping()
        status["redis"] = "ok"
        status["redis_ms"] = round((time.monotonic() - start) * 1000, 1)
    except Exception as exc:
        status["redis"] = str(exc)
        healthy = False

    return JsonResponse(status, status=200 if healthy else 503)
