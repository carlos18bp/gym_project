from django.apps import AppConfig


class LogInAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'gym_app'

    def ready(self):
        import gym_app.secop_tasks  # noqa: F401
        import gym_app.notification_tasks  # noqa: F401
        import gym_app.process_alert_tasks  # noqa: F401
