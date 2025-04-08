from .user import User
from .process import Case, Stage, CaseFile, Process, RecentProcess
from .password_code import PasswordCode
from .legal_request import LegalRequest, LegalRequestFiles, LegalRequestType, LegalDiscipline
from .intranet_gym import LegalDocument
from .dynamic_document import DynamicDocument, DocumentVariable
from .legal_update import LegalUpdate

__all__ = [
    'User', 'Process', 'Stage', 'CaseFile', 'Case',
    'LegalRequest', 'LegalRequestType', 'LegalDiscipline', 'LegalRequestFiles',
    'LegalDocument', 'DynamicDocument', 'DocumentVariable', 'LegalUpdate'
]