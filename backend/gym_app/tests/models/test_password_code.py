import pytest
import re
from datetime import datetime, timedelta
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from gym_app.models.user import User  # Asumiendo que User está en este módulo
from gym_app.models.password_code import PasswordCode

@pytest.fixture
def user():
    """Create a user for testing"""
    return User.objects.create_user(
        email='test@example.com',
        password='testpassword',
        first_name='Test',
        last_name='User'
    )

@pytest.fixture
def password_code(user):
    """Create a password reset code for testing"""
    return PasswordCode.objects.create(
        user=user,
        code='123456'
    )

@pytest.mark.django_db
class TestPasswordCode:
    
    def test_create_password_code(self, user):
        """Test creating a password reset code"""
        code = PasswordCode.objects.create(
            user=user,
            code='654321'
        )
        
        assert code.id is not None
        assert code.user == user
        assert code.code == '654321'
        assert code.used is False
        assert code.created_at is not None
    
    def test_code_validation(self, user):
        """Test validation of the password code format"""
        # Valid 6-digit code
        valid_code = PasswordCode(user=user, code='123456')
        valid_code.full_clean()  # Should not raise ValidationError
        
        # Invalid code - too short
        invalid_code_short = PasswordCode(user=user, code='12345')
        with pytest.raises(ValidationError):
            invalid_code_short.full_clean()
        
        # Invalid code - too long
        invalid_code_long = PasswordCode(user=user, code='1234567')
        with pytest.raises(ValidationError):
            invalid_code_long.full_clean()
        
        # Invalid code - non-numeric
        invalid_code_alpha = PasswordCode(user=user, code='12345a')
        with pytest.raises(ValidationError):
            invalid_code_alpha.full_clean()
    
    def test_mark_code_as_used(self, password_code):
        """Test marking a password code as used"""
        assert password_code.used is False
        
        # Mark as used
        password_code.used = True
        password_code.save()
        
        # Verify code was marked as used
        password_code.refresh_from_db()
        assert password_code.used is True
    
    def test_str_representation(self, password_code):
        """Test string representation of a password code"""
        expected = f'{password_code.user.email} - {password_code.code}'
        assert str(password_code) == expected
    
    def test_ordering(self, user):
        """Test that password codes are ordered by created_at in descending order"""
        # Create codes with different timestamps
        code1 = PasswordCode.objects.create(user=user, code='111111')
        
        # Manually update created_at to simulate older record
        PasswordCode.objects.filter(id=code1.id).update(
            created_at=datetime.now() - timedelta(days=1)
        )
        
        code2 = PasswordCode.objects.create(user=user, code='222222')
        
        # Retrieve codes and check ordering
        codes = PasswordCode.objects.all()
        assert codes[0].code == '222222'  # Newest first
        assert codes[1].code == '111111'  # Oldest last
    
    def test_multiple_codes_per_user(self, user):
        """Test creating multiple password codes for the same user"""
        codes = ['111111', '222222', '333333']
        
        # Create multiple codes for the same user
        for code in codes:
            PasswordCode.objects.create(user=user, code=code)
        
        # Verify all codes were created
        user_codes = PasswordCode.objects.filter(user=user)
        assert user_codes.count() == len(codes)
        
        # Verify all expected codes exist
        db_codes = [pc.code for pc in user_codes]
        for code in codes:
            assert code in db_codes
    
    def test_delete_user_cascades_to_codes(self, user, password_code):
        """Test that deleting a user cascades to delete their password codes"""
        user_id = user.id
        code_id = password_code.id
        
        # Delete the user
        user.delete()
        
        # Verify the password code was also deleted
        assert not PasswordCode.objects.filter(id=code_id).exists()
