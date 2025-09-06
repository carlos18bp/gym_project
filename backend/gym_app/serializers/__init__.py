from .user import UserSerializer, ActivityFeedSerializer
from .process import ProcessSerializer, StageSerializer, CaseFileSerializer, CaseSerializer, RecentProcessSerializer
from .legal_request import (
    LegalRequestSerializer, LegalRequestTypeSerializer, LegalDisciplineSerializer, 
    LegalRequestFilesSerializer, LegalRequestResponseSerializer, LegalRequestListSerializer
)
from .intranet_gym import LegalDocumentSerializer
from .dynamic_document import DynamicDocumentSerializer, DocumentVariableSerializer, RecentDocumentSerializer
from .legal_update import LegalUpdateSerializer

__all__ = [
    'UserSerializer', 'ProcessSerializer', 'StageSerializer', 'CaseFileSerializer', 'CaseSerializer',
    'LegalRequestSerializer', 'LegalRequestTypeSerializer', 'LegalDisciplineSerializer', 'LegalRequestFilesSerializer',
    'LegalRequestResponseSerializer', 'LegalRequestListSerializer',
    'LegalDocumentSerializer', 'DynamicDocumentSerializer', 'DocumentVariableSerializer', 'LegalUpdateSerializer',
    'ActivityFeedSerializer', 'RecentDocumentSerializer', 'RecentProcessSerializer'
]