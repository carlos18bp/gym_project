"""
URL configuration for the gym app.

This module defines all the URL patterns for the gym application, organized into functional groups:
- Authentication (sign in, sign on, password management)
- User management (profiles, activities, signatures)
- Process and case management (cases, processes, files)
- Legal requests and documents (requests, files, options)
- Intranet documents (legal documents, reports)
- Dynamic documents (documents, signatures, downloads)
- Legal updates (notifications and updates)
- Recent processes (tracking and updates)
- Reports (Excel report generation)
"""
from .views import intranet_gym, userAuth, user, case_type, process, legal_request, legal_update, reports, captcha
from .views.layouts import sendEmail
from .views.dynamic_documents import document_views, signature_views, tag_folder_views, permission_views
from django.urls import path

# Authentication URLs
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

# User management URLs
user_urls = [
    path('users/', user.user_list, name='user-list'),
    path('update_profile/<int:pk>/', user.update_profile, name='update_profile'),
    path('users/update_signature/<int:user_id>/', user.update_signature, name='update-signature'),
    path('user-activities/', user.get_user_activities, name='user-activities'),
    path('create-activity/', user.create_activity, name='create-activity'),
]

# Process and case management URLs
process_urls = [
    path('case_types/', case_type.case_list, name='case-list'),
    path('processes/', process.process_list, name='process-list'),
    path('create_process/', process.create_process, name='create-process'),
    path('update_process/<int:pk>/', process.update_process, name='update-process'),
    path('update_case_file/', process.update_case_file, name="update-file"),
]

# Legal request management URLs
legal_request_urls = [
    path('create_legal_request/', legal_request.create_legal_request, name='create-legal-request'),
    path('upload_legal_request_file/', legal_request.upload_legal_request_file, name='upload-legal-request-file'),
    path('dropdown_options_legal_request/', legal_request.get_dropdown_options, name='get-dropdown-options'),
]

# Intranet document management URLs
intranet_gym_urls = [
    path('list_legal_intranet_documents/', intranet_gym.list_legal_intranet_documents, name='list-legal-intranet-documents'),
    path('create_report_request/', intranet_gym.create_report, name='create-report-request'),
]

# Dynamic document management URLs
dynamic_document_urls = [
    # Document CRUD operations
    path('dynamic-documents/', document_views.list_dynamic_documents, name='list_dynamic_documents'),
    path('dynamic-documents/<int:pk>/', document_views.get_dynamic_document, name='get_dynamic_document'),
    path('dynamic-documents/create/', document_views.create_dynamic_document, name='create_dynamic_document'),
    path('dynamic-documents/<int:pk>/update/', document_views.update_dynamic_document, name='update_dynamic_document'),
    path('dynamic-documents/<int:pk>/delete/', document_views.delete_dynamic_document, name='delete_dynamic_document'),
    
    # Document operations
    path('dynamic-documents/send_email_with_attachments/', sendEmail.send_email_with_attachments, name='send_email_with_attachments'),
    path('dynamic-documents/<int:pk>/download-pdf/', document_views.download_dynamic_document_pdf, name='download_dynamic_document_pdf'),
    path('dynamic-documents/<int:pk>/download-word/', document_views.download_dynamic_document_word, name='download_dynamic_document_word'),
    
    # Recent documents
    path('dynamic-documents/recent/', document_views.get_recent_documents, name='get-recent-documents'),
    path('dynamic-documents/<int:document_id>/update-recent/', document_views.update_recent_document, name='update-recent-document'),
    
    # Signature management
    path('dynamic-documents/<int:document_id>/signatures/', signature_views.get_document_signatures, name='get-document-signatures'),
    path('dynamic-documents/pending-signatures/', signature_views.get_pending_signatures, name='get-pending-signatures'),
    path('dynamic-documents/<int:document_id>/sign/<int:user_id>/', signature_views.sign_document, name='sign-document'),
    path('dynamic-documents/<int:document_id>/remove-signature/<int:user_id>/', signature_views.remove_signature_request, name='remove-signature-request'),
    
    # User signature management
    path('dynamic-documents/user/<int:user_id>/pending-documents-full/', signature_views.get_user_pending_documents_full, name='get-user-pending-documents-full'),
    path('dynamic-documents/user/<int:user_id>/signed-documents/', signature_views.get_user_signed_documents, name='get-user-signed-documents'),
    path('users/<int:user_id>/signature/', signature_views.get_user_signature, name='get-user-signature'),
    
    # Signature PDF generation
    path('dynamic-documents/<int:pk>/generate-signatures-pdf/', signature_views.generate_signatures_pdf, name='generate-signatures-pdf'),

    # Tag management
    path('dynamic-documents/tags/', tag_folder_views.list_tags, name='list-tags'),
    path('dynamic-documents/tags/create/', tag_folder_views.create_tag, name='create-tag'),
    path('dynamic-documents/tags/<int:pk>/update/', tag_folder_views.update_tag, name='update-tag'),
    path('dynamic-documents/tags/<int:pk>/delete/', tag_folder_views.delete_tag, name='delete-tag'),

    # Folder management
    path('dynamic-documents/folders/', tag_folder_views.list_folders, name='list-folders'),
    path('dynamic-documents/folders/create/', tag_folder_views.create_folder, name='create-folder'),
    path('dynamic-documents/folders/<int:pk>/', tag_folder_views.get_folder, name='get-folder'),
    path('dynamic-documents/folders/<int:pk>/update/', tag_folder_views.update_folder, name='update-folder'),
    path('dynamic-documents/folders/<int:pk>/delete/', tag_folder_views.delete_folder, name='delete-folder'),
    
    # Permission management
    path('dynamic-documents/<int:pk>/permissions/', permission_views.get_document_permissions, name='get-document-permissions'),
    path('dynamic-documents/<int:pk>/permissions/public/toggle/', permission_views.toggle_public_access, name='toggle-public-access'),
    path('dynamic-documents/<int:pk>/permissions/visibility/grant/', permission_views.grant_visibility_permissions, name='grant-visibility-permissions'),
    path('dynamic-documents/<int:pk>/permissions/usability/grant/', permission_views.grant_usability_permissions, name='grant-usability-permissions'),
    path('dynamic-documents/<int:pk>/permissions/visibility/revoke/<int:user_id>/', permission_views.revoke_visibility_permission, name='revoke-visibility-permission'),
    path('dynamic-documents/<int:pk>/permissions/usability/revoke/<int:user_id>/', permission_views.revoke_usability_permission, name='revoke-usability-permission'),
    path('dynamic-documents/permissions/clients/', permission_views.get_available_clients, name='get-available-clients'),
    
    # Letterhead image management
    path('dynamic-documents/<int:pk>/letterhead/upload/', document_views.upload_letterhead_image, name='upload-letterhead-image'),
    path('dynamic-documents/<int:pk>/letterhead/', document_views.get_letterhead_image, name='get-letterhead-image'),
    path('dynamic-documents/<int:pk>/letterhead/delete/', document_views.delete_letterhead_image, name='delete-letterhead-image'),
]

# Legal update management URLs
legal_update_urls = [
    path('legal-updates/', legal_update.legal_update_list, name='legal-updates-list'),
    path('legal-updates/<int:pk>/', legal_update.legal_update_detail, name='legal-updates-detail'),
    path('legal-updates/active/', legal_update.active_legal_updates, name='legal-updates-active'),
]

# Recent process management URLs
recent_process_urls = [
    path('recent-processes/', process.get_recent_processes, name='recent-processes'),
    path('update-recent-process/<int:process_id>/', process.update_recent_process, name='update-recent-process'),
]

# Report generation URLs
reports_urls = [
    path('reports/generate-excel/', reports.generate_excel_report, name='generate-excel-report'),
]

# Google Captcha URLs
google_captcha_urls = [
    path('google-captcha/site-key/', captcha.get_site_key, name='google-captcha-site-key'),
    path('google-captcha/verify/', captcha.verify_recaptcha, name='google-captcha-verify'),
]

# Combine all URL patterns
urlpatterns = (
    sign_in_sign_on_urls +
    user_urls +
    process_urls +
    legal_request_urls +
    intranet_gym_urls +
    dynamic_document_urls +
    google_captcha_urls +
    legal_update_urls +
    recent_process_urls +
    reports_urls
)