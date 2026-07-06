from django.core.management.base import BaseCommand
from gym_app.models import (
    Process, Stage, Case, CaseFile, User, LegalRequest, LegalRequestType,
    LegalDiscipline, LegalRequestFiles, DynamicDocument,
    DocumentVariable, ActivityFeed, LegalDocument, LegalUpdate, RecentProcess,
    RecentDocument, Organization, OrganizationMembership, OrganizationInvitation, OrganizationPost,
    SECOPProcess, ProcessClassification, SECOPAlert, AlertNotification, SyncLog, SavedView,
    Notification, TourProgress, Tag, UserSignature, IntranetProfile,
    Service, ServiceStage, ServiceField, ServiceRequest, ServiceRequestSequence,
    ServiceRequestAnswer, ServiceRequestFieldFile, ServiceRequestLawyerResponse,
    ServiceRequestLawyerResponseFile,
    CorporateRequest, CorporateRequestType, CorporateRequestFiles, CorporateRequestResponse,
    Subscription, PaymentHistory,
)
from ._seeder_constants import PROTECTED_EMAILS

class Command(BaseCommand):
    help = 'Delete all fake data for clients, lawyers, processes, stages, and case files'

    """
    To delete fake data via console, run:
    python3 manage.py delete_fake_data --confirm
    """

    def add_arguments(self, parser):
        parser.add_argument(
            '--confirm',
            action='store_true',
            default=False,
            help='Required flag to confirm deletion of all fake data',
        )

    def handle(self, *args, **options):
        if not options.get('confirm'):
            self.stdout.write(self.style.ERROR(
                'This command deletes ALL fake data. Pass --confirm to proceed.\n'
                'Usage: python3 manage.py delete_fake_data --confirm'
            ))
            return
        # Delete all processes
        for process in Process.objects.all():
            process.delete()
            self.stdout.write(self.style.SUCCESS(f'Process "{process}" deleted'))

        # Delete all stages
        for stage in Stage.objects.all():
            stage.delete()
            self.stdout.write(self.style.SUCCESS(f'Stage "{stage}" deleted'))

        # Delete all cases
        for case in Case.objects.all():
            case.delete()
            self.stdout.write(self.style.SUCCESS(f'Case "{case}" deleted'))

        # Delete all case files
        for case_file in CaseFile.objects.all():
            case_file.delete()
            self.stdout.write(self.style.SUCCESS(f'CaseFile "{case_file}" deleted'))

        # Delete recent processes
        for recent in RecentProcess.objects.all():
            recent.delete()
            self.stdout.write(self.style.SUCCESS(f'RecentProcess "{recent}" deleted'))

        # Delete all dynamic documents and associated variables
        for document in DynamicDocument.objects.all():
            document.delete()
            self.stdout.write(self.style.SUCCESS(f'DynamicDocument "{document}" deleted'))

        for variable in DocumentVariable.objects.all():
            variable.delete()
            self.stdout.write(self.style.SUCCESS(f'DocumentVariable "{variable}" deleted'))

        # Delete recent document references
        for recent in RecentDocument.objects.all():
            recent.delete()
            self.stdout.write(self.style.SUCCESS(f'RecentDocument "{recent}" deleted'))

        # Delete all activity logs
        for activity in ActivityFeed.objects.all():
            activity.delete()
            self.stdout.write(self.style.SUCCESS(f'ActivityFeed "{activity}" deleted'))

        # Delete legal documents
        for doc in LegalDocument.objects.all():
            doc.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalDocument "{doc}" deleted'))

        # Delete legal updates
        for update in LegalUpdate.objects.all():
            update.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalUpdate "{update}" deleted'))

        # Delete organization posts
        for post in OrganizationPost.objects.all():
            post.delete()
            self.stdout.write(self.style.SUCCESS(f'OrganizationPost "{post}" deleted'))

        # Delete organization memberships
        for membership in OrganizationMembership.objects.all():
            membership.delete()
            self.stdout.write(self.style.SUCCESS(f'OrganizationMembership "{membership}" deleted'))

        # Delete organization invitations
        for invitation in OrganizationInvitation.objects.all():
            invitation.delete()
            self.stdout.write(self.style.SUCCESS(f'OrganizationInvitation "{invitation}" deleted'))

        # Delete organizations
        for organization in Organization.objects.all():
            organization.delete()
            self.stdout.write(self.style.SUCCESS(f'Organization "{organization}" deleted'))

        # Delete clients and lawyers, but keep fixed test users and admin.superuser
        all_protected = PROTECTED_EMAILS | {'admin@gmail.com'}

        for user in User.objects.filter(
            role__in=['client', 'lawyer', 'basic', 'corporate_client']
        ).exclude(email__in=all_protected):
            user.delete()
            self.stdout.write(self.style.SUCCESS(f'User "{user}" deleted'))

        # Delete all LegalRequests
        for legal_request in LegalRequest.objects.all():
            legal_request.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalRequest "{legal_request}" deleted'))

        for legal_request_type in LegalRequestType.objects.all():
            legal_request_type.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalRequestType "{legal_request_type}" deleted'))

        for legal_discipline in LegalDiscipline.objects.all():
            legal_discipline.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalDiscipline "{legal_discipline}" deleted'))

        for legal_request_files in LegalRequestFiles.objects.all():
            legal_request_files.delete()
            self.stdout.write(self.style.SUCCESS(f'LegalRequestFiles "{legal_request_files}" deleted'))

        # Delete SECOP data (order matters: notifications → classifications → alerts → saved views → sync logs → processes)
        deleted = AlertNotification.objects.all().delete()[0]
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} AlertNotification(s)'))

        deleted = ProcessClassification.objects.all().delete()[0]
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} ProcessClassification(s)'))

        deleted = SECOPAlert.objects.all().delete()[0]
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} SECOPAlert(s)'))

        deleted = SavedView.objects.all().delete()[0]
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} SavedView(s)'))

        deleted = SyncLog.objects.all().delete()[0]
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} SyncLog(s)'))

        deleted = SECOPProcess.objects.all().delete()[0]
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} SECOPProcess(es)'))

        deleted = Notification.objects.all().delete()[0]
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} Notification(s)'))

        # Guided-tour progress: wiping it restores the first-run tour
        # experience after demos mark tours as completed.
        deleted = TourProgress.objects.all().delete()[0]
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} TourProgress record(s)'))

        # Services / trámites (requests first: ServiceRequest.service is PROTECT).
        for model in (
            ServiceRequestLawyerResponseFile, ServiceRequestLawyerResponse,
            ServiceRequestFieldFile, ServiceRequestAnswer, ServiceRequest,
            ServiceRequestSequence, ServiceField, ServiceStage, Service,
        ):
            deleted = model.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} {model.__name__}(s)'))

        # Corporate requests.
        for model in (
            CorporateRequestResponse, CorporateRequest, CorporateRequestFiles, CorporateRequestType,
        ):
            deleted = model.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} {model.__name__}(s)'))

        # Subscriptions and payments.
        for model in (PaymentHistory, Subscription):
            deleted = model.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} {model.__name__}(s)'))

        # User signatures and intranet profile.
        for model in (UserSignature, IntranetProfile):
            deleted = model.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} {model.__name__}(s)'))

        # Tags: created_by is SET_NULL, so tags survive document deletion and
        # accumulate across delete→create cycles. Delete them explicitly.
        deleted = Tag.objects.all().delete()[0]
        self.stdout.write(self.style.SUCCESS(f'Deleted {deleted} Tag(s)'))

        self.stdout.write(self.style.SUCCESS('All fake data deleted successfully'))
