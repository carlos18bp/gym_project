"""
Reports package — Excel report generators split by domain.

Re-exports all public symbols so existing imports continue to work:
    from gym_app.views.reports import generate_excel_report
    from gym_app.views.reports import generate_active_processes_report
"""
# Shared variable used by sub-modules for optional user filtering in tests.
# Tests patch 'gym_app.views.reports.user_id'; sub-modules read it at call
# time via _get_user_id() to honour the patch.
user_id = None


def _get_user_id():
    """Return the current user_id value (supports test patching)."""
    return user_id

from .main import generate_excel_report  # noqa: F401

from .process_reports import (  # noqa: F401
    generate_active_processes_report,
    generate_processes_by_lawyer_report,
    generate_processes_by_client_report,
    generate_process_stages_report,
)

from .user_reports import (  # noqa: F401
    ROLE_DISPLAY_MAP,
    generate_registered_users_report,
    generate_user_activity_report,
    generate_lawyers_workload_report,
)

from .document_reports import generate_documents_by_state_report  # noqa: F401

from .legal_request_reports import (  # noqa: F401
    generate_received_legal_requests_report,
    generate_requests_by_type_discipline_report,
)
