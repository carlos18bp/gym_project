"""Tests for uncovered branches in signature_views.py (62%→higher)."""
import pytest
import datetime
from unittest import mock
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from gym_app.models.dynamic_document import DynamicDocument, DocumentSignature
from gym_app.models import User
from gym_app.views.dynamic_documents.signature_views import (
    get_client_ip,
    format_datetime_spanish,
    get_letterhead_for_document,
    generate_encrypted_document_id,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def lawyer():
    return User.objects.create_user(
        email='law_svc@e.com', password='p', role='lawyer',
        first_name='L', last_name='S')


@pytest.fixture
def signer():
    return User.objects.create_user(
        email='sig_svc@e.com', password='p', role='client',
        first_name='S', last_name='V')


@pytest.fixture
def signed_doc(lawyer, signer):
    """Fully signed document with signature record."""
    doc = DynamicDocument.objects.create(
        title='SignedDoc', content='<p>Test content</p>',
        state='FullySigned', requires_signature=True,
        fully_signed=True, created_by=lawyer,
        created_at=timezone.now(), updated_at=timezone.now())
    DocumentSignature.objects.create(
        document=doc, signer=signer, signed=True,
        signed_at=timezone.now(), ip_address='127.0.0.1')
    return doc


@pytest.fixture
def pending_doc(lawyer, signer):
    """Document pending signatures."""
    doc = DynamicDocument.objects.create(
        title='PendDoc', content='<p>Pending</p>',
        state='PendingSignatures', requires_signature=True,
        created_by=lawyer,
        created_at=timezone.now(), updated_at=timezone.now())
    DocumentSignature.objects.create(
        document=doc, signer=signer, signed=False)
    return doc


@pytest.mark.django_db
class TestSignatureViewsCoverage:

    # --- Helper: get_client_ip with X-Forwarded-For ---
    def test_get_client_ip_forwarded_for(self):
        """Lines 58-60: X-Forwarded-For header returns first IP."""
        req = mock.MagicMock()
        req.META = {'HTTP_X_FORWARDED_FOR': '1.2.3.4, 5.6.7.8'}
        assert get_client_ip(req) == '1.2.3.4'

    # --- Helper: get_client_ip with X-Real-IP ---
    def test_get_client_ip_real_ip(self):
        """Line 64: X-Real-IP header."""
        req = mock.MagicMock()
        req.META = {'HTTP_X_REAL_IP': '10.0.0.1'}
        assert get_client_ip(req) == '10.0.0.1'

    # --- Helper: format_datetime_spanish ---
    def test_format_datetime_spanish(self):
        """Lines 121-122: Spanish date formatting."""
        dt = datetime.datetime(2025, 12, 25, 14, 30, 15)
        result = format_datetime_spanish(dt)
        assert 'diciembre' in result
        assert '25' in result
        assert '14:30:15' in result

    # --- Helper: generate_encrypted_document_id normal path ---
    def test_encrypted_id_normal(self):
        """Lines 81-94: normal encrypted ID generation."""
        dt = datetime.datetime(2025, 6, 15, 10, 30, 0)
        result = generate_encrypted_document_id(1, dt)
        assert '-' in result
        assert len(result) == 19  # XXXX-XXXX-XXXX-XXXX

    # --- Helper: get_letterhead_for_document ---
    def test_letterhead_no_letterhead(self, lawyer):
        """Line 779: no letterhead returns None."""
        doc = mock.MagicMock()
        doc.letterhead_image = None
        lawyer.letterhead_image = None
        assert get_letterhead_for_document(doc, lawyer) is None

    def test_letterhead_user_global(self, lawyer):
        """Line 777: user global letterhead used when doc has none."""
        doc = mock.MagicMock()
        doc.letterhead_image = None
        lawyer.letterhead_image = mock.MagicMock()
        result = get_letterhead_for_document(doc, lawyer)
        assert result == lawyer.letterhead_image

    # --- generate_signatures_pdf: not fully signed ---
    def test_gen_sig_pdf_not_fully_signed(
        self, api_client, lawyer, pending_doc
    ):
        """Line 1230: document not FullySigned returns 400."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'generate-signatures-pdf', kwargs={'pk': pending_doc.pk}))
        assert r.status_code == 400
        assert 'completamente firmado' in r.data['detail']

    # --- generate_signatures_pdf: fully signed ---
    def test_gen_sig_pdf_success(self, api_client, lawyer, signed_doc):
        """Lines 793-1277: full PDF generation for signed document."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'generate-signatures-pdf', kwargs={'pk': signed_doc.pk}))
        assert r.status_code == 200
        assert r['Content-Type'] == 'application/pdf'

    # --- get_user_archived_documents ---
    def test_get_archived_docs(self, api_client, lawyer, signer):
        """Lines 644-673: archived documents for user."""
        doc = DynamicDocument.objects.create(
            title='Rejected', content='', state='Rejected',
            requires_signature=True, created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer, rejected=True)
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'get-user-archived-documents',
            kwargs={'user_id': signer.pk}))
        assert r.status_code == 200

    # --- get_user_signed_documents ---
    def test_get_signed_docs(self, api_client, lawyer, signer, signed_doc):
        """Lines 678-699: signed documents for user."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'get-user-signed-documents',
            kwargs={'user_id': signer.pk}))
        assert r.status_code == 200

    # --- expire_overdue_documents (triggered via get_pending) ---
    def test_expire_overdue(self, api_client, lawyer, signer):
        """Lines 125-164: overdue document gets expired."""
        doc = DynamicDocument.objects.create(
            title='Overdue', content='', state='PendingSignatures',
            requires_signature=True, created_by=lawyer,
            signature_due_date=timezone.now().date() - datetime.timedelta(days=1),
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer, signed=False)
        api_client.force_authenticate(user=signer)
        r = api_client.get(reverse('get-pending-signatures'))
        assert r.status_code == 200
        doc.refresh_from_db()
        assert doc.state == 'Expired'

    # --- get_document_signatures: non-existent doc (lines 186-187) ---
    def test_get_signatures_nonexistent_doc(self, api_client, lawyer):
        """Lines 186-187: DoesNotExist returns 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'get-document-signatures', kwargs={'document_id': 99999}))
        assert r.status_code == 404

    # --- get_document_signatures: no permission (line 179) ---
    def test_get_signatures_no_permission(self, api_client, signer, lawyer):
        """Line 179: user without visibility gets 403."""
        doc = DynamicDocument.objects.create(
            title='Private', content='', state='Draft',
            is_public=False, created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        other = User.objects.create_user(
            email='other_sig@e.com', password='p', role='basic',
            first_name='O', last_name='T')
        api_client.force_authenticate(user=other)
        r = api_client.get(reverse(
            'get-document-signatures', kwargs={'document_id': doc.pk}))
        assert r.status_code == 403

    # --- remove_signature_request: not creator (line 567) ---
    def test_remove_sig_not_creator(self, api_client, lawyer, signer, pending_doc):
        """Line 567: non-creator gets 403."""
        api_client.force_authenticate(user=signer)
        r = api_client.delete(reverse(
            'remove-signature-request',
            kwargs={'document_id': pending_doc.pk, 'user_id': signer.pk}))
        # The decorator or view should block non-creator
        assert r.status_code in (403, 404)

    # --- get_user_pending_documents_full: non-existent user ---
    def test_pending_docs_full_nonexistent_user(self, api_client, lawyer):
        """Lines 638-639: non-existent user_id returns 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'get-user-pending-documents-full',
            kwargs={'user_id': 99999}))
        assert r.status_code == 404

    # --- get_user_archived_documents: non-existent user ---
    def test_archived_docs_nonexistent_user(self, api_client, lawyer):
        """Lines 672-673: non-existent user_id returns 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'get-user-archived-documents',
            kwargs={'user_id': 99999}))
        assert r.status_code == 404

    # --- get_user_signed_documents: non-existent user ---
    def test_signed_docs_nonexistent_user(self, api_client, lawyer):
        """Lines 698-699: non-existent user_id returns 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'get-user-signed-documents',
            kwargs={'user_id': 99999}))
        assert r.status_code == 404

    # --- generate_signatures_pdf: signer with doc_type & identification ---
    def test_gen_sig_pdf_with_identification(self, api_client, lawyer):
        """Lines 1081, 1083, 1085: signer with document_type/identification."""
        signer2 = User.objects.create_user(
            email='sig2_svc@e.com', password='p', role='client',
            first_name='S2', last_name='V2',
            document_type='CC', identification='12345678')
        doc = DynamicDocument.objects.create(
            title='IdentDoc', content='<p>ID</p>',
            state='FullySigned', requires_signature=True,
            fully_signed=True, created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer2, signed=True,
            signed_at=timezone.now(), ip_address='10.0.0.1')
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'generate-signatures-pdf', kwargs={'pk': doc.pk}))
        assert r.status_code == 200
        assert r['Content-Type'] == 'application/pdf'

    # --- generate_signatures_pdf: signer with UserSignature image ---
    def test_gen_sig_pdf_with_user_signature_image(self, api_client, lawyer):
        """Lines 1096-1109: signer has a UserSignature with image."""
        from gym_app.models.user import UserSignature
        from django.core.files.uploadedfile import SimpleUploadedFile
        from io import BytesIO
        from PIL import Image as PILImage

        signer3 = User.objects.create_user(
            email='sig3_svc@e.com', password='p', role='client',
            first_name='S3', last_name='V3')
        # Create a valid signature image
        buf = BytesIO()
        PILImage.new('RGB', (180, 50), color='black').save(buf, format='PNG')
        buf.seek(0)
        sig_img = SimpleUploadedFile(
            "sig.png", buf.read(), content_type="image/png")
        UserSignature.objects.create(
            user=signer3, signature_image=sig_img, method='draw')
        doc = DynamicDocument.objects.create(
            title='SigImgDoc', content='<p>SigImg</p>',
            state='FullySigned', requires_signature=True,
            fully_signed=True, created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer3, signed=True,
            signed_at=timezone.now(), ip_address='10.0.0.2')
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'generate-signatures-pdf', kwargs={'pk': doc.pk}))
        assert r.status_code == 200
        assert r['Content-Type'] == 'application/pdf'

    # --- sign_document: complete flow with email (lines 317, 349-350) ---
    def test_sign_document_success(self, api_client, lawyer, signer, pending_doc):
        """Lines 317-350: successful signing with email notification."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        from io import BytesIO
        from PIL import Image as PILImage
        from gym_app.models.user import UserSignature

        # Create user signature first
        buf = BytesIO()
        PILImage.new('RGB', (180, 50), color='black').save(buf, format='PNG')
        buf.seek(0)
        sig_img = SimpleUploadedFile(
            "sig.png", buf.read(), content_type="image/png")
        UserSignature.objects.create(
            user=signer, signature_image=sig_img, method='draw')

        api_client.force_authenticate(user=signer)
        with mock.patch('gym_app.views.dynamic_documents.signature_views.EmailMessage') as mock_email:
            mock_email.return_value.send.return_value = None
            r = api_client.post(reverse(
                'sign-document',
                kwargs={'document_id': pending_doc.pk, 'user_id': signer.pk}))
        assert r.status_code == 200
        pending_doc.refresh_from_db()
        assert pending_doc.state == 'FullySigned'

    # --- reject_document: with comment (lines 471-473) ---
    def test_reject_document_with_comment(self, api_client, lawyer, signer):
        """Lines 434-473: rejection with comment and email notification."""
        doc = DynamicDocument.objects.create(
            title='RejectMe', content='<p>R</p>',
            state='PendingSignatures', requires_signature=True,
            created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer, signed=False)
        api_client.force_authenticate(user=signer)
        with mock.patch('gym_app.views.dynamic_documents.signature_views.EmailMessage') as mock_email:
            mock_email.return_value.send.return_value = None
            r = api_client.post(
                reverse('reject-document',
                        kwargs={'document_id': doc.pk, 'user_id': signer.pk}),
                {'comment': 'Not acceptable'}, format='json')
        assert r.status_code == 200
        doc.refresh_from_db()
        assert doc.state == 'Rejected'

    # ========== Email exception tests (system boundary) ==========

    def test_sign_document_email_exception(self, api_client, lawyer, signer):
        """Lines 347-348: email send failure during sign is caught silently."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        from io import BytesIO
        from PIL import Image as PILImage
        from gym_app.models.user import UserSignature
        doc = DynamicDocument.objects.create(
            title='SignEmailFail', content='<p>E</p>',
            state='PendingSignatures', requires_signature=True,
            created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer, signed=False)
        buf = BytesIO()
        PILImage.new('RGB', (180, 50), color='black').save(buf, format='PNG')
        buf.seek(0)
        sig_img = SimpleUploadedFile(
            "sig.png", buf.read(), content_type="image/png")
        UserSignature.objects.filter(user=signer).delete()
        UserSignature.objects.create(
            user=signer, signature_image=sig_img, method='draw')
        api_client.force_authenticate(user=signer)
        with mock.patch(
            'gym_app.views.dynamic_documents.signature_views.EmailMessage'
        ) as mock_email:
            mock_email.return_value.send.side_effect = Exception("SMTP fail")
            r = api_client.post(reverse(
                'sign-document',
                kwargs={'document_id': doc.pk, 'user_id': signer.pk}))
        assert r.status_code == 200
        doc.refresh_from_db()
        assert doc.state == 'FullySigned'

    def test_reject_document_email_exception(self, api_client, lawyer, signer):
        """Lines 469-471: email send failure during reject is caught silently."""
        doc = DynamicDocument.objects.create(
            title='RejectEmailFail', content='<p>R</p>',
            state='PendingSignatures', requires_signature=True,
            created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer, signed=False)
        api_client.force_authenticate(user=signer)
        with mock.patch(
            'gym_app.views.dynamic_documents.signature_views.EmailMessage'
        ) as mock_email:
            mock_email.return_value.send.side_effect = Exception("SMTP fail")
            r = api_client.post(
                reverse('reject-document',
                        kwargs={'document_id': doc.pk, 'user_id': signer.pk}),
                {'comment': 'Bad'}, format='json')
        assert r.status_code == 200
        doc.refresh_from_db()
        assert doc.state == 'Rejected'

    # ========== sign_document generic exception (lines 377-378) ==========

    def test_sign_document_generic_exception(self, api_client, lawyer, signer):
        """Lines 377-378: generic exception in sign_document → 500."""
        from django.core.files.uploadedfile import SimpleUploadedFile
        from io import BytesIO
        from PIL import Image as PILImage
        from gym_app.models.user import UserSignature
        doc = DynamicDocument.objects.create(
            title='SignFail', content='<p>F</p>',
            state='PendingSignatures', requires_signature=True,
            created_by=lawyer,
            created_at=timezone.now(), updated_at=timezone.now())
        DocumentSignature.objects.create(
            document=doc, signer=signer, signed=False)
        buf = BytesIO()
        PILImage.new('RGB', (180, 50), color='black').save(buf, format='PNG')
        buf.seek(0)
        sig_img = SimpleUploadedFile(
            "sig.png", buf.read(), content_type="image/png")
        UserSignature.objects.filter(user=signer).delete()
        UserSignature.objects.create(
            user=signer, signature_image=sig_img, method='draw')
        api_client.force_authenticate(user=signer)
        with mock.patch(
            'gym_app.views.dynamic_documents.signature_views.'
            'DocumentSignatureSerializer',
            side_effect=Exception("serializer error")
        ):
            r = api_client.post(reverse(
                'sign-document',
                kwargs={'document_id': doc.pk, 'user_id': signer.pk}))
        assert r.status_code == 500
        assert 'unexpected' in r.data['detail'].lower()

    # ========== reopen_document: nonexistent doc (lines 539-545) ==========

    def test_reopen_signatures_nonexistent_doc(self, api_client, lawyer):
        """Lines 539-545: nonexistent document → 404 (via decorator)."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.post(reverse(
            'reopen-document-signatures',
            kwargs={'document_id': 99999}))
        assert r.status_code == 404

    # ========== remove_signature: nonexistent doc (lines 598-599) ==========

    def test_remove_signature_nonexistent_doc(self, api_client, lawyer):
        """Lines 598-599: nonexistent document → 404 (via decorator)."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.delete(reverse(
            'remove-signature-request',
            kwargs={'document_id': 99999, 'user_id': 1}))
        assert r.status_code == 404

    # ========== Generic exception for user document list endpoints ==========

    def test_pending_docs_full_generic_exception(self, api_client, lawyer, signer):
        """Lines 636-637: generic exception in get_user_pending_documents_full → 500."""
        api_client.force_authenticate(user=lawyer)
        with mock.patch(
            'gym_app.views.dynamic_documents.signature_views.expire_overdue_documents',
            side_effect=Exception("unexpected")
        ):
            r = api_client.get(reverse(
                'get-user-pending-documents-full',
                kwargs={'user_id': signer.pk}))
        assert r.status_code == 500

    def test_archived_docs_generic_exception(self, api_client, lawyer, signer):
        """Lines 670-671: generic exception in get_user_archived_documents → 500."""
        api_client.force_authenticate(user=lawyer)
        with mock.patch(
            'gym_app.views.dynamic_documents.signature_views.DocumentSignature.objects',
        ) as mock_qs:
            mock_qs.filter.side_effect = Exception("unexpected")
            r = api_client.get(reverse(
                'get-user-archived-documents',
                kwargs={'user_id': signer.pk}))
        assert r.status_code == 500

    def test_signed_docs_generic_exception(self, api_client, lawyer, signer):
        """Lines 696-697: generic exception in get_user_signed_documents → 500."""
        api_client.force_authenticate(user=lawyer)
        with mock.patch(
            'gym_app.views.dynamic_documents.signature_views.DocumentSignature.objects',
        ) as mock_qs:
            mock_qs.filter.side_effect = Exception("unexpected")
            r = api_client.get(reverse(
                'get-user-signed-documents',
                kwargs={'user_id': signer.pk}))
        assert r.status_code == 500

    # ========== generate_signatures_pdf: nonexistent doc (line 1267) ==========

    def test_gen_sig_pdf_nonexistent_doc(self, api_client, lawyer):
        """Line 1267: nonexistent document → 404."""
        api_client.force_authenticate(user=lawyer)
        r = api_client.get(reverse(
            'generate-signatures-pdf', kwargs={'pk': 99999}))
        assert r.status_code == 404
