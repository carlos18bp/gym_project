import pytest
from datetime import date
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from gym_app.models.user import User, UserManager

@pytest.mark.django_db
class TestUserManager:
    
    def test_create_user(self):
        """Test creating a regular user with the UserManager"""
        user = User.objects.create_user(
            email='test@example.com',
            password='testpassword',
            first_name='Test',
            last_name='User'
        )
        
        assert user.id is not None
        assert user.email == 'test@example.com'
        assert user.check_password('testpassword')
        assert user.first_name == 'Test'
        assert user.last_name == 'User'
        assert user.is_staff is False
        assert user.is_superuser is False
        assert user.role == 'client'  # Default role
    
    def test_create_user_without_email(self):
        """Test that creating a user without an email raises an error"""
        with pytest.raises(ValueError) as excinfo:
            User.objects.create_user(email='', password='testpassword')
        
        assert 'The email must be defined' in str(excinfo.value)
    
    def test_create_superuser(self):
        """Test creating a superuser with the UserManager"""
        admin = User.objects.create_superuser(
            email='admin@example.com',
            password='adminpassword',
            first_name='Admin',
            last_name='User'
        )
        
        assert admin.id is not None
        assert admin.email == 'admin@example.com'
        assert admin.check_password('adminpassword')
        assert admin.first_name == 'Admin'
        assert admin.last_name == 'User'
        assert admin.is_staff is True
        assert admin.is_superuser is True
    
    def test_create_superuser_with_invalid_flags(self):
        """Test that creating a superuser with invalid flags raises an error"""
        with pytest.raises(ValueError) as excinfo:
            User.objects.create_superuser(
                email='admin@example.com',
                password='adminpassword',
                is_staff=False
            )
        
        assert 'Superuser must have is_staff=True' in str(excinfo.value)
        
        with pytest.raises(ValueError) as excinfo:
            User.objects.create_superuser(
                email='admin@example.com',
                password='adminpassword',
                is_superuser=False
            )
        
        assert 'Superuser must have is_superuser=True' in str(excinfo.value)

@pytest.mark.django_db
class TestUser:
    
    def test_user_creation_minimal(self):
        """Test creating a user with minimal fields"""
        user = User.objects.create(
            email='minimal@example.com',
            password='raw_password'  # Note: This doesn't hash the password
        )
        
        assert user.id is not None
        assert user.email == 'minimal@example.com'
        assert user.first_name is None
        assert user.last_name is None
        assert user.contact is None
        assert user.birthday is None
        assert user.identification is None
        assert user.document_type is None
        assert user.role == 'client'  # Default role
        assert user.is_gym_lawyer is False  # Default value
        assert user.is_profile_completed is False  # Default value
    
    def test_user_creation_complete(self):
        """Test creating a user with all fields"""
        test_photo = SimpleUploadedFile(
            "profile.jpg",
            b"file_content",
            content_type="image/jpeg"
        )
        
        user = User.objects.create(
            email='complete@example.com',
            password='raw_password',
            first_name='Complete',
            last_name='User',
            contact='1234567890',
            birthday=date(1990, 1, 1),
            identification='ID12345',
            document_type='CC',
            role='lawyer',
            photo_profile=test_photo,
            is_gym_lawyer=True,
            is_profile_completed=True
        )
        
        assert user.id is not None
        assert user.email == 'complete@example.com'
        assert user.first_name == 'Complete'
        assert user.last_name == 'User'
        assert user.contact == '1234567890'
        assert user.birthday == date(1990, 1, 1)
        assert user.identification == 'ID12345'
        assert user.document_type == 'CC'
        assert user.role == 'lawyer'
        assert 'profile' in user.photo_profile.name
        assert user.is_gym_lawyer is True
        assert user.is_profile_completed is True
    
    def test_user_document_type_choices(self):
        """Test document type choices validation"""
        # Valid document types
        valid_types = ['NIT', 'CC', 'NUIP', 'EIN']
        for doc_type in valid_types:
            user = User(
                email=f'{doc_type.lower()}@example.com',
                password='testpassword',
                document_type=doc_type
            )
            user.full_clean(exclude=['password'])
        
        # Invalid document type
        user = User(
            email='invalid@example.com',
            password='testpassword',
            document_type='INVALID'
        )
        with pytest.raises(ValidationError):
            user.full_clean(exclude=['password'])
    
    def test_user_role_choices(self):
        """Test role choices validation"""
        # Valid roles
        valid_roles = ['client', 'lawyer']
        for role in valid_roles:
            user = User(
                email=f'{role}@example.com',
                password='testpassword',
                role=role
            )
            user.full_clean(exclude=['password'])
        
        # Invalid role
        user = User(
            email='invalid@example.com',
            password='testpassword',
            role='INVALID'
        )
        with pytest.raises(ValidationError):
            user.full_clean(exclude=['password'])
    
    def test_unique_email_constraint(self):
        """Test unique email constraint"""
        # Create first user
        User.objects.create(
            email='duplicate@example.com',
            password='password1'
        )
        
        # Try to create another user with the same email
        with pytest.raises(Exception):
            User.objects.create(
                email='duplicate@example.com',
                password='password2'
            )
    
    def test_str_representation(self):
        """Test string representation of user"""
        user = User.objects.create(
            email='test@example.com',
            first_name='John',
            last_name='Doe'
        )
        
        expected = f"test@example.com (Doe John)"
        assert str(user) == expected
    
    def test_update_user(self):
        """Test updating a user"""
        user = User.objects.create(
            email='update@example.com',
            first_name='Before',
            last_name='Update'
        )
        
        # Update user fields
        user.first_name = 'After'
        user.last_name = 'Updated'
        user.contact = '9876543210'
        user.is_profile_completed = True
        user.save()
        
        # Refresh from database
        user.refresh_from_db()
        
        # Verify fields were updated
        assert user.first_name == 'After'
        assert user.last_name == 'Updated'
        assert user.contact == '9876543210'
        assert user.is_profile_completed is True
    
    def test_profile_photo_upload(self):
        """Test uploading a profile photo"""
        user = User.objects.create(
            email='photo@example.com'
        )
        
        # Create a test photo
        test_photo = SimpleUploadedFile(
            "profile.jpg",
            b"file_content",
            content_type="image/jpeg"
        )
        
        # Update user with photo
        user.photo_profile = test_photo
        user.save()
        
        # Refresh from database
        user.refresh_from_db()
        
        # Verify photo was saved
        assert user.photo_profile is not None
        assert 'profile' in user.photo_profile.name
        assert user.photo_profile.name.endswith('.jpg')
