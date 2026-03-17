# Product Requirement Document — G&M Internal Management Tool

## 1. Overview

G&M Internal Management Tool is a full-stack web application for managing legal processes, organizations, subscriptions, and document workflows within a law firm (**G&M Consultores Jurídicos**). It streamlines interactions between lawyers and clients through a role-based system, enabling case tracking, dynamic document generation, electronic signatures, organization management, and subscription-based billing.

The platform is built as a **Progressive Web App (PWA)** with a **Django REST API** backend and a **Vue 3 SPA** frontend.

---

## 2. Problems Solved

| Problem | Solution |
|---------|----------|
| Manual legal case tracking | Digital process management with stages, case files, and activity tracking |
| Paper-based document workflows | Dynamic document builder with template variables, permissions, and electronic signatures |
| Fragmented client-lawyer communication | Centralized dashboard, legal/corporate request workflows, and organization posts |
| No billing automation | Subscription plans with recurring payments via Wompi gateway and Huey scheduled tasks |
| Lack of access control | Role-based system (Client, Lawyer, Basic, Corporate Client) with fine-grained document permissions |
| No offline access | PWA with service worker for offline readiness and installable app experience |

---

## 3. Target Users

| Role | Description | Key Capabilities |
|------|-------------|------------------|
| **Lawyer** | Law firm staff who manage cases and documents | Create/edit processes, manage dynamic documents, respond to requests, publish legal updates, generate reports, manage organizations |
| **Client** | End users who track their legal cases | View processes, submit legal requests, fill/sign documents, view legal updates, join organizations |
| **Basic** | Registered users without active subscription | Limited access, can upgrade via subscription |
| **Corporate Client** | Organization administrators | Create organizations, manage members/invitations, handle corporate requests, publish posts |

---

## 4. Core Features

### 4.1 User Management
- Role-based access: Client, Lawyer, Basic, Corporate Client
- JWT authentication (SimpleJWT) with 1-day access token lifetime
- Google OAuth integration for social login
- reCAPTCHA protection on registration/login
- User profiles with activity feeds and electronic signatures
- Email verification codes and password reset flow
- Idle logout composable for session security

### 4.2 Process Management
- Legal cases with: authority, plaintiff, defendant, case type, subcase, file number
- Timestamped stages (phases) per process
- Attached case files with upload capability
- Recent-process tracking for quick dashboard access
- Process search and filtering

### 4.3 Dynamic Documents
- Template-based document builder with rich text editor (TinyMCE 7)
- Injectable variables: text, date, signature fields
- Visibility and usability permissions (per user, per role, public toggle)
- Document tags and folders for organization
- Document relationships (linking related documents)
- Letterhead support (image and Word template) per document and per user
- PDF and Word download generation
- Email sending with document attachments
- Recent-document tracking

### 4.4 Electronic Signatures
- Draw on canvas or upload image
- Per-user signature storage
- Document signature requests with pending/signed/rejected/archived states
- Signature reopening and removal
- Signatures PDF generation with QR codes

### 4.5 Organizations
- Create and manage organizations with title, description, profile image, cover image
- Invitation system (send, accept, reject, cancel, expire)
- Membership management (add, remove, leave)
- Organization posts (create, edit, delete, pin, toggle active status) with optional hyperlinks
- Organization statistics dashboard

### 4.6 Legal Requests
- Clients submit requests categorized by type and discipline
- File attachments per request
- Lawyer responses with conversation thread
- Status tracking (PENDING, IN_REVIEW, RESPONDED, CLOSED)
- Email notifications on status changes and new responses

### 4.7 Corporate Requests
- Similar to legal requests but for corporate matters
- Client-side: create requests, view own requests, add responses
- Corporate-side: view received requests, update status, add responses
- Dashboard statistics for corporate clients

### 4.8 Subscriptions & Payments
- Subscription plans with recurring billing via Wompi payment gateway
- Automated monthly payment processing through Huey scheduled tasks
- Payment history tracking
- Automatic role downgrade on payment failure (active → expired → basic)
- Subscription cancellation and payment method update
- Wompi webhook for real-time payment status updates
- Integrity signature verification for transaction security

### 4.9 Dashboard & Activity Feed
- Centralized dashboard with recent processes and recent documents
- Activity feed tracking user actions
- Report generation with Excel export (openpyxl, XlsxWriter)

### 4.10 Intranet
- Internal legal document library
- Intranet profiles for firm staff
- Facturation/report request form

### 4.11 Legal Updates
- Lawyers publish legal updates visible to clients
- Active updates listing

### 4.12 PWA Support
- Service worker for offline readiness
- Installable app experience with install prompts
- No-connection fallback page

### 4.13 User Guide
- In-app interactive user guide with module-based navigation
- Role-specific information cards
- Search functionality within the guide
- Quick links and example modals

---

## 5. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | Query profiling via django-silk (dev); slow query alerts (>500ms); N+1 detection |
| **Security** | JWT auth, CSRF protection, reCAPTCHA, Wompi signature verification, file upload validation (python-magic), CORS configuration |
| **Reliability** | Automated daily backups (DB + media) via Huey with 20-backup retention; error logging to file |
| **Scalability** | Redis-backed Huey task queue for async processing; SQLite (dev) / MySQL (prod) |
| **Testing** | pytest (backend), Jest (frontend unit), Playwright (frontend E2E); test quality gate with CI enforcement |
| **Accessibility** | Responsive design via TailwindCSS; PWA for mobile/tablet |
| **Monitoring** | Silk profiling dashboard (staff only); weekly slow-query reports; silk garbage collection |

---

## 6. Business Rules

1. **Role hierarchy**: Lawyers can access all features; Clients see only their own data; Basic users have limited access; Corporate Clients manage organizations.
2. **Document permissions**: Two-level system — visibility (can see) and usability (can edit/fill). Permissions can be granted per user, per role, or publicly.
3. **Subscription lifecycle**: Active → payment due → Wompi charge → success (renew 30 days) or failure (expire + downgrade to basic).
4. **Organization invitations**: Have expiration; can be accepted, rejected, or cancelled by the corporate client.
5. **Legal request workflow**: Client creates → Lawyer reviews → status updates with email notifications → conversation thread.
6. **Process stages**: Timestamped and ordered; each process tracks its current stage and history.
7. **Electronic signatures**: Once signed, documents maintain audit trail; signatures can be reopened by document owner.
8. **Idle logout**: Automatic session termination after inactivity period for security.

---

## 7. External Integrations

| Integration | Purpose |
|-------------|---------|
| **Wompi** | Payment gateway for subscription billing (sandbox + production) |
| **Google OAuth** | Social login authentication |
| **Google reCAPTCHA** | Bot protection on auth forms |
| **Gmail SMTP** | Email notifications (verification codes, request updates, document emails) |
| **Redis** | Task queue backend for Huey |
| **TinyMCE** | Rich text editor for dynamic documents |
