import pytest
from django.contrib.auth import get_user_model
from rest_framework_simplejwt.tokens import RefreshToken

from gym_app.utils.auth_utils import generate_auth_tokens


User = get_user_model()


@pytest.mark.django_db
class TestGenerateAuthTokens:
    def test_generate_auth_tokens_structure_and_user_data(self):
        user = User.objects.create_user(
            email="user@example.com",
            password="testpassword",
            first_name="Test",
            last_name="User",
            role="client",
        )

        data = generate_auth_tokens(user)

        assert "refresh" in data
        assert "access" in data
        assert "user" in data

        # Tokens deben ser strings no vacíos
        assert isinstance(data["refresh"], str) and data["refresh"]
        assert isinstance(data["access"], str) and data["access"]

        # Datos de usuario serializados
        user_data = data["user"]
        assert user_data["email"] == user.email
        assert user_data["first_name"] == user.first_name
        assert user_data["last_name"] == user.last_name
