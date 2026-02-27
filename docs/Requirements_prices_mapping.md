# Requirements Mapping - G&M Project V3.0
## Mapeo de Requerimientos con Esfuerzo y Precio

---

## Summary Table / Tabla Resumen

| # | Requirement | Difficulty | Price (COP) | Deliverable | Month |
|---|-------------|------------|-------------|-------------|-------|
| 1 | Restricted Visibility of Legal Documents for Clients | Medium | 1,620,000 | 5 | August |
| 2 | User Role Creation | Medium-Low | 540,000 | 8 | November |
| 3 | Document Organization with Tags and Folders | Medium-High | 1,980,000 | 4 | July |
| 4 | Logical Rules in Legal Forms | Medium | 1,350,000 | 6 | September |
| 5 | Custom Watermark/Letterhead | Medium | 1,260,000 | 5 | August |
| 6 | Restriction Notices | Low-Medium | 810,000 | 6 | September |
| 7 | Landing Page | Medium | 2,160,000 | 1 | April |
| 8 | Login Security Control (CAPTCHA) | Medium | 1,080,000 | 4 | July |
| 9 | Request Management in Intranet | Medium | 1,170,000 | 8 | November |
| 10 | Session Timeout for Inactivity | Low-Medium | 900,000 | 3 | June |
| 11 | Excel Report Generation (.xlsx) | Medium | 1,620,000 | 1 | April |
| 12 | Subscription and Payment System | High | 3,420,000 | 7 | October |
| 13 | Email Template Design for Reports | Low-Medium | 810,000 | 3 | June |
| 14 | Improve Request Functionality | Medium-High | 2,160,000 | 6 | September |
| 15 | Field Customization in Legal Documents | Medium-High | 2,160,000 | 3 | June |
| 16 | Client Additional Fields in Contracts | Medium | 1,440,000 | 5 | August |
| 17 | Copy Legal Document Option | Low-Medium | 720,000 | 4 | July |
| 18 | Rename Document Without Edit Mode | Low | 360,000 | 1 | April |
| 19 | User Manual via Modal | Low-Medium | 630,000 | 8 | November |
| 20 | Terms & Conditions Checkbox on Sign-On | Low | 180,000 | 2 | May |
| 21 | Electronic Signature in Legal Documents | High | 3,960,000 | 2 | May |
| 22 | Automatic Invoice Generation (Siigo API) | High | 2,100,000 | 8 | November |

---

## Difficulty Classification Analysis / Análisis de Clasificación por Dificultad

### HIGH / ALTO
**Price Range: 2,100,000 - 3,960,000 COP**

| # | Requirement | Price (COP) | Key Characteristics |
|---|-------------|-------------|---------------------|
| 21 | Electronic Signature in Legal Documents | 3,960,000 | External API integration, PDF manipulation, multi-user workflow, security/traceability, touch signature canvas |
| 12 | Subscription and Payment System | 3,420,000 | E-commerce functionality, multiple payment gateway integrations (PayU, Wompi, Stripe, Place to Pay), subscription management |
| 22 | Automatic Invoice Generation (Siigo API) | 2,100,000 | External API integration (Siigo), DIAN compliance, automated billing process |

**Common Characteristics of HIGH difficulty:**
- External API integrations (payment gateways, invoicing systems)
- Complex security requirements
- Multi-step workflows involving multiple user types
- Regulatory/legal compliance requirements
- Advanced PDF manipulation
- Financial transaction handling

---

### MEDIUM-HIGH / MEDIO-ALTO
**Price Range: 1,980,000 - 2,160,000 COP**

| # | Requirement | Price (COP) | Key Characteristics |
|---|-------------|-------------|---------------------|
| 15 | Field Customization in Legal Documents | 2,160,000 | Multiple field types, validation logic, dynamic form generation |
| 14 | Improve Request Functionality | 2,160,000 | CRUD operations, unique sequence generation, history tracking, repository management |
| 3 | Document Organization with Tags and Folders | 1,980,000 | Tag system, filtering logic, saved filter combinations, cross-platform sync |

**Common Characteristics of MEDIUM-HIGH difficulty:**
- Complex data structures and relationships
- Dynamic content generation
- Advanced filtering and search capabilities
- CRUD operations with history tracking
- Multiple user role interactions

---

### MEDIUM / MEDIO
**Price Range: 1,080,000 - 2,160,000 COP**

| # | Requirement | Price (COP) | Key Characteristics |
|---|-------------|-------------|---------------------|
| 7 | Landing Page | 2,160,000 | Custom design, carousel, role-based content, admin content management |
| 11 | Excel Report Generation (.xlsx) | 1,620,000 | File generation, multiple report types, date filtering, data export |
| 1 | Restricted Visibility of Legal Documents | 1,620,000 | Permission system, user/group assignment, centralized management |
| 16 | Client Additional Fields in Contracts | 1,440,000 | Dynamic field addition, approval workflow, validation rules |
| 4 | Logical Rules in Legal Forms | 1,350,000 | Conditional logic, form validation, entity type differentiation |
| 5 | Custom Watermark/Letterhead | 1,260,000 | PDF manipulation, image upload, positioning, opacity settings |
| 9 | Request Management in Intranet | 1,170,000 | Unique sequence, history tracking, CRUD, search/filter |
| 8 | Login Security Control (CAPTCHA) | 1,080,000 | Security integration, bot detection, third-party service |

**Common Characteristics of MEDIUM difficulty:**
- Moderate complexity in business logic
- File generation or manipulation
- Permission/access control systems
- Form validations and conditional logic
- Moderate UI/UX complexity
- Standard CRUD with some additional features

---

### LOW-MEDIUM / BAJO-MEDIO
**Price Range: 630,000 - 900,000 COP**

| # | Requirement | Price (COP) | Key Characteristics |
|---|-------------|-------------|---------------------|
| 10 | Session Timeout for Inactivity | 900,000 | Activity monitoring, timer logic, alert system, auto-logout |
| 6 | Restriction Notices | 810,000 | Visual indicators, upselling prompts, role-based display |
| 13 | Email Template Design for Reports | 810,000 | HTML email template, corporate styling, structured data |
| 17 | Copy Legal Document Option | 720,000 | Document duplication, metadata handling |
| 19 | User Manual via Modal | 630,000 | Modal implementation, content sections, navigation |

**Common Characteristics of LOW-MEDIUM difficulty:**
- UI/UX focused changes
- Simple business logic
- Template or styling work
- Basic CRUD operations
- Timer or monitoring functions
- Content display modifications

---

### LOW / BAJO
**Price Range: 180,000 - 540,000 COP**

| # | Requirement | Price (COP) | Key Characteristics |
|---|-------------|-------------|---------------------|
| 2 | User Role Creation | 540,000 | Role definition, permission assignment (3 roles only) |
| 18 | Rename Document Without Edit Mode | 360,000 | Single field edit, UI modification |
| 20 | Terms & Conditions Checkbox on Sign-On | 180,000 | Checkbox addition, link integration, validation |

**Common Characteristics of LOW difficulty:**
- Minimal business logic
- Single-feature additions
- Simple UI modifications
- Basic form elements
- Configuration-level changes

---

## Effort Standard Definition / Definición de Estándar de Esfuerzo

### Proposed Effort Classification Matrix

| Difficulty Level | Price Range (COP) | Estimated Hours | Complexity Indicators |
|------------------|-------------------|-----------------|----------------------|
| **High** | 2,100,000 - 4,000,000 | 80-160 hrs | External API integration, Payment processing, Complex workflows, Security/compliance requirements, Multi-platform coordination |
| **Medium-High** | 1,980,000 - 2,200,000 | 60-80 hrs | Advanced CRUD with history, Dynamic content generation, Complex filtering, Multiple role interactions |
| **Medium** | 1,080,000 - 1,700,000 | 40-60 hrs | Standard CRUD+, File manipulation, Permission systems, Moderate UI complexity, Form validations |
| **Low-Medium** | 630,000 - 900,000 | 20-40 hrs | UI/UX changes, Simple logic, Templates, Basic monitoring |
| **Low** | 180,000 - 600,000 | 8-20 hrs | Configuration changes, Single fields, Simple validations |

---

## Effort Indicators Checklist / Lista de Verificación de Indicadores de Esfuerzo

### To classify a new requirement, check applicable items:

#### HIGH Effort Indicators:
- [ ] Requires external API integration (payment, invoicing, third-party services)
- [ ] Involves financial transactions or sensitive data
- [ ] Requires regulatory compliance (DIAN, legal signatures, etc.)
- [ ] Multi-step workflow with multiple user types
- [ ] Complex PDF manipulation (signatures, watermarks, positioning)
- [ ] Real-time synchronization requirements
- [ ] Requires extensive security measures

#### MEDIUM-HIGH Effort Indicators:
- [ ] Dynamic content/form generation
- [ ] Complex filtering with saved preferences
- [ ] History tracking and audit trails
- [ ] Unique sequence/ID generation
- [ ] Multiple related CRUD operations

#### MEDIUM Effort Indicators:
- [ ] Standard CRUD with additional features
- [ ] File generation (Excel, PDF reports)
- [ ] Permission/visibility systems
- [ ] Conditional form logic
- [ ] Image/file upload with processing
- [ ] Role-based content display

#### LOW-MEDIUM Effort Indicators:
- [ ] UI styling or template changes
- [ ] Simple timers or monitoring
- [ ] Modal/popup implementations
- [ ] Basic email templates
- [ ] Document duplication

#### LOW Effort Indicators:
- [ ] Single field modifications
- [ ] Checkbox/toggle additions
- [ ] Simple link integrations
- [ ] Configuration-level changes
- [ ] Basic validation additions

---

## Price per Difficulty Statistics / Estadísticas de Precio por Dificultad

| Difficulty | Count | Total (COP) | Average (COP) | Min (COP) | Max (COP) |
|------------|-------|-------------|---------------|-----------|-----------|
| High | 3 | 9,480,000 | 3,160,000 | 2,100,000 | 3,960,000 |
| Medium-High | 3 | 6,300,000 | 2,100,000 | 1,980,000 | 2,160,000 |
| Medium | 8 | 11,710,000 | 1,463,750 | 1,080,000 | 2,160,000 |
| Low-Medium | 5 | 3,870,000 | 774,000 | 630,000 | 900,000 |
| Low | 3 | 1,080,000 | 360,000 | 180,000 | 540,000 |
| **TOTAL** | **22** | **32,440,000** | **1,474,545** | - | - |

---

## Distribution by Deliverable / Distribución por Entregable

| Deliverable | Month | Requirements | Total Price (COP) | Difficulty Mix |
|-------------|-------|--------------|-------------------|----------------|
| 1 | April | 7, 11, 18 | 4,140,000 | 2 Medium, 1 Low |
| 2 | May | 21, 20 | 4,140,000 | 1 High, 1 Low |
| 3 | June | 15, 10, 13 | 3,870,000 | 1 Medium-High, 2 Low-Medium |
| 4 | July | 3, 8, 17 | 3,780,000 | 1 Medium-High, 1 Medium, 1 Low-Medium |
| 5 | August | 1, 5, 16 | 4,320,000 | 3 Medium |
| 6 | September | 14, 4, 6 | 4,320,000 | 1 Medium-High, 1 Medium, 1 Low-Medium |
| 7 | October | 12 | 3,420,000 | 1 High |
| 8 | November | 22, 2, 19, 9 | 4,440,000 | 1 High, 1 Medium, 1 Medium-Low, 1 Low-Medium |

---

## Observations / Observaciones

1. **Price-Difficulty Correlation**: There is a clear correlation between difficulty level and price, with HIGH requirements averaging 3,160,000 COP and LOW averaging 360,000 COP.

2. **Deliverable Balance**: Each monthly deliverable appears balanced to have approximately similar total value (3,420,000 - 4,440,000 COP), mixing different difficulty levels.

3. **High Complexity Items**: The three HIGH difficulty items all involve either:
   - External API integrations (Siigo, Payment Gateways)
   - Complex multi-user workflows (Electronic Signatures)
   - Financial/legal compliance requirements

4. **Most Common Level**: MEDIUM difficulty is the most common (8 requirements), representing standard feature development.

5. **Platform Requirement**: All requirements specify development for both web and mobile applications, which should be factored into effort estimation.