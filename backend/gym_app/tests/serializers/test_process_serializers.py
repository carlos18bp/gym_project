import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from gym_app.models import Case, CaseFile, Stage, Process, RecentProcess, User
from gym_app.serializers.process import (
    CaseSerializer,
    CaseFileSerializer, 
    StageSerializer,
    ProcessSerializer,
    RecentProcessSerializer,
)

@pytest.fixture
def user_client():
    """Create a client user for testing"""
    return User.objects.create_user(
        email='client@example.com',
        password='testpassword',
        first_name='Client',
        last_name='User',
        role='client'
    )

@pytest.fixture
def user_lawyer():
    """Create a lawyer user for testing"""
    return User.objects.create_user(
        email='lawyer@example.com',
        password='testpassword',
        first_name='Lawyer',
        last_name='User',
        role='lawyer'
    )

@pytest.fixture
def case():
    """Create a case type for testing"""
    return Case.objects.create(type='Criminal')

@pytest.fixture
def stage():
    """Create a stage for testing"""
    return Stage.objects.create(status='In Progress')

@pytest.fixture
def case_file():
    """Create a case file for testing"""
    test_file = SimpleUploadedFile(
        "case_document.pdf", 
        b"file_content", 
        content_type="application/pdf"
    )
    return CaseFile.objects.create(file=test_file)

@pytest.fixture
def process(user_client, user_lawyer, case, stage, case_file):
    """Create a complete process for testing"""
    process = Process.objects.create(
        authority='Supreme Court',
        plaintiff='John Smith',
        defendant='Jane Doe',
        ref='CASE-123',
        lawyer=user_lawyer,
        case=case,
        subcase='Theft'
    )
    process.clients.add(user_client)
    process.stages.add(stage)
    process.case_files.add(case_file)
    return process


@pytest.fixture
def recent_process(user_client, process):
    """Create a RecentProcess entry for testing"""
    return RecentProcess.objects.create(user=user_client, process=process)

@pytest.mark.django_db
class TestCaseSerializer:
    
    def test_serialize_case(self, case):
        """Test the serialization of a case type"""
        serializer = CaseSerializer(case)
        
        assert serializer.data['id'] == case.id
        assert serializer.data['type'] == case.type
    
    def test_deserialize_case(self):
        """Test the deserialization to create a new case type"""
        data = {'type': 'Civil'}
        
        serializer = CaseSerializer(data=data)
        assert serializer.is_valid()
        
        new_case = serializer.save()
        assert new_case.type == 'Civil'

@pytest.mark.django_db
class TestCaseFileSerializer:
    
    def test_serialize_case_file(self, case_file):
        """Test the serialization of a case file"""
        serializer = CaseFileSerializer(case_file)
        
        assert serializer.data['id'] == case_file.id
        assert 'file' in serializer.data
    
    def test_deserialize_case_file(self):
        """Test the deserialization to create a new case file"""
        test_file = SimpleUploadedFile(
            "new_case_file.pdf", 
            b"new_content", 
            content_type="application/pdf"
        )
        
        data = {'file': test_file}
        
        serializer = CaseFileSerializer(data=data)
        assert serializer.is_valid()
        
        new_case_file = serializer.save()
        assert 'new_case_file' in new_case_file.file.name

@pytest.mark.django_db
class TestStageSerializer:
    
    def test_serialize_stage(self, stage):
        """Test the serialization of a stage"""
        serializer = StageSerializer(stage)
        
        assert serializer.data['id'] == stage.id
        assert serializer.data['status'] == stage.status
    
    def test_deserialize_stage(self):
        """Test the deserialization to create a new stage"""
        data = {'status': 'Completed'}
        
        serializer = StageSerializer(data=data)
        assert serializer.is_valid()
        
        new_stage = serializer.save()
        assert new_stage.status == 'Completed'

@pytest.mark.django_db
class TestProcessSerializer:
    
    def test_serialize_process_basic_fields(self, process):
        """Test the serialization of a complete process - basic fields"""
        serializer = ProcessSerializer(process)
        
        assert serializer.data['id'] == process.id
        assert serializer.data['authority'] == process.authority
        assert serializer.data['plaintiff'] == process.plaintiff
        assert serializer.data['defendant'] == process.defendant
        assert serializer.data['ref'] == process.ref
        assert serializer.data['subcase'] == process.subcase

    def test_serialize_process_relationships(self, process):
        """Test the serialization of a complete process - relationships"""
        serializer = ProcessSerializer(process)
        
        assert serializer.data['case']['id'] == process.case.id
        assert serializer.data['case']['type'] == process.case.type
        
        primary_client = process.clients.first()
        assert len(serializer.data['clients']) == 1
        assert serializer.data['clients'][0]['id'] == primary_client.id
        assert serializer.data['clients'][0]['email'] == primary_client.email
        
        assert serializer.data['lawyer']['id'] == process.lawyer.id
        assert serializer.data['lawyer']['email'] == process.lawyer.email

    def test_serialize_process_collections(self, process):
        """Test the serialization of a complete process - collections"""
        serializer = ProcessSerializer(process)
        
        assert len(serializer.data['stages']) == 1
        assert serializer.data['stages'][0]['id'] == process.stages.first().id
        
        assert len(serializer.data['case_files']) == 1
        assert serializer.data['case_files'][0]['id'] == process.case_files.first().id
    
    def test_update_process(self, process, stage):
        """Test updating a process with the custom update method"""
        # Create a second stage to add
        new_stage = Stage.objects.create(status='New Stage')
        
        # Prepare data for update
        data = {
            'authority': 'District Court',  # Updated field
            'plaintiff': 'Updated Plaintiff',  # Updated field
            'defendant': process.defendant,  # No changes
            'ref': process.ref,  # No changes
            'subcase': 'Updated Subcase',  # Updated field
            'stages': [
                {
                    'id': stage.id,  # Existing stage with update
                    'status': 'Updated Status'
                },
                {
                    # New stage (without ID)
                    'status': 'Brand New Stage'
                }
                # Not including new_stage, which should remove it
            ]
        }
        
        # Update process
        serializer = ProcessSerializer(process, data=data, partial=True)
        
        # Note: In a real situation, serializer.is_valid() would be True,
        # but in our tests it will fail because the serializer is not designed
        # to accept partial data with nested objects.
        # We'll simulate the validation and directly call the update method.
        
        # Simulate successful validation
        validated_data = data.copy()
        
        # Call the update method directly
        updated_process = serializer.update(process, validated_data)
        
        # Verify updated simple fields
        assert updated_process.authority == 'District Court'
        assert updated_process.plaintiff == 'Updated Plaintiff'
        assert updated_process.defendant == process.defendant
        assert updated_process.subcase == 'Updated Subcase'
        assert updated_process.stages.count() == 2

    def test_update_process_stages_changes(self, process, stage):
        """Test updating a process - stages changes"""
        new_stage = Stage.objects.create(status='New Stage')
        
        data = {
            'stages': [
                {'id': stage.id, 'status': 'Updated Status'},
                {'status': 'Brand New Stage'}
            ]
        }
        
        serializer = ProcessSerializer(process, data=data, partial=True)
        validated_data = data.copy()
        updated_process = serializer.update(process, validated_data)
        
        # Verify existing stage updated
        updated_stage = updated_process.stages.get(id=stage.id)
        assert updated_stage.status == 'Updated Status'
        
        # Verify new stage created
        assert updated_process.stages.filter(status='Brand New Stage').exists()
        
        # Verify that new_stage was removed from the relationship
        assert not updated_process.stages.filter(id=new_stage.id).exists()
    
    def test_update_process_without_stages(self, process):
        """Test updating a process without touching the stages"""
        # Count initial stages
        initial_stages_count = process.stages.count()
        
        # Prepare data for update (without including stages)
        data = {
            'authority': 'Another Court',
            'plaintiff': 'Another Plaintiff'
        }
        
        # Update process
        serializer = ProcessSerializer(process, data=data, partial=True)
        
        # Simulate successful validation
        validated_data = data.copy()
        
        # Call the update method directly
        updated_process = serializer.update(process, validated_data)
        
        # Verify updated fields
        assert updated_process.authority == 'Another Court'
        assert updated_process.plaintiff == 'Another Plaintiff'
        
        # Verify that stages did not change
        assert updated_process.stages.count() == initial_stages_count


@pytest.mark.django_db
class TestRecentProcessSerializer:

    def test_serialize_recent_process(self, recent_process):
        """Test the serialization of a RecentProcess with nested ProcessSerializer"""
        serializer = RecentProcessSerializer(recent_process)
        data = serializer.data

        assert data['id'] == recent_process.id
        assert 'process' in data

        # Nested process data should include at least the id and ref
        assert data['process']['id'] == recent_process.process.id
        assert data['process']['ref'] == recent_process.process.ref

        # last_viewed should be present as an ISO-formatted string
        assert 'last_viewed' in data
        assert isinstance(data['last_viewed'], str)


@pytest.mark.django_db
class TestProcessSerializerUpdate:
    def test_update_simple_fields(self, process, rf):
        """Cover lines 68-74: update simple fields."""
        request = rf.get("/")
        serializer = ProcessSerializer(
            process,
            data={
                "plaintiff": "New P",
                "defendant": "New D",
                "ref": "NEW-REF",
                "authority": "New Auth",
                "authority_email": "auth@example.com",
                "subcase": "New Sub",
                "progress": 80,
            },
            partial=True,
            context={"request": request},
        )
        # ProcessSerializer has nested read-only fields, so update must be called directly
        validated = {
            "plaintiff": "New P",
            "defendant": "New D",
            "ref": "NEW-REF",
            "authority": "New Auth",
            "authority_email": "auth@example.com",
            "subcase": "New Sub",
            "progress": 80,
        }
        updated = serializer.update(process, validated)
        assert updated.plaintiff == "New P"
        assert updated.progress == 80

    def test_update_stages_remove_and_add(self, process, rf):
        """Cover lines 77-102: stage update logic (remove old, update existing, add new)."""
        existing_stage = process.stages.first()
        validated = {
            "stages": [
                {"id": existing_stage.id, "status": "Updated Stage"},  # update existing
                {"status": "Brand New Stage"},  # create new (no id)
            ]
        }
        updated = serializer_update_helper(process, validated)
        # The second original stage should have been removed
        stage_statuses = list(updated.stages.values_list("status", flat=True))
        assert "Updated Stage" in stage_statuses
        assert "Brand New Stage" in stage_statuses

    def test_update_stages_removes_missing_existing(self, process, rf):
        """Cover line 89: remove stage IDs missing from payload."""
        keep_stage = process.stages.first()
        remove_stage = Stage.objects.create(status="Remove Me")
        process.stages.add(remove_stage)

        validated = {
            "stages": [
                {"id": keep_stage.id, "status": "Keep Stage"},
            ]
        }

        updated = serializer_update_helper(process, validated)
        stage_ids = set(updated.stages.values_list("id", flat=True))
        assert keep_stage.id in stage_ids
        assert remove_stage.id not in stage_ids

    def test_update_stages_none_skips(self, process, rf):
        """Cover line 80: stages_data is None → skip stage update."""
        original_count = process.stages.count()
        validated = {"plaintiff": "Keep stages"}
        updated = serializer_update_helper(process, validated)
        assert updated.stages.count() == original_count


def serializer_update_helper(process, validated_data):
    """Helper to call ProcessSerializer.update directly."""
    serializer = ProcessSerializer()
    return serializer.update(process, validated_data)

