"""
Main dispatcher for Excel report generation.
"""
import datetime
from django.http import HttpResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone

from .process_reports import (
    generate_active_processes_report,
    generate_processes_by_lawyer_report,
    generate_processes_by_client_report,
    generate_process_stages_report,
)
from .user_reports import (
    generate_registered_users_report,
    generate_user_activity_report,
    generate_lawyers_workload_report,
)
from .document_reports import generate_documents_by_state_report
from .legal_request_reports import (
    generate_received_legal_requests_report,
    generate_requests_by_type_discipline_report,
)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_excel_report(request):
    """
    Generate an Excel report based on the provided parameters.
    If dates are not provided, all data will be included without date filtering.
    """
    report_type = request.data.get('reportType')
    start_date = request.data.get('startDate')
    end_date = request.data.get('endDate')
    filter_role = request.data.get('filterRole') or None
    filter_profile_status = request.data.get('filterProfileStatus') or None
    filter_document_type = request.data.get('filterDocumentType') or None

    if not report_type:
        return Response(
            {'error': 'reportType is required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Initialize dates to None for no filtering if not provided
    start_datetime = None
    end_datetime = None

    # Process dates if provided
    if start_date and end_date:
        try:
            # Convert string dates to datetime objects
            start_datetime = datetime.datetime.strptime(start_date, '%Y-%m-%d').date()
            end_datetime = datetime.datetime.strptime(end_date, '%Y-%m-%d').date()

            # Set end_date to end of day for inclusive filtering
            end_datetime = datetime.datetime.combine(end_datetime, datetime.time.max)
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )
    # If only one date is provided, require both
    elif start_date or end_date:
        return Response(
            {'error': 'Both startDate and endDate must be provided if using date filtering'},
            status=status.HTTP_400_BAD_REQUEST
        )
    # If no dates, use earliest possible date and today's end date
    else:
        start_datetime = datetime.datetime(1900, 1, 1)
        end_datetime = datetime.datetime.combine(timezone.now().date(), datetime.time.max)

    # Initialize response
    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{report_type}_{datetime.date.today()}.xlsx"'

    # Generate appropriate report based on type
    if report_type == 'active_processes':
        return generate_active_processes_report(response, start_datetime, end_datetime)
    elif report_type == 'processes_by_lawyer':
        return generate_processes_by_lawyer_report(response, start_datetime, end_datetime)
    elif report_type == 'processes_by_client':
        return generate_processes_by_client_report(response, start_datetime, end_datetime)
    elif report_type == 'process_stages':
        return generate_process_stages_report(response, start_datetime, end_datetime)
    elif report_type == 'registered_users':
        return generate_registered_users_report(
            response, start_datetime, end_datetime,
            filter_role=filter_role,
            filter_profile_status=filter_profile_status,
            filter_document_type=filter_document_type,
        )
    elif report_type == 'user_activity':
        return generate_user_activity_report(response, start_datetime, end_datetime)
    elif report_type == 'lawyers_workload':
        return generate_lawyers_workload_report(response, start_datetime, end_datetime)
    elif report_type == 'documents_by_state':
        return generate_documents_by_state_report(response, start_datetime, end_datetime)
    elif report_type == 'received_legal_requests':
        return generate_received_legal_requests_report(response, start_datetime, end_datetime)
    elif report_type == 'requests_by_type_discipline':
        return generate_requests_by_type_discipline_report(response, start_datetime, end_datetime)
    else:
        return Response(
            {'error': f'Report type {report_type} not supported'},
            status=status.HTTP_400_BAD_REQUEST
        )
