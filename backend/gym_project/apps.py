from django.apps import AppConfig


class GymProjectConfig(AppConfig):
    """Bootstrap app to register infrastructure Huey tasks."""
    name = 'gym_project'
    label = 'gym_project_infra'
    default_auto_field = 'django.db.models.BigAutoField'

    def ready(self):
        import gym_project.tasks  # noqa: F401
