#!/usr/bin/env node
/**
 * Automated tagger for E2E spec files.
 * Adds Playwright { tag: [...] } to test() and test.describe() calls
 * based on file path → flow mapping.
 *
 * Usage: node scripts/tag-e2e-specs.cjs [--dry-run]
 */

const fs = require('node:fs');
const path = require('node:path');

const DRY_RUN = process.argv.includes('--dry-run');
const e2eDir = path.join(__dirname, '..', 'e2e');

// ── File → Flow Tag Mapping ─────────────────────────────────────────────────
// Each entry: glob-like path pattern → { flow, role (optional) }
// Multiple patterns can map to the same flow.

const FILE_FLOW_MAP = [
  // ── Auth ──
  { pattern: 'auth/auth-sign-in.spec.js', flow: 'auth-login-email', role: 'shared' },
  { pattern: 'auth/auth-signin-page.spec.js', flow: 'auth-login-email', role: 'shared' },
  { pattern: 'auth/auth-google-login.spec.js', flow: 'auth-login-google', role: 'shared' },
  { pattern: 'auth/auth-google-login-flow.spec.js', flow: 'auth-login-google', role: 'shared' },
  { pattern: 'auth/auth-google-login-extended.spec.js', flow: 'auth-login-google', role: 'shared' },
  { pattern: 'auth/google-login-flow.spec.js', flow: 'auth-login-google', role: 'shared' },
  { pattern: 'auth/auth-sign-on.spec.js', flow: 'auth-register', role: 'shared' },
  { pattern: 'auth/auth-sign-on-flow.spec.js', flow: 'auth-register', role: 'shared' },
  { pattern: 'auth/auth-forget-password.spec.js', flow: 'auth-forgot-password', role: 'shared' },
  { pattern: 'auth/auth-subscription-sign-in.spec.js', flow: 'auth-subscription-signin', role: 'shared' },
  { pattern: 'auth/auth-sign-out.spec.js', flow: 'auth-logout', role: 'shared' },
  { pattern: 'auth/auth-edge-cases.spec.js', flow: 'auth-edge-cases', role: 'shared' },

  // ── Profile ──
  { pattern: 'profile/profile-update.spec.js', flow: 'profile-view-edit', role: 'shared' },

  // ── Router Guards ──
  { pattern: 'router-guards/router-guards.spec.js', flow: 'auth-router-guards', role: 'shared' },

  // ── Dashboard ──
  { pattern: 'dashboard/dashboard-activity-feed.spec.js', flow: 'dashboard-activity-feed', role: 'shared' },
  { pattern: 'dashboard/dashboard-activity-feed-time-ranges.spec.js', flow: 'dashboard-activity-feed', role: 'shared' },
  { pattern: 'dashboard/dashboard-lawyer-view.spec.js', flow: 'dashboard-welcome-card', role: 'lawyer' },
  { pattern: 'dashboard/dashboard-navigation.spec.js', flow: 'dashboard-navigation', role: 'shared' },
  { pattern: 'dashboard/dashboard-recent-documents.spec.js', flow: 'dashboard-recent-documents', role: 'shared' },
  { pattern: 'dashboard/dashboard-reports.spec.js', flow: 'dashboard-reports', role: 'lawyer' },
  { pattern: 'dashboard/dashboard-legal-updates.spec.js', flow: 'dashboard-legal-updates', role: 'shared' },
  { pattern: 'dashboard/dashboard-legal-updates-crud.spec.js', flow: 'dashboard-legal-updates', role: 'shared' },
  { pattern: 'dashboard/dashboard-legal-updates-store.spec.js', flow: 'dashboard-legal-updates', role: 'shared' },
  { pattern: 'dashboard/dashboard-widgets-main-flows.spec.js', flow: 'dashboard-quick-actions', role: 'shared' },
  { pattern: 'dashboard/dashboard-folder-components.spec.js', flow: 'dashboard-folder-components', role: 'shared' },

  // ── Subscriptions ──
  { pattern: 'subscriptions/subscriptions-flow.spec.js', flow: 'subscriptions-checkout-free', role: 'shared' },
  { pattern: 'subscriptions/checkout-flow.spec.js', flow: 'subscriptions-checkout-free', role: 'shared' },
  { pattern: 'subscriptions/subscription-management.spec.js', flow: 'subscriptions-management', role: 'shared' },
  { pattern: 'subscriptions/subscription-management-flows.spec.js', flow: 'subscriptions-management', role: 'shared' },
  { pattern: 'subscriptions/subscription-store-actions.spec.js', flow: 'subscriptions-store', role: 'shared' },
  { pattern: 'subscriptions/subscription-store-flows.spec.js', flow: 'subscriptions-checkout-paid', role: 'shared' },
  { pattern: 'subscriptions/subscription-store-full.spec.js', flow: 'subscriptions-store', role: 'shared' },
  { pattern: 'checkout/checkout-payment-flow.spec.js', flow: 'subscriptions-checkout-paid', role: 'shared' },

  // ── Processes ──
  { pattern: 'process/process-flow.spec.js', flow: 'process-list-view', role: 'shared' },
  { pattern: 'process/process-list-detail-render.spec.js', flow: 'process-list-view', role: 'shared' },
  { pattern: 'process/process-list-interactions.spec.js', flow: 'process-list-view', role: 'shared' },
  { pattern: 'process/process-detail-actions.spec.js', flow: 'process-detail', role: 'lawyer' },
  { pattern: 'process/process-form-flow.spec.js', flow: 'process-create', role: 'lawyer' },
  { pattern: 'process/process-form-validation.spec.js', flow: 'process-form-validation', role: 'lawyer' },
  { pattern: 'process/process-history-and-search.spec.js', flow: 'process-history', role: 'lawyer' },
  { pattern: 'process/process-history-modal-behavior.spec.js', flow: 'process-history', role: 'lawyer' },
  { pattern: 'process/process-store-actions.spec.js', flow: 'process-store', role: 'shared' },
  { pattern: 'processes/process-store-actions.spec.js', flow: 'process-store', role: 'shared' },

  // ── Legal Requests ──
  { pattern: 'legal-requests/legal-requests-flow.spec.js', flow: 'legal-create-request', role: 'client' },
  { pattern: 'legal-requests/legal-requests-list-interactions.spec.js', flow: 'legal-list-client', role: 'shared' },
  { pattern: 'legal-requests/legal-requests-client-detail.spec.js', flow: 'legal-detail-client', role: 'client' },
  { pattern: 'legal-requests/add-files-modal.spec.js', flow: 'legal-add-files', role: 'client' },
  { pattern: 'legal-requests/legal-request-add-files.spec.js', flow: 'legal-add-files', role: 'client' },
  { pattern: 'legal-requests/legal-requests-management-extended.spec.js', flow: 'legal-management-lawyer', role: 'lawyer' },
  { pattern: 'legal-requests/legal-requests-management-status.spec.js', flow: 'legal-status-update', role: 'lawyer' },
  { pattern: 'legal-requests/legal-requests-response-and-delete.spec.js', flow: 'legal-response-thread', role: 'shared' },
  { pattern: 'legal-requests/legal-requests-lawyer-modals.spec.js', flow: 'legal-lawyer-modals', role: 'lawyer' },

  // ── Signatures ──
  { pattern: 'electronic-signature/electronic-signature.spec.js', flow: 'sign-electronic-signature', role: 'shared' },
  { pattern: 'signatures/electronic-signature-modal.spec.js', flow: 'sign-electronic-signature', role: 'lawyer' },

  // ── Directory ──
  { pattern: 'directory/directory.spec.js', flow: 'directory-search', role: 'lawyer' },

  // ── Schedule ──
  { pattern: 'schedule/schedule-appointment.spec.js', flow: 'schedule-appointment', role: 'client' },

  // ── Intranet ──
  { pattern: 'intranet/intranet-gym.spec.js', flow: 'intranet-main', role: 'lawyer-gym' },
  { pattern: 'intranet/intranet-gym-render.spec.js', flow: 'intranet-render', role: 'lawyer-gym' },
  { pattern: 'intranet/intranet-gym-interactions.spec.js', flow: 'intranet-interactions', role: 'lawyer-gym' },

  // ── User Guide ──
  { pattern: 'user-guide/user-guide-main.spec.js', flow: 'user-guide-navigation', role: 'shared' },
  { pattern: 'misc/user-guide-navigation.spec.js', flow: 'user-guide-navigation', role: 'shared' },
  { pattern: 'misc/user-guide.spec.js', flow: 'user-guide-render', role: 'shared' },
  { pattern: 'user-guide/user-guide-render.spec.js', flow: 'user-guide-render', role: 'shared' },

  // ── New Auth specs ──
  { pattern: 'auth/auth-subscription-sign-up.spec.js', flow: 'auth-subscription-signup', role: 'shared' },
  { pattern: 'auth/auth-idle-logout.spec.js', flow: 'auth-idle-logout', role: 'shared' },
  { pattern: 'auth/auth-login-attempts.spec.js', flow: 'auth-login-attempts', role: 'shared' },

  // ── New Signature specs ──
  { pattern: 'signatures/signature-lawyer-complete-flow.spec.js', flow: 'sign-electronic-signature', role: 'lawyer' },
  { pattern: 'signatures/signature-client-complete-flow.spec.js', flow: 'sign-client-flow', role: 'client' },

  // ── New Document specs ──
  { pattern: 'documents/document-reopen-rejected.spec.js', flow: 'sign-reopen', role: 'lawyer' },
  { pattern: 'documents/document-use-complete-flow.spec.js', flow: 'docs-use-template', role: 'client' },
  { pattern: 'documents/document-reject-client.spec.js', flow: 'sign-reject', role: 'client' },
  { pattern: 'documents/document-duplicate.spec.js', flow: 'docs-duplicate', role: 'lawyer' },
  { pattern: 'documents/document-permissions-combined.spec.js', flow: 'docs-permissions', role: 'lawyer' },
  { pattern: 'documents/documents-basic-user.spec.js', flow: 'basic-restrictions', role: 'basic' },

  // ── New Process specs ──
  { pattern: 'process/process-edit.spec.js', flow: 'process-edit', role: 'lawyer' },
  { pattern: 'process/process-request-info-client.spec.js', flow: 'process-detail', role: 'client' },

  // ── New Subscription specs ──
  { pattern: 'subscriptions/subscription-cancel.spec.js', flow: 'subscriptions-management', role: 'shared' },
  { pattern: 'subscriptions/subscription-update-payment.spec.js', flow: 'subscriptions-management', role: 'shared' },

  // ── New Organization specs ──
  { pattern: 'organizations/corporate/organizations-delete.spec.js', flow: 'org-create', role: 'corporate' },
  { pattern: 'organizations/corporate/organizations-dashboard-stats.spec.js', flow: 'org-corporate-requests', role: 'corporate' },

  // ── New Basic User specs ──
  { pattern: 'dashboard/dashboard-basic-user.spec.js', flow: 'basic-restrictions', role: 'basic' },

  // ── Misc ──
  { pattern: 'misc/policies-and-offline.spec.js', flow: 'misc-policies', role: 'shared' },
  { pattern: 'misc/pwa-install-prompt.spec.js', flow: 'misc-pwa-install', role: 'shared' },
  { pattern: 'policies/policies-navigation.spec.js', flow: 'misc-policies', role: 'shared' },
  { pattern: 'viewport/viewport-responsive.spec.js', flow: 'misc-viewport-responsive', role: 'shared' },
  { pattern: 'error-handling/error-states.spec.js', flow: 'misc-error-handling', role: 'shared' },
  { pattern: 'views/no-connection.spec.js', flow: 'misc-policies', role: 'shared' },

  // ── Documents: Editor & Forms ──
  { pattern: 'documents/document-create-lawyer.spec.js', flow: 'docs-create-template', role: 'lawyer' },
  { pattern: 'documents/document-editor-flow.spec.js', flow: 'docs-editor', role: 'shared' },
  { pattern: 'documents/document-editor-navigation.spec.js', flow: 'docs-editor', role: 'shared' },
  { pattern: 'documents/document-editor-render.spec.js', flow: 'docs-editor', role: 'shared' },
  { pattern: 'documents/document-editor-workflow.spec.js', flow: 'docs-editor', role: 'shared' },
  { pattern: 'views/document-editor.spec.js', flow: 'docs-editor', role: 'shared' },
  { pattern: 'documents/document-variables-config-flow.spec.js', flow: 'docs-variables-config', role: 'lawyer' },
  { pattern: 'views/document-variables-config.spec.js', flow: 'docs-variables-config', role: 'lawyer' },
  { pattern: 'documents/document-form-flow.spec.js', flow: 'docs-use-template', role: 'client' },
  { pattern: 'documents/document-form-interactions.spec.js', flow: 'docs-form-interactions', role: 'client' },
  { pattern: 'documents/document-form-variables.spec.js', flow: 'docs-form-interactions', role: 'client' },
  { pattern: 'views/document-form.spec.js', flow: 'docs-use-template', role: 'client' },
  { pattern: 'documents/document-use-template-flow.spec.js', flow: 'docs-use-template', role: 'client' },
  { pattern: 'documents/document-use-template.spec.js', flow: 'docs-use-template', role: 'client' },
  { pattern: 'documents/document-use-card.spec.js', flow: 'docs-use-template', role: 'client' },
  { pattern: 'documents/document-use-card-render.spec.js', flow: 'docs-use-template', role: 'client' },
  { pattern: 'documents/document-use-card-folder-modal.spec.js', flow: 'docs-use-template', role: 'client' },
  { pattern: 'documents/use-document-card.spec.js', flow: 'docs-use-template', role: 'client' },
  { pattern: 'documents/document-use-table-sort-menu.spec.js', flow: 'docs-use-template', role: 'client' },

  // ── Documents: Dashboard views ──
  { pattern: 'documents/document-dashboard-lawyer.spec.js', flow: 'docs-dashboard-lawyer', role: 'lawyer' },
  { pattern: 'documents/document-dashboard-lawyer-tabs.spec.js', flow: 'docs-dashboard-lawyer', role: 'lawyer' },
  { pattern: 'documents/document-lawyer-dashboard-modals.spec.js', flow: 'docs-dashboard-lawyer', role: 'lawyer' },
  { pattern: 'documents/document-lawyer-client-tabs.spec.js', flow: 'docs-dashboard-lawyer', role: 'lawyer' },
  { pattern: 'documents/document-dashboard-client.spec.js', flow: 'docs-dashboard-client', role: 'client' },
  { pattern: 'documents/document-client-dashboard-tabs.spec.js', flow: 'docs-dashboard-client', role: 'client' },
  { pattern: 'documents/document-client-view.spec.js', flow: 'docs-dashboard-client', role: 'client' },
  { pattern: 'documents/document-client-tables.spec.js', flow: 'docs-dashboard-client', role: 'client' },
  { pattern: 'documents/document-client-tables-sort-export.spec.js', flow: 'docs-dashboard-client', role: 'client' },
  { pattern: 'documents/document-client-table-actions.spec.js', flow: 'docs-dashboard-client', role: 'client' },
  { pattern: 'documents/document-dashboard-query-nav.spec.js', flow: 'docs-dashboard-lawyer', role: 'lawyer' },
  { pattern: 'documents/dynamic-document-dashboard.spec.js', flow: 'docs-dashboard-lawyer', role: 'lawyer' },

  // ── Documents: Permissions ──
  { pattern: 'documents/document-permissions-modal.spec.js', flow: 'docs-permissions', role: 'lawyer' },
  { pattern: 'documents/document-permissions-interactions.spec.js', flow: 'docs-permissions', role: 'lawyer' },

  // ── Documents: Cards ──
  { pattern: 'documents/document-card-actions.spec.js', flow: 'docs-card-actions', role: 'shared' },
  { pattern: 'documents/document-card-components.spec.js', flow: 'docs-card-render', role: 'shared' },
  { pattern: 'documents/document-card-composables.spec.js', flow: 'docs-card-actions', role: 'shared' },
  { pattern: 'documents/document-card-interactions.spec.js', flow: 'docs-card-actions', role: 'shared' },
  { pattern: 'documents/document-card-menu-actions.spec.js', flow: 'docs-card-actions', role: 'shared' },
  { pattern: 'documents/document-card-render.spec.js', flow: 'docs-card-render', role: 'shared' },
  { pattern: 'documents/document-cards.spec.js', flow: 'docs-card-render', role: 'shared' },
  { pattern: 'documents/document-base-card.spec.js', flow: 'docs-card-render', role: 'shared' },
  { pattern: 'documents/document-base-card-render.spec.js', flow: 'docs-card-render', role: 'shared' },
  { pattern: 'documents/document-action-execution.spec.js', flow: 'docs-card-actions', role: 'shared' },
  { pattern: 'documents/document-actions-modal.spec.js', flow: 'docs-card-actions', role: 'shared' },
  { pattern: 'documents/document-actions-modal-row-click.spec.js', flow: 'docs-card-actions', role: 'shared' },

  // ── Documents: Filters ──
  { pattern: 'documents/document-filter-advanced.spec.js', flow: 'docs-filters', role: 'shared' },
  { pattern: 'documents/document-filter-by-tags.spec.js', flow: 'docs-filters', role: 'shared' },
  { pattern: 'documents/document-filter-getters.spec.js', flow: 'docs-filters', role: 'shared' },
  { pattern: 'documents/document-filters-menus.spec.js', flow: 'docs-filters', role: 'shared' },
  { pattern: 'documents/document-filters-search.spec.js', flow: 'docs-filters', role: 'shared' },
  { pattern: 'documents/document-filters-search-tag.spec.js', flow: 'docs-filters', role: 'shared' },
  { pattern: 'documents/document-search-functionality.spec.js', flow: 'docs-filters', role: 'shared' },
  { pattern: 'documents/document-hierarchical-menu-groups.spec.js', flow: 'docs-filters', role: 'shared' },
  { pattern: 'documents/document-hierarchical-menu-render.spec.js', flow: 'docs-filters', role: 'shared' },
  { pattern: 'documents/document-menu-group-helpers.spec.js', flow: 'docs-filters', role: 'shared' },
  { pattern: 'documents/document-menu-hierarchical.spec.js', flow: 'docs-filters', role: 'shared' },
  { pattern: 'documents/document-tag-filter-behavior.spec.js', flow: 'docs-filters', role: 'shared' },

  // ── Documents: Tags ──
  { pattern: 'documents/document-tags-management.spec.js', flow: 'docs-tags', role: 'lawyer' },
  { pattern: 'documents/document-tags-display.spec.js', flow: 'docs-tags', role: 'shared' },
  { pattern: 'documents/document-store-getters-tags.spec.js', flow: 'docs-tags', role: 'shared' },
  { pattern: 'composables/document-tags.spec.js', flow: 'docs-tags', role: 'lawyer' },

  // ── Documents: Folders ──
  { pattern: 'documents/document-folder-card.spec.js', flow: 'docs-folders', role: 'shared' },
  { pattern: 'documents/document-folder-crud.spec.js', flow: 'docs-folders', role: 'shared' },
  { pattern: 'documents/document-folder-details.spec.js', flow: 'docs-folders', role: 'shared' },
  { pattern: 'documents/document-folder-getters.spec.js', flow: 'docs-folders', role: 'shared' },
  { pattern: 'documents/document-folder-management.spec.js', flow: 'docs-folders', role: 'shared' },
  { pattern: 'documents/document-folder-move-operations.spec.js', flow: 'docs-folders', role: 'shared' },
  { pattern: 'documents/document-folder-store.spec.js', flow: 'docs-folders', role: 'shared' },
  { pattern: 'documents/document-folder-utilities.spec.js', flow: 'docs-folders', role: 'shared' },
  { pattern: 'documents/document-folder-utilities-validation.spec.js', flow: 'docs-folders', role: 'shared' },
  { pattern: 'documents/document-folder-with-documents.spec.js', flow: 'docs-folders', role: 'shared' },
  { pattern: 'documents/document-folder-color-selection.spec.js', flow: 'docs-folders', role: 'shared' },
  { pattern: 'documents/document-folders-table.spec.js', flow: 'docs-folders', role: 'shared' },
  { pattern: 'documents/document-add-to-folder-modal.spec.js', flow: 'docs-folders', role: 'shared' },

  // ── Documents: Download ──
  { pattern: 'documents/document-download-actions.spec.js', flow: 'docs-download', role: 'shared' },

  // ── Documents: Send Email ──
  { pattern: 'documents/document-send-email-flow.spec.js', flow: 'docs-send-email', role: 'lawyer' },
  { pattern: 'documents/document-send-relationships.spec.js', flow: 'docs-send-email', role: 'lawyer' },
  { pattern: 'documents/send-document-layout.spec.js', flow: 'docs-send-email', role: 'lawyer' },

  // ── Documents: Signatures ──
  { pattern: 'documents/document-electronic-signature.spec.js', flow: 'sign-document-flow', role: 'lawyer' },
  { pattern: 'documents/document-electronic-signature-flow.spec.js', flow: 'sign-document-flow', role: 'lawyer' },
  { pattern: 'documents/document-electronic-signature-modal.spec.js', flow: 'sign-document-flow', role: 'lawyer' },
  { pattern: 'documents/document-signature-client-flow.spec.js', flow: 'sign-client-flow', role: 'client' },
  { pattern: 'documents/document-signatures-actions.spec.js', flow: 'sign-document-flow', role: 'shared' },
  { pattern: 'documents/document-signatures-list.spec.js', flow: 'sign-signed-documents', role: 'shared' },
  { pattern: 'documents/document-signatures-table-interactions.spec.js', flow: 'sign-signed-documents', role: 'shared' },
  { pattern: 'documents/document-signatures-status-modal.spec.js', flow: 'sign-status-modal', role: 'lawyer' },
  { pattern: 'documents/document-archived-signatures.spec.js', flow: 'sign-archived-documents', role: 'shared' },
  { pattern: 'documents/signed-documents-flow.spec.js', flow: 'sign-signed-documents', role: 'shared' },

  // ── Documents: State & Relationships ──
  { pattern: 'documents/document-state-transitions.spec.js', flow: 'docs-state-transitions', role: 'shared' },
  { pattern: 'documents/document-related-documents-tab.spec.js', flow: 'docs-relationships', role: 'shared' },
  { pattern: 'documents/document-relationships-store.spec.js', flow: 'docs-relationships', role: 'shared' },
  { pattern: 'composables/document-relationships.spec.js', flow: 'docs-relationships', role: 'lawyer' },

  // ── Documents: Letterhead ──
  { pattern: 'documents/document-letterhead.spec.js', flow: 'docs-letterhead', role: 'shared' },
  { pattern: 'documents/document-letterhead-interactions.spec.js', flow: 'docs-letterhead', role: 'shared' },
  { pattern: 'documents/document-global-letterhead-upload.spec.js', flow: 'docs-letterhead', role: 'shared' },
  { pattern: 'documents/document-global-letterhead-interactions.spec.js', flow: 'docs-letterhead', role: 'shared' },
  { pattern: 'documents/global-letterhead-modal.spec.js', flow: 'docs-letterhead', role: 'shared' },
  { pattern: 'documents/letterhead-modal.spec.js', flow: 'docs-letterhead', role: 'shared' },

  // ── Documents: Preview & Summary ──
  { pattern: 'documents/document-preview-modal.spec.js', flow: 'docs-preview', role: 'shared' },
  { pattern: 'documents/document-preview-modal-render.spec.js', flow: 'docs-preview', role: 'shared' },
  { pattern: 'documents/document-preview-utils.spec.js', flow: 'docs-preview', role: 'shared' },
  { pattern: 'documents/document-summary-modal.spec.js', flow: 'docs-summary', role: 'shared' },

  // ── Documents: Store & Misc ──
  { pattern: 'documents/document-store-getters.spec.js', flow: 'docs-store-getters', role: 'shared' },
  { pattern: 'documents/document-list-table-interactions.spec.js', flow: 'docs-list-table', role: 'shared' },
  { pattern: 'documents/document-empty-states.spec.js', flow: 'docs-empty-states', role: 'shared' },
  { pattern: 'documents/document-multiple-documents.spec.js', flow: 'docs-multiple', role: 'shared' },
  { pattern: 'documents/document-profile-and-navigation.spec.js', flow: 'docs-profile-navigation', role: 'shared' },
  { pattern: 'documents/document-legal-update-store.spec.js', flow: 'dashboard-legal-updates', role: 'shared' },

  // ── Organizations: Corporate ──
  { pattern: 'organizations/corporate/organizations-corporate-create-organization.spec.js', flow: 'org-create', role: 'corporate' },
  { pattern: 'organizations/corporate/organizations-corporate-edit-organization.spec.js', flow: 'org-edit', role: 'corporate' },
  { pattern: 'organizations/corporate/organizations-corporate-invite-member-stats.spec.js', flow: 'org-invite-members', role: 'corporate' },
  { pattern: 'organizations/corporate/organizations-corporate-invite-member-validation.spec.js', flow: 'org-invite-members', role: 'corporate' },
  { pattern: 'organizations/corporate/organizations-corporate-members-list.spec.js', flow: 'org-members-list', role: 'corporate' },
  { pattern: 'organizations/corporate/organizations-corporate-all-members.spec.js', flow: 'org-members-list', role: 'corporate' },
  { pattern: 'organizations/corporate/organizations-corporate-posts-management.spec.js', flow: 'org-posts-management', role: 'corporate' },
  { pattern: 'organizations/corporate/organizations-corporate-posts-delete.spec.js', flow: 'org-posts-management', role: 'corporate' },
  { pattern: 'organizations/corporate/organizations-corporate-posts-edit-visible-to-client.spec.js', flow: 'org-posts-visibility', role: 'corporate' },
  { pattern: 'organizations/corporate/organizations-corporate-create-post-visible-to-client.spec.js', flow: 'org-posts-visibility', role: 'corporate' },
  { pattern: 'organizations/corporate/organizations-corporate-posts-client-visibility-filter.spec.js', flow: 'org-posts-visibility', role: 'corporate' },
  { pattern: 'organizations/corporate/organizations-corporate-posts-client-pinned-order.spec.js', flow: 'org-posts-visibility', role: 'corporate' },
  { pattern: 'organizations/corporate/organizations-corporate-received-requests-flow.spec.js', flow: 'org-corporate-requests', role: 'corporate' },
  { pattern: 'organizations/corporate/organizations-corporate-received-requests-empty.spec.js', flow: 'org-corporate-requests', role: 'corporate' },
  { pattern: 'organizations/corporate/organizations-corporate-received-requests-add-response.spec.js', flow: 'org-corporate-requests', role: 'corporate' },

  // ── Organizations: Client ──
  { pattern: 'organizations/client/organizations-client.spec.js', flow: 'org-client-view', role: 'client' },
  { pattern: 'organizations/client/organizations-client-view-details-scroll.spec.js', flow: 'org-client-view', role: 'client' },
  { pattern: 'organizations/client/organizations-client-mobile-tabs.spec.js', flow: 'org-client-view', role: 'client' },
  { pattern: 'organizations/client/organizations-client-posts-section.spec.js', flow: 'org-client-view', role: 'client' },
  { pattern: 'organizations/client/organizations-client-posts-refresh.spec.js', flow: 'org-client-view', role: 'client' },
  { pattern: 'organizations/client/organizations-client-invitation-accept.spec.js', flow: 'org-client-invitations', role: 'client' },
  { pattern: 'organizations/client/organizations-client-invitation-reject.spec.js', flow: 'org-client-invitations', role: 'client' },
  { pattern: 'organizations/client/organizations-client-invitation-expired.spec.js', flow: 'org-client-invitations', role: 'client' },
  { pattern: 'organizations/client/organizations-client-create-request.spec.js', flow: 'org-client-requests', role: 'client' },
  { pattern: 'organizations/client/organizations-client-create-request-validation.spec.js', flow: 'org-client-requests', role: 'client' },
  { pattern: 'organizations/client/organizations-client-my-requests-flow.spec.js', flow: 'org-client-requests', role: 'client' },
  { pattern: 'organizations/client/organizations-client-my-requests-filters.spec.js', flow: 'org-client-requests', role: 'client' },
  { pattern: 'organizations/client/organizations-client-request-detail.spec.js', flow: 'org-client-requests', role: 'client' },
  { pattern: 'organizations/client/organizations-client-request-detail-error.spec.js', flow: 'org-client-requests', role: 'client' },
  { pattern: 'organizations/client/organizations-client-new-request-button-disabled.spec.js', flow: 'org-client-requests', role: 'client' },
  { pattern: 'organizations/client/organizations-client-requests-tab-disabled.spec.js', flow: 'org-client-requests', role: 'client' },
  { pattern: 'organizations/client/organizations-client-leave-organization.spec.js', flow: 'org-client-leave', role: 'client' },
  { pattern: 'organizations/client/organizations-client-leave-membership.spec.js', flow: 'org-client-leave', role: 'client' },
  { pattern: 'organizations/client/organizations-modals-render.spec.js', flow: 'org-modals', role: 'shared' },

  // ── Organizations: Cross-role ──
  { pattern: 'organizations/cross-role/organizations-cross-invite-accept-stats.spec.js', flow: 'org-cross-invite-flow', role: 'shared' },
  { pattern: 'organizations/cross-role/organizations-cross-invite-reject-stats.spec.js', flow: 'org-cross-invite-flow', role: 'shared' },
  { pattern: 'organizations/cross-role/organizations-cross-invite-expired.spec.js', flow: 'org-cross-invite-flow', role: 'shared' },
  { pattern: 'organizations/cross-role/organizations-cross-client-create-request-visible-to-corporate.spec.js', flow: 'org-cross-request-flow', role: 'shared' },
  { pattern: 'organizations/cross-role/organizations-cross-request-status-visible-to-client.spec.js', flow: 'org-cross-request-flow', role: 'shared' },
  { pattern: 'organizations/cross-role/organizations-cross-request-response-visible-to-client.spec.js', flow: 'org-cross-request-flow', role: 'shared' },
  { pattern: 'organizations/cross-role/organizations-cross-client-response-visible-to-corporate.spec.js', flow: 'org-cross-request-flow', role: 'shared' },
  { pattern: 'organizations/cross-role/organizations-cross-internal-note-hidden-from-client.spec.js', flow: 'org-cross-request-flow', role: 'shared' },
  { pattern: 'organizations/cross-role/organizations-cross-remove-member.spec.js', flow: 'org-cross-member-management', role: 'shared' },
  { pattern: 'organizations/cross-role/organizations-cross-client-leave-organization.spec.js', flow: 'org-cross-member-management', role: 'shared' },
  { pattern: 'organizations/cross-role/organizations-cross-deactivate-organization-client-loses-access.spec.js', flow: 'org-cross-member-management', role: 'shared' },
  { pattern: 'organizations/cross-role/organizations-cross-edit-organization-visible-to-client.spec.js', flow: 'org-edit', role: 'shared' },

  // ── Organizations: Dashboard & Store ──
  { pattern: 'organizations/organizations-dashboard.spec.js', flow: 'org-store-actions', role: 'shared' },
  { pattern: 'organizations/organizations-store-actions.spec.js', flow: 'org-store-actions', role: 'shared' },
  { pattern: 'organizations/organizations-request-detail.spec.js', flow: 'org-request-detail', role: 'shared' },
];

// ── Load flow definitions for priority lookup ───────────────────────────────
const defsPath = path.join(e2eDir, 'flow-definitions.json');
const flowDefs = JSON.parse(fs.readFileSync(defsPath, 'utf-8')).flows;

// ── Helpers ─────────────────────────────────────────────────────────────────

function getFlowMapping(relPath) {
  // Normalize path separators
  const normalized = relPath.replace(/\\/g, '/');
  for (const entry of FILE_FLOW_MAP) {
    if (normalized === entry.pattern) {
      return entry;
    }
  }
  return null;
}

function buildTagArray(mapping) {
  const def = flowDefs[mapping.flow];
  const priority = def ? def.priority : 'P4';
  const mod = def ? def.module : 'unknown';
  const tags = [
    `'@flow:${mapping.flow}'`,
    `'@module:${mod}'`,
    `'@priority:${priority}'`,
    `'@role:${mapping.role}'`,
  ];
  return `[${tags.join(', ')}]`;
}

/**
 * Transform file content: add { tag: [...] } to test() and test.describe() calls.
 * Strategy:
 * - Find top-level test.describe() → add tag there (covers all inner tests)
 * - Find standalone test() calls (not inside describe) → add tag to each
 * - If file has a mix, add to each top-level test/test.describe
 */
function addTagsToFile(filePath, mapping) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const tagArray = buildTagArray(mapping);
  
  // Check if already tagged
  if (content.includes('@flow:')) {
    return { changed: false, reason: 'already tagged' };
  }

  let result = content;
  let changeCount = 0;

  // Pattern 1: test.describe("title", () => {
  // → test.describe("title", { tag: [...] }, () => {
  result = result.replace(
    /test\.describe\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)\s*,\s*(\(\s*\)\s*=>|async\s*\(\s*\)\s*=>|\(\s*\)\s*=>\s*|function\s*\(\s*\))/g,
    (match, title, callback) => {
      changeCount++;
      return `test.describe(${title}, { tag: ${tagArray} }, ${callback}`;
    }
  );

  // Pattern 2: test("title", async ({ page }) => {
  // → test("title", { tag: [...] }, async ({ page }) => {
  // But only for top-level test() — not test.describe, test.skip, etc. that are already handled
  result = result.replace(
    /(?<!\.(?:describe|skip|only)\s*\()test\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)\s*,\s*(async\s*\(\s*\{)/g,
    (match, title, callback) => {
      changeCount++;
      return `test(${title}, { tag: ${tagArray} }, ${callback}`;
    }
  );

  // Pattern 3: test.skip("title", async ({ page }) => {
  result = result.replace(
    /test\.skip\(\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)\s*,\s*(async\s*\(\s*\{)/g,
    (match, title, callback) => {
      changeCount++;
      return `test.skip(${title}, { tag: ${tagArray} }, ${callback}`;
    }
  );

  if (changeCount === 0) {
    return { changed: false, reason: 'no matching patterns' };
  }

  return { changed: true, content: result, changeCount };
}

// ── Main ────────────────────────────────────────────────────────────────────

function findSpecFiles(dir, base = '') {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (entry.name === 'helpers' || entry.name === 'reporters') continue;
      results.push(...findSpecFiles(path.join(dir, entry.name), relPath));
    } else if (entry.name.endsWith('.spec.js') || entry.name.endsWith('.spec.ts')) {
      results.push(relPath);
    }
  }
  return results;
}

const specFiles = findSpecFiles(e2eDir);
let tagged = 0;
let skipped = 0;
let unmapped = 0;
const unmappedFiles = [];

for (const relPath of specFiles) {
  const mapping = getFlowMapping(relPath);
  if (!mapping) {
    unmapped++;
    unmappedFiles.push(relPath);
    continue;
  }

  const absPath = path.join(e2eDir, relPath);
  const result = addTagsToFile(absPath, mapping);

  if (!result.changed) {
    skipped++;
    continue;
  }

  if (DRY_RUN) {
    console.log(`[DRY RUN] Would tag: ${relPath} → @flow:${mapping.flow} (${result.changeCount} changes)`);
  } else {
    fs.writeFileSync(absPath, result.content, 'utf-8');
    console.log(`  ✅ Tagged: ${relPath} → @flow:${mapping.flow} (${result.changeCount} changes)`);
  }
  tagged++;
}

console.log('');
console.log(`📊 Tagging Summary:`);
console.log(`   Tagged:   ${tagged}`);
console.log(`   Skipped:  ${skipped} (already tagged or no patterns)`);
console.log(`   Unmapped: ${unmapped} (no flow mapping)`);

if (unmappedFiles.length > 0) {
  console.log('');
  console.log(`⚠️  Unmapped files (need manual mapping):`);
  for (const f of unmappedFiles) {
    console.log(`   - ${f}`);
  }
}
