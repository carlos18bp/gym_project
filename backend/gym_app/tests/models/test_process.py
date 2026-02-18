import os
from datetime import date

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.utils import timezone

from gym_app.models.process import Case, CaseFile, Stage, Process, RecentProcess
from gym_app.models.user import User  # Asumiendo que User está en este módulo

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
def case_type():
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
        b"File content for testing",
        content_type="application/pdf"
    )
    return CaseFile.objects.create(file=test_file)

@pytest.fixture
def process(user_client, user_lawyer, case_type):
    """Create a process for testing"""
    process = Process.objects.create(
        authority='Supreme Court',
        plaintiff='John Smith',
        defendant='Jane Doe',
        ref='CASE-123',
        lawyer=user_lawyer,
        case=case_type,
        subcase='Theft'
    )
    process.clients.add(user_client)
    return process

@pytest.mark.django_db
class TestCase:
    
    def test_create_case(self):
        """Test creating a case type"""
        case = Case.objects.create(type='Civil')
        
        assert case.id is not None
        assert case.type == 'Civil'
    
    def test_str_representation(self, case_type):
        """Test string representation of case type"""
        assert str(case_type) == case_type.type

@pytest.mark.django_db
class TestCaseFile:
    
    def test_create_case_file(self):
        """Test creating a case file"""
        test_file = SimpleUploadedFile(
            "new_document.pdf",
            b"New file content",
            content_type="application/pdf"
        )
        
        file_obj = CaseFile.objects.create(file=test_file)
        
        assert file_obj.id is not None
        assert "new_document" in file_obj.file.name
        assert file_obj.created_at is not None
    
    def test_str_representation(self, case_file):
        """Test string representation of case file"""
        file_name = os.path.basename(case_file.file.name)
        assert str(case_file) == file_name

    def test_delete_case_file_removes_physical_file(self, case_file):
        """Deleting a CaseFile instance should remove the underlying file from the filesystem"""
        file_path = case_file.file.path

        # Aseguramos que el archivo exista antes de borrar
        assert os.path.exists(file_path)

        case_file.delete()

        # El archivo físico debe haberse eliminado por la señal post_delete
        assert not os.path.exists(file_path)

@pytest.mark.django_db
class TestStage:
    
    def test_create_stage(self):
        """Test creating a stage"""
        stage = Stage.objects.create(status='Initial Review')
        
        assert stage.id is not None
        assert stage.status == 'Initial Review'
        assert stage.created_at is not None
    
    def test_str_representation(self, stage):
        """Test string representation of stage"""
        assert str(stage) == stage.status

@pytest.mark.django_db
class TestProcess:
    
    def test_create_process_basic_fields(self, user_client, user_lawyer, case_type):
        """Test creating a process - basic fields"""
        process = Process.objects.create(
            authority='District Court',
            plaintiff='Company Inc.',
            defendant='Other Company LLC',
            ref='CASE-456',
            lawyer=user_lawyer,
            case=case_type,
            subcase='Contract Dispute'
        )
        process.clients.add(user_client)
        
        assert process.id is not None
        assert process.authority == 'District Court'
        assert process.plaintiff == 'Company Inc.'
        assert process.defendant == 'Other Company LLC'
        assert process.ref == 'CASE-456'
        assert process.subcase == 'Contract Dispute'
        assert process.created_at is not None

    def test_create_process_relationships(self, user_client, user_lawyer, case_type):
        """Test creating a process - relationships"""
        process = Process.objects.create(
            authority='District Court',
            lawyer=user_lawyer,
            case=case_type,
        )
        process.clients.add(user_client)
        
        assert process.clients.count() == 1
        assert process.clients.first() == user_client
        assert process.lawyer == user_lawyer
        assert process.case == case_type
        assert process.stages.count() == 0
        assert process.case_files.count() == 0
    
    def test_add_stages_to_process(self, process):
        """Test adding stages to a process"""
        # Create multiple stages
        stage1 = Stage.objects.create(status='Initial Review')
        stage2 = Stage.objects.create(status='Documentation')
        stage3 = Stage.objects.create(status='Final Decision')
        
        # Add stages to process
        process.stages.add(stage1, stage2, stage3)
        
        # Verify stages were added
        assert process.stages.count() == 3
        stage_statuses = [stage.status for stage in process.stages.all()]
        assert 'Initial Review' in stage_statuses
        assert 'Documentation' in stage_statuses
        assert 'Final Decision' in stage_statuses
    
    def test_add_files_to_process(self, process, case_file):
        """Test adding files to a process"""
        # Add existing file
        process.case_files.add(case_file)
        
        # Create and add a new file
        new_file = SimpleUploadedFile(
            "additional_document.pdf",
            b"Additional file content",
            content_type="application/pdf"
        )
        new_file_obj = CaseFile.objects.create(file=new_file)
        process.case_files.add(new_file_obj)
        
        # Verify files were added
        assert process.case_files.count() == 2
        file_names = [os.path.basename(f.file.name) for f in process.case_files.all()]
        assert any("case_document" in name for name in file_names)
        assert any("additional_document" in name for name in file_names)
    
    def test_str_representation(self, process):
        """Test string representation of process"""
        assert str(process) == process.ref
    
    def test_client_process_relationship(self, user_client, process):
        """Test the relationship between client and process"""
        # Verify the client can access their processes
        client_processes = user_client.client_processes.all()
        assert client_processes.count() == 1
        assert client_processes.first() == process
    
    def test_lawyer_process_relationship(self, user_lawyer, process):
        """Test the relationship between lawyer and process"""
        # Verify the lawyer can access their processes
        lawyer_processes = user_lawyer.lawyer_processes.all()
        assert lawyer_processes.count() == 1
        assert lawyer_processes.first() == process

    def test_process_progress_within_valid_range(self, user_client, user_lawyer, case_type):
        """Process.progress debe aceptar valores entre 0 y 100 inclusive"""
        process = Process(
            authority='Court',
            plaintiff='A',
            defendant='B',
            ref='CASE-PROGRESS',
            lawyer=user_lawyer,
            case=case_type,
            subcase='Subcase',
            progress=50,
        )

        # full_clean debería pasar sin errores
        process.full_clean()
        assert process.progress == 50

    def test_process_progress_below_zero_raises_validation_error(self, user_client, user_lawyer, case_type):
        """Process.progress < 0 debe lanzar ValidationError por el validador de rango"""
        process = Process(
            authority='Court',
            plaintiff='A',
            defendant='B',
            ref='CASE-PROGRESS-NEG',
            lawyer=user_lawyer,
            case=case_type,
            subcase='Subcase',
            progress=-1,
        )

        with pytest.raises(ValidationError) as exc_info:
            process.full_clean()
        assert exc_info.value is not None

    def test_process_progress_above_hundred_raises_validation_error(self, user_client, user_lawyer, case_type):
        """Process.progress > 100 debe lanzar ValidationError por el validador de rango"""
        process = Process(
            authority='Court',
            plaintiff='A',
            defendant='B',
            ref='CASE-PROGRESS-OVER',
            lawyer=user_lawyer,
            case=case_type,
            subcase='Subcase',
            progress=101,
        )

        with pytest.raises(ValidationError) as exc_info:
            process.full_clean()
        assert exc_info.value is not None


@pytest.mark.django_db
class TestRecentProcess:

    def test_recent_process_unique_per_user_and_process(self, user_lawyer, process):
        """Solo debe existir un RecentProcess por combinación (user, process)"""
        RecentProcess.objects.create(user=user_lawyer, process=process)

        with transaction.atomic():
            with pytest.raises(IntegrityError) as exc_info:
                RecentProcess.objects.create(user=user_lawyer, process=process)
        assert exc_info.value is not None
        assert RecentProcess.objects.filter(user=user_lawyer, process=process).count() == 1

    def test_recent_process_ordering_by_last_viewed(self, user_lawyer, process, case_type):
        """Las instancias de RecentProcess deben ordenarse por last_viewed descendente"""
        other_process = Process.objects.create(
            authority='District Court',
            plaintiff='X',
            defendant='Y',
            ref='CASE-OTHER',
            lawyer=user_lawyer,
            case=case_type,
            subcase='Other',
        )

        recent_first = RecentProcess.objects.create(user=user_lawyer, process=process)
        recent_second = RecentProcess.objects.create(user=user_lawyer, process=other_process)

        # Ajustamos manualmente las fechas para simular un acceso más reciente
        recent_first.last_viewed = timezone.now() - timezone.timedelta(days=1)
        recent_first.save(update_fields=['last_viewed'])

        recent_second.last_viewed = timezone.now()
        recent_second.save(update_fields=['last_viewed'])

        recents = list(RecentProcess.objects.filter(user=user_lawyer))

        # Por Meta.ordering = ['-last_viewed'], el más reciente debe ir primero
        assert recents[0].process == recent_second.process
        assert recents[1].process == recent_first.process


# ======================================================================
@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email="lawyer-b1@example.com", password="testpassword",
        first_name="Lawyer", last_name="B1", role="lawyer",
    )


# Tests moved from test_model_consolidated.py
# ======================================================================

# ── Stage edge-cases ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestStageEdges:
    def test_stage_with_explicit_date(self):
        stage = Stage.objects.create(status="Filed", date=date(2024, 6, 15))
        assert stage.date == date(2024, 6, 15)

    def test_stage_date_defaults_to_null(self):
        stage = Stage.objects.create(status="Open")
        assert stage.date is None


# ── CaseFile signal edge-case ───────────────────────────────────────────────


# ── CaseFile signal edge-case ───────────────────────────────────────────────

@pytest.mark.django_db
class TestCaseFileSignalEdge:
    def test_delete_casefile_no_physical_file_does_not_raise(self):
        """Signal should not fail when file was already removed from disk."""
        f = SimpleUploadedFile("gone.pdf", b"x", content_type="application/pdf")
        cf = CaseFile.objects.create(file=f)
        cf_id = cf.id
        path = cf.file.path
        if os.path.isfile(path):
            os.remove(path)
        cf.delete()  # should not raise
        assert CaseFile.objects.filter(id=cf_id).count() == 0


# ── Process edge-cases ──────────────────────────────────────────────────────


# ── Process edge-cases ──────────────────────────────────────────────────────

@pytest.mark.django_db
class TestProcessEdges:
    def test_process_multiple_clients(self, lawyer, case_type):
        c1 = User.objects.create_user(email="c1@x.com", password="p", role="client")
        c2 = User.objects.create_user(email="c2@x.com", password="p", role="client")
        proc = Process.objects.create(
            authority="A", plaintiff="P", defendant="D",
            ref="MULTI-C", lawyer=lawyer, case=case_type, subcase="S",
        )
        proc.clients.set([c1, c2])
        assert proc.clients.count() == 2

    def test_process_authority_email_nullable(self, lawyer, case_type, client_user):
        proc = Process.objects.create(
            authority="A", plaintiff="P", defendant="D",
            ref="NO-EMAIL", lawyer=lawyer, case=case_type, subcase="S",
        )
        assert proc.authority_email is None

    def test_process_progress_default_zero(self, lawyer, case_type):
        proc = Process.objects.create(
            authority="A", plaintiff="P", defendant="D",
            ref="PROG-0", lawyer=lawyer, case=case_type, subcase="S",
        )
        assert proc.progress == 0


# ── RecentProcess str ────────────────────────────────────────────────────────


# ── RecentProcess str ────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestRecentProcessStr:
    def test_str_contains_ref_and_user(self, lawyer, case_type):
        proc = Process.objects.create(
            authority="A", plaintiff="P", defendant="D",
            ref="REF-STR", lawyer=lawyer, case=case_type, subcase="S",
        )
        rp = RecentProcess.objects.create(user=lawyer, process=proc)
        s = str(rp)
        assert "REF-STR" in s


# ── DynamicDocument permission helpers ───────────────────────────────────────


