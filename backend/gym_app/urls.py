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
- SECOP public procurement (processes, classifications, alerts)
"""
from .views import intranet_gym, userAuth, user, case_type, process, legal_request, corporate_request, organization, organization_posts, legal_update, reports, captcha, subscription, secop, service_tramite, notification, tour_progress
from .views.layouts import sendEmail
from .views.dynamic_documents import document_views, signature_views, tag_folder_views, permission_views, relationship_views, payments_views
from django.urls import path

# Authentication URLs
sign_in_sign_on_urls = [
    path('sign_on/', userAuth.sign_on, name='sign_on'),
    path('sign_on/send_verification_code/', userAuth.send_verification_code, name='send_verification_code'),
    path('sign_in/', userAuth.sign_in, name='sign_in'),
    path('send_passcode/', userAuth.send_passcode, name='send_passcode'),
    path('google_login/', userAuth.google_login, name='google_login'),
    path('outlook_login/', userAuth.outlook_login, name='outlook_login'),
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
    
    # User global letterhead management
    path('user/letterhead/upload/', document_views.upload_user_letterhead_image, name='upload-user-letterhead-image'),
    path('user/letterhead/', document_views.get_user_letterhead_image, name='get-user-letterhead-image'),
    path('user/letterhead/delete/', document_views.delete_user_letterhead_image, name='delete-user-letterhead-image'),

    # User global Word letterhead template management
    path('user/letterhead/word-template/upload/', document_views.upload_user_letterhead_word_template, name='upload-user-letterhead-word-template'),
    path('user/letterhead/word-template/', document_views.get_user_letterhead_word_template, name='get-user-letterhead-word-template'),
    path('user/letterhead/word-template/delete/', document_views.delete_user_letterhead_word_template, name='delete-user-letterhead-word-template'),
]

# Process and case management URLs
process_urls = [
    path('case_types/', case_type.case_list, name='case-list'),
    path('processes/', process.process_list, name='process-list'),
    path('processes/pending-alerts-count/', process.process_pending_alerts_count, name='process-pending-alerts-count'),
    path('create_process/', process.create_process, name='create-process'),
    path('update_process/<int:pk>/', process.update_process, name='update-process'),
    path('update_case_file/', process.update_case_file, name="update-file"),
]

# Legal request management URLs
legal_request_urls = [
    # Original endpoints
    path('create_legal_request/', legal_request.create_legal_request, name='create-legal-request'),
    path('upload_legal_request_file/', legal_request.upload_legal_request_file, name='upload-legal-request-file'),
    path('dropdown_options_legal_request/', legal_request.get_dropdown_options, name='get-dropdown-options'),
    path('send_confirmation_email/', legal_request.send_confirmation_email, name='send-confirmation-email'),
    
    # New management endpoints
    path('legal_requests/', legal_request.list_legal_requests, name='list-legal-requests'),
    path('legal_requests/<int:request_id>/', legal_request.get_or_delete_legal_request, name='get-or-delete-legal-request'),
    path('legal_requests/<int:request_id>/status/', legal_request.update_legal_request_status, name='update-legal-request-status'),
    path('legal_requests/<int:request_id>/responses/', legal_request.create_legal_request_response, name='create-legal-request-response'),
    path('legal_requests/<int:request_id>/files/', legal_request.add_files_to_legal_request, name='add-files-to-legal-request'),
    path('legal_requests/<int:request_id>/files/<int:file_id>/download/', legal_request.download_legal_request_file, name='download-legal-request-file'),
    path('legal_requests/<int:request_id>/delete/', legal_request.delete_legal_request, name='delete-legal-request'),
]

# Corporate request management URLs  
corporate_request_urls = [
    # Client endpoints (normal clients)
    path('corporate-requests/clients/my-organizations/', corporate_request.client_get_my_organizations, name='client-get-my-organizations'),
    path('corporate-requests/clients/request-types/', corporate_request.client_get_request_types, name='client-get-request-types'),
    path('corporate-requests/clients/create/', corporate_request.client_create_corporate_request, name='client-create-corporate-request'),
    path('corporate-requests/clients/my-requests/', corporate_request.client_get_my_corporate_requests, name='client-get-my-corporate-requests'),
    path('corporate-requests/clients/<int:request_id>/', corporate_request.client_get_corporate_request_detail, name='client-get-corporate-request-detail'),
    path('corporate-requests/clients/<int:request_id>/responses/', corporate_request.client_add_response_to_request, name='client-add-response-to-request'),
    
    # Corporate client endpoints
    path('corporate-requests/corporate/received/', corporate_request.corporate_get_received_requests, name='corporate-get-received-requests'),
    path('corporate-requests/corporate/<int:request_id>/', corporate_request.corporate_get_request_detail, name='corporate-get-request-detail'),
    path('corporate-requests/corporate/<int:request_id>/update/', corporate_request.corporate_update_request_status, name='corporate-update-request-status'),
    path('corporate-requests/corporate/<int:request_id>/responses/', corporate_request.corporate_add_response_to_request, name='corporate-add-response-to-request'),
    path('corporate-requests/corporate/dashboard-stats/', corporate_request.corporate_get_dashboard_stats, name='corporate-get-dashboard-stats'),
    
    # Shared endpoints
    path('corporate-requests/<int:request_id>/conversation/', corporate_request.get_request_conversation, name='get-request-conversation'),
]

# Organization management URLs
organization_urls = [
    # Corporate client endpoints (organization management)
    path('organizations/create/', organization.create_organization, name='create-organization'),
    path('organizations/my-organizations/', organization.get_my_organizations, name='get-my-organizations'),
    path('organizations/<int:organization_id>/', organization.get_organization_detail, name='get-organization-detail'),
    path('organizations/<int:organization_id>/update/', organization.update_organization, name='update-organization'),
    path('organizations/<int:organization_id>/delete/', organization.delete_organization, name='delete-organization'),
    
    # Invitation management
    path('organizations/<int:organization_id>/invitations/send/', organization.send_organization_invitation, name='send-organization-invitation'),
    path('organizations/<int:organization_id>/invitations/', organization.get_organization_invitations, name='get-organization-invitations'),
    path('organizations/<int:organization_id>/invitations/<int:invitation_id>/cancel/', organization.cancel_organization_invitation, name='cancel-organization-invitation'),
    
    # Member management
    path('organizations/<int:organization_id>/members/', organization.get_organization_members, name='get-organization-members'),
    path('organizations/<int:organization_id>/members/<int:user_id>/remove/', organization.remove_organization_member, name='remove-organization-member'),
    
    # Organization statistics
    path('organizations/stats/', organization.get_organization_stats, name='get-organization-stats'),
    
    # Normal client endpoints (invitation handling)
    path('invitations/my-invitations/', organization.get_my_invitations, name='get-my-invitations'),
    path('invitations/<int:invitation_id>/respond/', organization.respond_to_invitation, name='respond-to-invitation'),
        path('organizations/my-memberships/', organization.get_my_memberships, name='get-my-memberships'),
    path('organizations/<int:organization_id>/leave/', organization.leave_organization, name='leave-organization'),
    
    # Shared endpoints
    path('organizations/<int:organization_id>/public/', organization.get_organization_public_detail, name='get-organization-public-detail'),
]

# Organization posts management URLs
organization_posts_urls = [
    # Corporate client endpoints (post management)
    path('organizations/<int:organization_id>/posts/create/', organization_posts.create_organization_post, name='create-organization-post'),
    path('organizations/<int:organization_id>/posts/', organization_posts.get_organization_posts, name='get-organization-posts'),
    path('organizations/<int:organization_id>/posts/<int:post_id>/', organization_posts.get_organization_post_detail, name='get-organization-post-detail'),
    path('organizations/<int:organization_id>/posts/<int:post_id>/update/', organization_posts.update_organization_post, name='update-organization-post'),
    path('organizations/<int:organization_id>/posts/<int:post_id>/delete/', organization_posts.delete_organization_post, name='delete-organization-post'),
    path('organizations/<int:organization_id>/posts/<int:post_id>/toggle-pin/', organization_posts.toggle_organization_post_pin, name='toggle-organization-post-pin'),
    path('organizations/<int:organization_id>/posts/<int:post_id>/toggle-status/', organization_posts.toggle_organization_post_status, name='toggle-organization-post-status'),
    
    # Public endpoints (for organization members)
    path('organizations/<int:organization_id>/posts/public/', organization_posts.get_organization_posts_public, name='get-organization-posts-public'),
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
    path('dynamic-documents/pending-signatures-count/', signature_views.get_pending_signatures_count, name='get-pending-signatures-count'),
    path('dynamic-documents/document-notification-counts/', signature_views.get_document_notification_counts, name='get-document-notification-counts'),
    path('dynamic-documents/<int:document_id>/sign/<int:user_id>/', signature_views.sign_document, name='sign-document'),
    path('dynamic-documents/<int:document_id>/reject/<int:user_id>/', signature_views.reject_document, name='reject-document'),
    path('dynamic-documents/<int:document_id>/reopen-signatures/', signature_views.reopen_document_signatures, name='reopen-document-signatures'),
    path('dynamic-documents/<int:document_id>/formalize/', signature_views.formalize_document, name='formalize-document'),
    path('dynamic-documents/<int:document_id>/correct/', signature_views.correct_document, name='correct-document'),
    path('dynamic-documents/<int:document_id>/remove-signature/<int:user_id>/', signature_views.remove_signature_request, name='remove-signature-request'),
    
    # User signature management
    path('dynamic-documents/user/<int:user_id>/pending-documents-full/', signature_views.get_user_pending_documents_full, name='get-user-pending-documents-full'),
    path('dynamic-documents/user/<int:user_id>/signed-documents/', signature_views.get_user_signed_documents, name='get-user-signed-documents'),
    path('dynamic-documents/user/<int:user_id>/archived-documents/', signature_views.get_user_archived_documents, name='get-user-archived-documents'),
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
    path('dynamic-documents/<int:pk>/permissions/manage/', permission_views.manage_document_permissions_unified, name='manage-document-permissions-unified'),
    path('dynamic-documents/<int:pk>/permissions/public/toggle/', permission_views.toggle_public_access, name='toggle-public-access'),
    path('dynamic-documents/<int:pk>/permissions/visibility/grant/', permission_views.grant_visibility_permissions, name='grant-visibility-permissions'),
    path('dynamic-documents/<int:pk>/permissions/usability/grant/', permission_views.grant_usability_permissions, name='grant-usability-permissions'),
    path('dynamic-documents/<int:pk>/permissions/visibility/revoke/<int:user_id>/', permission_views.revoke_visibility_permission, name='revoke-visibility-permission'),
    path('dynamic-documents/<int:pk>/permissions/usability/revoke/<int:user_id>/', permission_views.revoke_usability_permission, name='revoke-usability-permission'),
    path('dynamic-documents/permissions/clients/', permission_views.get_available_clients, name='get-available-clients'),
    path('dynamic-documents/permissions/roles/', permission_views.get_available_roles, name='get-available-roles'),
    
    # Role-based permission management
    path('dynamic-documents/<int:pk>/permissions/visibility/grant-by-role/', permission_views.grant_visibility_permissions_by_role, name='grant-visibility-permissions-by-role'),
    path('dynamic-documents/<int:pk>/permissions/usability/grant-by-role/', permission_views.grant_usability_permissions_by_role, name='grant-usability-permissions-by-role'),
    path('dynamic-documents/<int:pk>/permissions/revoke-by-role/', permission_views.revoke_permissions_by_role, name='revoke-permissions-by-role'),
    
    # Combined permission management (users + roles)
    path('dynamic-documents/<int:pk>/permissions/visibility/grant-combined/', permission_views.grant_visibility_permissions_combined, name='grant-visibility-permissions-combined'),
    path('dynamic-documents/<int:pk>/permissions/usability/grant-combined/', permission_views.grant_usability_permissions_combined, name='grant-usability-permissions-combined'),
    path('dynamic-documents/<int:pk>/permissions/revoke-combined/', permission_views.revoke_permissions_combined, name='revoke-permissions-combined'),
    
    # Letterhead image and Word template management per document
    path('dynamic-documents/<int:pk>/letterhead/upload/', document_views.upload_letterhead_image, name='upload-letterhead-image'),
    path('dynamic-documents/<int:pk>/letterhead/', document_views.get_letterhead_image, name='get-letterhead-image'),
    path('dynamic-documents/<int:pk>/letterhead/delete/', document_views.delete_letterhead_image, name='delete-letterhead-image'),
    path('dynamic-documents/<int:pk>/letterhead/word-template/upload/', document_views.upload_document_letterhead_word_template, name='upload-document-letterhead-word-template'),
    path('dynamic-documents/<int:pk>/letterhead/word-template/', document_views.get_document_letterhead_word_template, name='get-document-letterhead-word-template'),
    path('dynamic-documents/<int:pk>/letterhead/word-template/delete/', document_views.delete_document_letterhead_word_template, name='delete-document-letterhead-word-template'),
    
    # Document relationship management
    path('dynamic-documents/<int:document_id>/relationships/', relationship_views.list_document_relationships, name='list-document-relationships'),
    path('dynamic-documents/<int:document_id>/related-documents/', relationship_views.list_related_documents, name='list-related-documents'),
    path('dynamic-documents/<int:document_id>/available-for-relationship/', relationship_views.list_available_documents_for_relationship, name='list-available-documents-for-relationship'),
    path('dynamic-documents/relationships/create/', relationship_views.create_document_relationship, name='create-document-relationship'),
    path('dynamic-documents/relationships/<int:relationship_id>/delete/', relationship_views.delete_document_relationship, name='delete-document-relationship'),

    # Contract execution: cuentas de cobro per installment
    path('dynamic-documents/<int:pk>/payment-records/', payments_views.list_payment_records, name='list-payment-records'),
    path('dynamic-documents/<int:pk>/payment-records/upload/', payments_views.upload_payment_record, name='upload-payment-record'),
    path('dynamic-documents/<int:pk>/payment-records/<int:record_id>/accept/', payments_views.accept_payment_record, name='accept-payment-record'),
    path('dynamic-documents/<int:pk>/payment-records/<int:record_id>/reject/', payments_views.reject_payment_record, name='reject-payment-record'),
    path('dynamic-documents/<int:pk>/payment-records/<int:record_id>/download/', payments_views.download_payment_record_file, name='download-payment-record-file'),
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

# Subscription URLs
subscription_urls = [
    path('subscriptions/wompi-config/', subscription.get_wompi_config, name='subscription-wompi-config'),
    path('subscriptions/generate-signature/', subscription.generate_signature, name='subscription-generate-signature'),
    path('subscriptions/create/', subscription.create_subscription, name='subscription-create'),
    path('subscriptions/current/', subscription.get_current_subscription, name='subscription-current'),
    path('subscriptions/cancel/', subscription.cancel_subscription, name='subscription-cancel'),
    path('subscriptions/update-payment-method/', subscription.update_payment_method, name='subscription-update-payment-method'),
    path('subscriptions/payments/', subscription.get_payment_history, name='subscription-payments'),
    path('subscriptions/webhook/', subscription.wompi_webhook, name='subscription-webhook'),
    path('subscriptions/<int:subscription_id>/cancel/', subscription.cancel_subscription_view, name='subscription-cancel-by-id'),
]

# SECOP public procurement URLs
secop_urls = [
    # Process listing, detail, and classified
    path('secop/processes/', secop.secop_process_list, name='secop-process-list'),
    path('secop/processes/my-classified/', secop.secop_my_classified, name='secop-my-classified'),
    path('secop/processes/<int:pk>/', secop.secop_process_detail, name='secop-process-detail'),

    # Classifications
    path('secop/classifications/', secop.secop_create_classification, name='secop-create-classification'),
    path('secop/classifications/<int:pk>/', secop.secop_delete_classification, name='secop-delete-classification'),

    # Alerts
    path('secop/alerts/', secop.secop_alerts_list_create, name='secop-alerts-list-create'),
    path('secop/alerts/<int:pk>/', secop.secop_alert_update_delete, name='secop-alert-update-delete'),
    path('secop/alerts/<int:pk>/toggle/', secop.secop_alert_toggle, name='secop-alert-toggle'),

    # Saved views
    path('secop/saved-views/', secop.secop_saved_views, name='secop-saved-views'),
    path('secop/saved-views/<int:pk>/', secop.secop_delete_saved_view, name='secop-delete-saved-view'),
    path('secop/saved-views/<int:pk>/set-favorite/', secop.secop_saved_view_set_favorite, name='secop-saved-view-set-favorite'),

    # Filters, sync, and export
    path('secop/filters/', secop.secop_available_filters, name='secop-available-filters'),
    path('secop/sync/', secop.secop_sync_status, name='secop-sync-status'),
    path('secop/sync/trigger/', secop.secop_trigger_sync, name='secop-trigger-sync'),
    path('secop/export/', secop.secop_export_excel, name='secop-export-excel'),
]

# Notification center URLs
notification_urls = [
    path('notifications/', notification.notification_list, name='notification-list'),
    path('notifications/unread-count/', notification.notification_unread_count, name='notification-unread-count'),
    path('notifications/mark-all-read/', notification.notification_mark_all_read, name='notification-mark-all-read'),
    path('notifications/<int:pk>/read/', notification.notification_mark_read, name='notification-mark-read'),
    path('notifications/<int:pk>/unread/', notification.notification_mark_unread, name='notification-mark-unread'),
    path('notifications/<int:pk>/archive/', notification.notification_archive, name='notification-archive'),
    path('notifications/<int:pk>/unarchive/', notification.notification_unarchive, name='notification-unarchive'),
    path('notifications/<int:pk>/snooze/', notification.notification_snooze, name='notification-snooze'),
    path('notifications/<int:pk>/delete/', notification.notification_delete, name='notification-delete'),
]

# Guided tour progress URLs
tour_progress_urls = [
    path('tour-progress/', tour_progress.tour_progress_status, name='tour-progress-status'),
    path('tour-progress/complete/', tour_progress.tour_progress_complete, name='tour-progress-complete'),
]

# Services and procedures module URLs
service_tramite_urls = [
    # Catalog visibility
    path('services/', service_tramite.list_services, name='services-list'),
    path('services/featured/', service_tramite.list_featured_services, name='services-featured'),
    path('services/<int:service_id>/', service_tramite.get_service_detail, name='services-detail'),

    # Admin management
    path('services/admin/list/', service_tramite.admin_list_services, name='services-admin-list'),
    path('services/admin/create/', service_tramite.admin_create_service, name='services-admin-create'),
    path('services/admin/<int:service_id>/update/', service_tramite.admin_update_service, name='services-admin-update'),
    path('services/admin/<int:service_id>/toggle-active/', service_tramite.admin_toggle_service_active, name='services-admin-toggle-active'),
    path('services/admin/<int:service_id>/toggle-featured/', service_tramite.admin_toggle_service_featured, name='services-admin-toggle-featured'),
    path('services/admin/<int:service_id>/delete/', service_tramite.admin_delete_service, name='services-admin-delete'),

    # Request lifecycle
    path('service-requests/save/', service_tramite.save_or_submit_service_request, name='service-request-save'),
    path('service-requests/service/<int:service_id>/draft/', service_tramite.get_latest_service_draft, name='service-request-draft'),
    path('service-requests/my/', service_tramite.list_my_service_requests, name='service-request-my-list'),
    path('service-requests/inbox/', service_tramite.list_service_requests_inbox, name='service-request-inbox-list'),
    path('service-requests/<int:request_id>/', service_tramite.get_service_request_detail, name='service-request-detail'),
    path('service-requests/<int:request_id>/manage/', service_tramite.manage_service_request, name='service-request-manage'),

    # Files and generated document downloads
    path('service-requests/<int:request_id>/document/download/', service_tramite.download_service_request_document, name='service-request-document-download'),
    path('service-requests/<int:request_id>/field-files/<int:file_id>/download/', service_tramite.download_service_request_field_file, name='service-request-field-file-download'),
    path('service-requests/<int:request_id>/responses/<int:response_id>/files/<int:file_id>/download/', service_tramite.download_service_request_response_file, name='service-request-response-file-download'),
]

# Combine all URL patterns
urlpatterns = (
    sign_in_sign_on_urls +
    user_urls +
    process_urls +
    legal_request_urls +
    corporate_request_urls +
    organization_urls +
    organization_posts_urls +
    intranet_gym_urls +
    dynamic_document_urls +
    google_captcha_urls +
    legal_update_urls +
    recent_process_urls +
    reports_urls +
    subscription_urls +
    secop_urls +
    service_tramite_urls +
    notification_urls +
    tour_progress_urls
)
