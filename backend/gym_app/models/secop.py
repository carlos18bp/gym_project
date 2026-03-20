from django.db import models
from django.conf import settings
from django.utils import timezone


class SECOPProcess(models.Model):
    """
    Stores procurement process data synchronized from SECOP II API.

    This model represents a single procurement opportunity from the Colombian
    public procurement system (SECOP II). Data is synchronized daily from
    datos.gov.co via the Socrata API.
    """

    class APIStatus:
        OPEN = 'Abierto'
        AWARDED = 'Adjudicado'
        CLOSED = 'Cerrado'

    class Meta:
        db_table = 'secop_process'
        verbose_name = 'SECOP Process'
        verbose_name_plural = 'SECOP Processes'
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['closing_date']),
            models.Index(fields=['department']),
            models.Index(fields=['procurement_method']),
            models.Index(fields=['base_price']),
            models.Index(fields=['publication_date']),
            models.Index(fields=['entity_name']),
        ]

    # SECOP identifiers
    process_id = models.CharField(
        max_length=100,
        unique=True,
        db_index=True,
        help_text="Unique process ID from SECOP (e.g., CO1.REQ.3908932)"
    )
    reference = models.CharField(
        max_length=200,
        blank=True,
        help_text="Process reference number"
    )

    # Entity information
    entity_name = models.CharField(
        max_length=500,
        help_text="Contracting entity name"
    )
    entity_nit = models.CharField(max_length=50, blank=True)
    department = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    entity_level = models.CharField(
        max_length=50,
        blank=True,
        help_text="Entity level: Nacional, Territorial"
    )

    # Process details
    procedure_name = models.CharField(max_length=500, blank=True)
    description = models.TextField(
        blank=True,
        help_text="Full process description/object"
    )
    phase = models.CharField(
        max_length=100,
        blank=True,
        help_text="Current phase"
    )
    status = models.CharField(max_length=50, blank=True, db_index=True)
    procurement_method = models.CharField(max_length=200, blank=True)
    procurement_justification = models.CharField(max_length=500, blank=True)
    contract_type = models.CharField(max_length=200, blank=True)

    # Financial
    base_price = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Base price in COP"
    )

    # Duration
    duration_value = models.IntegerField(null=True, blank=True)
    duration_unit = models.CharField(max_length=50, blank=True)

    # Dates
    publication_date = models.DateField(null=True, blank=True)
    last_update_date = models.DateField(null=True, blank=True)
    closing_date = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Deadline for proposal submission"
    )

    # URLs and codes
    process_url = models.URLField(max_length=500, blank=True)
    unspsc_code = models.CharField(max_length=100, blank=True)

    # Sync metadata
    synced_at = models.DateTimeField(auto_now=True)
    raw_data = models.JSONField(
        null=True,
        blank=True,
        help_text="Raw JSON from API for fields not explicitly mapped"
    )

    def __str__(self):
        return f"{self.reference} - {self.entity_name[:50]}"

    @property
    def is_open(self):
        """Check if the process is still open for proposals."""
        if self.status and self.status != self.APIStatus.OPEN:
            return False
        if self.closing_date and self.closing_date < timezone.now():
            return False
        return True

    @property
    def days_remaining(self):
        """Calculate remaining days until deadline."""
        if not self.closing_date:
            return None
        delta = self.closing_date - timezone.now()
        return max(0, delta.days)


class ProcessClassification(models.Model):
    """
    User classification and tracking of SECOP processes.

    Allows users to mark processes with different statuses and add internal
    notes for team collaboration. Each user can have their own classification
    for each process.
    """

    class Meta:
        db_table = 'secop_classification'
        verbose_name = 'Classification'
        verbose_name_plural = 'Classifications'
        unique_together = ['process', 'user']

    class Status(models.TextChoices):
        INTERESTING = 'INTERESTING', 'Interesting'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        DISCARDED = 'DISCARDED', 'Discarded'
        APPLIED = 'APPLIED', 'Applied'

    process = models.ForeignKey(
        'gym_app.SECOPProcess',
        on_delete=models.CASCADE,
        related_name='classifications'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='secop_classifications'
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.INTERESTING
    )
    notes = models.TextField(
        blank=True,
        help_text="Internal notes for the team"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.process.reference} - {self.status} ({self.user})"


class SECOPAlert(models.Model):
    """
    User-configured alerts for new SECOP processes matching specific criteria.

    When new processes are synchronized, the system evaluates them against
    active alerts and generates notifications for matches.
    """

    class Meta:
        db_table = 'secop_alert'
        verbose_name = 'SECOP Alert'
        verbose_name_plural = 'SECOP Alerts'

    class Frequency(models.TextChoices):
        IMMEDIATE = 'IMMEDIATE', 'Immediate'
        DAILY = 'DAILY', 'Daily Summary'
        WEEKLY = 'WEEKLY', 'Weekly Summary'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='secop_alerts'
    )
    name = models.CharField(
        max_length=200,
        help_text="Alert name for reference"
    )

    # Filter criteria
    keywords = models.TextField(
        blank=True,
        help_text="Comma-separated keywords to search in description"
    )
    entities = models.TextField(
        blank=True,
        help_text="Comma-separated entity names"
    )
    departments = models.TextField(
        blank=True,
        help_text="Comma-separated department names"
    )
    min_budget = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        null=True,
        blank=True
    )
    max_budget = models.DecimalField(
        max_digits=20,
        decimal_places=2,
        null=True,
        blank=True
    )
    procurement_methods = models.TextField(
        blank=True,
        help_text="Comma-separated procurement modalities"
    )

    # Configuration
    frequency = models.CharField(
        max_length=20,
        choices=Frequency.choices,
        default=Frequency.DAILY
    )
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.user})"

    def evaluate_process(self, process):
        """
        Evaluate if a process matches this alert's criteria.

        Args:
            process: SECOPProcess instance to evaluate

        Returns:
            bool: True if process matches all specified criteria
        """
        # Keywords check (OR logic - any keyword matches)
        if self.keywords:
            keyword_list = [k.strip().lower() for k in self.keywords.split(',') if k.strip()]
            text = f"{process.description} {process.procedure_name}".lower()
            if not any(kw in text for kw in keyword_list):
                return False

        # Entity check
        if self.entities:
            entity_list = [e.strip().lower() for e in self.entities.split(',') if e.strip()]
            if not any(e in process.entity_name.lower() for e in entity_list):
                return False

        # Department check
        if self.departments:
            dept_list = [d.strip().lower() for d in self.departments.split(',') if d.strip()]
            if process.department.lower() not in dept_list:
                return False

        # Budget range check
        if self.min_budget or self.max_budget:
            if process.base_price is None:
                return False
            if self.min_budget and process.base_price < self.min_budget:
                return False
            if self.max_budget and process.base_price > self.max_budget:
                return False

        # Procurement method check
        if self.procurement_methods:
            method_list = [m.strip().lower() for m in self.procurement_methods.split(',') if m.strip()]
            if process.procurement_method.lower() not in method_list:
                return False

        return True


class AlertNotification(models.Model):
    """
    Records of alert notifications sent to users.

    Tracks which processes triggered which alerts to avoid duplicate
    notifications and provide history.
    """

    class Meta:
        db_table = 'secop_alert_notification'
        unique_together = ['alert', 'process']

    alert = models.ForeignKey(
        SECOPAlert,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    process = models.ForeignKey(
        'gym_app.SECOPProcess',
        on_delete=models.CASCADE,
        related_name='alert_notifications'
    )
    is_sent = models.BooleanField(default=False)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class SyncLog(models.Model):
    """
    Log of synchronization executions with SECOP API.

    Tracks each sync run for monitoring, debugging, and displaying
    last sync time in the UI.
    """

    class Meta:
        db_table = 'secop_sync_log'
        verbose_name = 'Sync Log'
        verbose_name_plural = 'Sync Logs'
        ordering = ['-started_at']

    class Status(models.TextChoices):
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        SUCCESS = 'SUCCESS', 'Success'
        FAILED = 'FAILED', 'Failed'

    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.IN_PROGRESS
    )
    records_processed = models.IntegerField(default=0)
    records_created = models.IntegerField(default=0)
    records_updated = models.IntegerField(default=0)
    error_message = models.TextField(blank=True)

    def __str__(self):
        return f"Sync {self.started_at.strftime('%Y-%m-%d %H:%M')} - {self.status}"


class SavedView(models.Model):
    """
    Saved filter combinations for quick access.

    Users can save their frequently used filter combinations
    as named views for one-click access.
    """

    class Meta:
        db_table = 'secop_saved_view'
        unique_together = ['user', 'name']

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='secop_saved_views'
    )
    name = models.CharField(max_length=200)
    filters = models.JSONField(
        help_text="Stored filter parameters as JSON"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.user})"
