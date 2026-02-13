import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from gym_app.models.intranet_gym import LegalDocument, IntranetProfile
from gym_app.serializers.intranet_gym import LegalDocumentSerializer, IntranetProfileSerializer

@pytest.fixture
def legal_document():
    """Crear un documento legal de prueba con un archivo"""
    test_file = SimpleUploadedFile(
        "test_document.pdf", 
        b"file_content", 
        content_type="application/pdf"
    )
    return LegalDocument.objects.create(
        name="Test Legal Document",
        file=test_file
    )


@pytest.fixture
def intranet_profile():
    cover = SimpleUploadedFile(
        "cover.jpg",
        b"cover-content",
        content_type="image/jpeg",
    )
    profile = SimpleUploadedFile(
        "profile.jpg",
        b"profile-content",
        content_type="image/jpeg",
    )
    return IntranetProfile.objects.create(
        cover_image=cover,
        profile_image=profile,
    )

@pytest.mark.django_db
class TestLegalDocumentSerializer:
    
    def test_serialize_legal_document(self, legal_document):
        """Test la serialización de un documento legal"""
        # Crear un contexto de request simulado
        class MockRequest:
            def __init__(self):
                self.scheme = 'http'
                self.host = 'testserver'
            
            def build_absolute_uri(self, url):
                return f"{self.scheme}://{self.host}{url}"
        
        # Crear el serializador con el contexto
        context = {'request': MockRequest()}
        serializer = LegalDocumentSerializer(legal_document, context=context)
        
        # Verificar que los campos se serialicen correctamente
        assert serializer.data['id'] == legal_document.id
        assert serializer.data['name'] == legal_document.name
        assert 'file' in serializer.data
        
        # Verificar que file_url sea una URL absoluta
        assert serializer.data['file_url'].startswith('http://testserver')
        assert legal_document.file.name in serializer.data['file_url']
    
    def test_serialize_legal_document_without_request(self, legal_document):
        """Test la serialización sin un objeto request en el contexto"""
        # Crear el serializador sin contexto de request
        serializer = LegalDocumentSerializer(legal_document)
        
        # Verificar que los campos se serialicen correctamente
        assert serializer.data['id'] == legal_document.id
        assert serializer.data['name'] == legal_document.name
        assert 'file' in serializer.data
        
        # Verificar que file_url sea una URL relativa
        assert not serializer.data['file_url'].startswith('http://')
        assert legal_document.file.name in serializer.data['file_url']
    
    def test_deserialize_legal_document(self):
        """Test la deserialización para crear un nuevo documento legal"""
        # Crear un archivo de prueba
        test_file = SimpleUploadedFile(
            "new_document.pdf", 
            b"new_file_content", 
            content_type="application/pdf"
        )
        
        # Datos para la deserialización
        data = {
            'name': 'New Legal Document',
            'file': test_file
        }
        
        # Crear y validar el serializador
        serializer = LegalDocumentSerializer(data=data)
        assert serializer.is_valid()
        
        # Verificar los datos validados
        assert serializer.validated_data['name'] == 'New Legal Document'
        assert serializer.validated_data['file'] == test_file
        
        # Guardar y verificar el nuevo documento
        legal_document = serializer.save()
        assert legal_document.name == 'New Legal Document'
        assert 'new_document' in legal_document.file.name
    
    def test_update_legal_document(self, legal_document):
        """Test la actualización de un documento legal existente"""
        # Archivo original
        original_file_name = legal_document.file.name
        
        # Crear un nuevo archivo para la actualización
        update_file = SimpleUploadedFile(
            "updated_document.pdf", 
            b"updated_content", 
            content_type="application/pdf"
        )
        
        # Datos para la actualización
        data = {
            'name': 'Updated Legal Document',
            'file': update_file
        }
        
        # Crear y validar el serializador para actualización
        serializer = LegalDocumentSerializer(legal_document, data=data)
        assert serializer.is_valid()
        
        # Guardar y verificar la actualización
        updated_document = serializer.save()
        assert updated_document.id == legal_document.id  # Mismo documento
        assert updated_document.name == 'Updated Legal Document'
        assert 'updated_document' in updated_document.file.name
        assert updated_document.file.name != original_file_name
    
    def test_partial_update_legal_document(self, legal_document):
        """Test la actualización parcial de un documento legal"""
        # Archivo original
        original_file_name = legal_document.file.name
        
        # Datos para la actualización parcial (solo nombre)
        data = {
            'name': 'Partially Updated Document'
        }
        
        # Crear y validar el serializador para actualización parcial
        serializer = LegalDocumentSerializer(legal_document, data=data, partial=True)
        assert serializer.is_valid()
        
        # Guardar y verificar la actualización parcial
        updated_document = serializer.save()
        assert updated_document.id == legal_document.id  # Mismo documento
        assert updated_document.name == 'Partially Updated Document'
        assert updated_document.file.name == original_file_name  # Archivo sin cambios
    
    def test_invalid_document_data(self):
        """Test la validación de datos inválidos"""
        # Datos sin archivo (campo requerido)
        invalid_data = {
            'name': 'Document Without File'
        }
        
        # Verificar que la validación falle
        serializer = LegalDocumentSerializer(data=invalid_data)
        assert not serializer.is_valid()
        assert 'file' in serializer.errors


@pytest.mark.django_db
class TestIntranetProfileSerializer:
    def test_profile_serializer_with_request(self, intranet_profile):
        class MockRequest:
            def build_absolute_uri(self, url):
                return f"http://testserver{url}"

        serializer = IntranetProfileSerializer(
            intranet_profile,
            context={"request": MockRequest()},
        )
        data = serializer.data

        assert data["cover_image_url"].startswith("http://testserver")
        assert intranet_profile.cover_image.name in data["cover_image_url"]
        assert data["profile_image_url"].startswith("http://testserver")
        assert intranet_profile.profile_image.name in data["profile_image_url"]

    def test_profile_serializer_without_request(self, intranet_profile):
        serializer = IntranetProfileSerializer(intranet_profile)
        data = serializer.data

        assert data["cover_image_url"] == intranet_profile.cover_image.url
        assert data["profile_image_url"] == intranet_profile.profile_image.url
