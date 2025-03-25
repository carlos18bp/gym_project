from .views import intranet_gym, userAuth, user, case_type, process, legal_request, dynamic_document
from .views.layouts import sendEmail
from django.urls import path

sign_in_sign_on_urls = [
    path('sign_on/', userAuth.sign_on, name='sign_on'),
    path('sign_on/send_verification_code/', userAuth.send_verification_code, name='send_verification_code'),
    path('sign_in/', userAuth.sign_in, name='sign_in'),
    path('send_passcode/', userAuth.send_passcode, name='send_passcode'),
    path('google_login/', userAuth.google_login, name='google_login'),
    path('update_password/', userAuth.update_password, name='update_password'),    
    path('verify_passcode_and_reset_password/', userAuth.verify_passcode_and_reset_password, name='verify_passcode_and_reset_password'),
    path('validate_token/', userAuth.validate_token, name='validate_token'),
]

user_urls = [
    path('users/', user.user_list, name='user-list'),
    path('update_profile/<int:pk>/', user.update_profile, name='update_profile'),
]

process_urls = [
    path('case_types/', case_type.case_list, name='case-list'),
    path('processes/', process.process_list, name='process-list'),
    path('create_process/', process.create_process, name='create-process'),
    path('update_process/<int:pk>/', process.update_process, name='update-process'),
    path('update_case_file/', process.update_case_file, name="update-file"),
]

legal_request_urls = [
    path('create_legal_request/', legal_request.create_legal_request, name='create-legal-request'),
    path('upload_legal_request_file/', legal_request.upload_legal_request_file, name='upload-legal-request-file'),
    path('dropdown_options_legal_request/', legal_request.get_dropdown_options, name='get-dropdown-options'),
]

intranet_gym_urls = [
    path('list_legal_intranet_documents/', intranet_gym.list_legal_intranet_documents, name='list-legal-intranet-documents'),
    path('create_report_request/', intranet_gym.create_report, name='create-report-request'),
]

dynamic_document_urls = [
    path('dynamic-documents/', dynamic_document.list_dynamic_documents, name='list_dynamic_documents'),
    path('dynamic-documents/create/', dynamic_document.create_dynamic_document, name='create_dynamic_document'),
    path('dynamic-documents/<int:pk>/update/', dynamic_document.update_dynamic_document, name='update_dynamic_document'),
    path('dynamic-documents/<int:pk>/delete/', dynamic_document.delete_dynamic_document, name='delete_dynamic_document'),
    path('dynamic-documents/send_email_with_attachments/', sendEmail.send_email_with_attachments, name='send_email_with_attachments'),
    path('dynamic-documents/<int:pk>/download-pdf/', dynamic_document.download_dynamic_document_pdf, name='download_dynamic_document_pdf'),
    path('dynamic-documents/<int:pk>/download-word/', dynamic_document.download_dynamic_document_word, name='download_dynamic_document_word'),
]

urlpatterns = (
    sign_in_sign_on_urls +
    user_urls +
    process_urls +
    legal_request_urls +
    intranet_gym_urls +
    dynamic_document_urls
)