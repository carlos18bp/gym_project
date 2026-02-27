# Requirement Template Structure / Plantilla de Estructura de Requerimientos

---

## [Requirement Number]. [Requirement Title]
<!-- 
    The title should be clear, concise, and descriptive.
    It should indicate the main functionality or feature being requested.
    Example: "21. Electronic Signature in Legal Documents"
-->

---

### Description
<!-- 
    PURPOSE: Explain the current situation or problem that needs to be addressed.
    
    WHAT TO INCLUDE:
    - Current state of the platform regarding this functionality
    - Existing limitations or problems
    - Impact of not having this feature
    - Context that justifies the need for this development
    
    TONE: Objective and factual, focusing on the "what is" rather than "what should be"
    
    EXAMPLE:
    "Currently, the platform allows the generation of legal documents but lacks a mechanism 
    that allows clients and lawyers to electronically sign these documents, which forces 
    users to print them, sign them manually, and digitize them again, generating 
    inefficiencies in the process."
-->

---

### Improvement Proposal
<!-- 
    PURPOSE: Detail the proposed solution to address the problem described.
    
    WHAT TO INCLUDE:
    - Main functionality to be implemented
    - Specific features of the solution (use bullet points)
    - Technical components if relevant
    - User interactions expected
    
    FORMAT: Use bullet points to list each specific feature or capability.
    
    EXAMPLE:
    Implement an electronic signature system in PDF documents that allows:
    
    • **Feature 1**: Brief description of what it does
    • **Feature 2**: Brief description of what it does
    • **Feature 3**: Brief description of what it does
-->

---

### Expected Benefits
<!-- 
    PURPOSE: List the positive outcomes and value that this implementation will bring.
    
    WHAT TO INCLUDE:
    - Direct benefits to end users
    - Operational benefits for the organization
    - Security or compliance improvements
    - Efficiency gains
    - Cost or time savings
    
    FORMAT: Use bullet points with bold benefit titles followed by a brief explanation.
    
    EXAMPLE:
    • **Greater Efficiency**: Eliminates manual steps in the document signing process.
    • **Time Reduction**: Decreases document management time for all user types.
    • **Better User Experience**: Allows signing documents directly from the platform.
-->

---

### Operation Flow
<!-- 
    PURPOSE: Describe step-by-step how the functionality will work from the user's perspective.
    
    WHAT TO INCLUDE:
    - Numbered main steps (1, 2, 3...)
    - Sub-steps using letters or secondary bullets (a, b, c or ○)
    - Clear actor identification (who performs each action)
    - System responses to user actions
    - Decision points or alternative paths if applicable
    
    FORMAT: 
    1. **Step Title**:
       ○ Detailed action description
       ○ System response or next action
    
    EXAMPLE:
    1. **Document Creation and Finalization**:
       ○ A user (regular client, corporate client, or lawyer) creates a legal document.
       ○ Once the document is complete and its status changes to "Completed", 
         the option to sign and send it to other users is enabled.
    
    2. **Recipient Selection**:
       ○ The document creator can select which users to send the document for signature.
       ○ Users can be: other clients, corporate clients, or lawyers.
-->

---

### Transversal Application Changes / Cambios Transversales en la Aplicación
<!-- 
    PURPOSE: Identify and document changes required in other modules due to this implementation.
    
    WHAT TO INCLUDE:
    - User Manual updates (new sections, screenshots, FAQs)
    - Dashboard adjustments (new indicators, shortcuts, notifications)
    - Other affected modules (filters, lists, reports, navigation)
    
    WHY THIS IS IMPORTANT:
    Every new requirement generates cross-cutting changes in the application.
    Documenting these ensures complete implementation and accurate effort estimation.
    
    STANDARD MODULES TO CONSIDER:
    
    #### User Manual / Manual de Usuario
    • New section: Document the new functionality
    • Content update: Step-by-step instructions
    • Screenshots: Visual aids for the new features
    • FAQs: Common questions and answers
    
    #### Dashboard / Panel de Control
    • New indicators: Relevant metrics for the functionality
    • Quick access: Shortcuts to the new module
    • Notifications: Alerts related to the new feature
    
    #### Other Affected Modules / Otros Módulos Afectados
    • List any existing modules that need adjustments
    • Specify what changes are needed in each
    
    EXAMPLE:
    #### Manual de Usuario
    • Nueva sección sobre [funcionalidad]
    • Capturas de pantalla actualizadas
    • Instrucciones paso a paso
    
    #### Dashboard
    • Nuevo indicador de [métrica relevante]
    • Acceso directo a [nueva funcionalidad]
    
    #### Otros Módulos
    • Módulo de Reportes: Incluir datos de [nueva funcionalidad]
    • Filtros de documentos: Considerar nuevo campo [campo]
-->

---

### Important Notes
<!-- 
    PURPOSE: Highlight critical considerations, constraints, or requirements for implementation.
    
    WHAT TO INCLUDE:
    - Platform requirements (web and mobile development)
    - Design approval requirements if applicable
    - Security considerations
    - Integration requirements
    - Dependencies on other features
    - Any special conditions or exceptions
    
    STANDARD NOTE (include in all requirements):
    "This development must be done for both the web application and the mobile application, 
    ensuring that [specific functionality description] from any device, [expected outcome] 
    regardless of the platform used to access the system."
    
    ADDITIONAL NOTES:
    • "This requirement will need design approval prior to development."
    • "Must comply with [specific regulation or standard]."
-->

---

## Complete Example

---

## 21. Electronic Signature in Legal Documents

### Description

Currently, the platform allows the generation of legal documents but lacks a mechanism that allows clients and lawyers to electronically sign these documents, which forces users to print them, sign them manually, and digitize them again, generating inefficiencies in the process.

### Improvement Proposal

Implement an electronic signature system in PDF documents that allows:

• **Document Visualization**: Display documents requiring signature for all users (clients, lawyers, and corporate users).

• **Two Signature Options**: Upload a PNG image of the signature or use touch signature functionality.

• **Touch Signature**: Allow users to draw their signature directly on the screen using their finger (on touch devices), a digital pen, or the mouse cursor.

• **Signature Positioning**: Place the signature in specific locations within the document.

• **Traceability Registration**: Record the date, time, and IP address from which the signature was made.

• **Multiple Signature Flow**: Enable signature workflows between different users: client-lawyer, client-client, corporate client-client.

• **Signature Storage**: Store the user's signature (whether uploaded as PNG or drawn) for reuse in other documents.

### Expected Benefits

• **Greater Efficiency**: Eliminates manual steps in the legal document signing process.

• **Time Reduction**: Decreases document management time for all user types.

• **Better User Experience**: Allows signing documents directly from the platform.

• **Paper Reduction**: Contributes to more sustainable practices.

• **Complete Traceability**: Guarantees security and transparency in the signing process.

• **User Collaboration**: Facilitates collaboration between different user profiles, especially for corporate clients.

• **Enhanced Experience**: Eliminates the need to repeat the signature creation process for each document.

### Operation Flow

1. **Document Creation and Finalization**:
   ○ A user (regular client, corporate client, or lawyer) creates a legal document through the platform.
   ○ Once the document is complete and its status changes to "Completed", the option to sign and send it to other users is enabled.

2. **Recipient Selection**:
   ○ The document creator can select which users to send the document for signature.
   ○ Users can be: other clients, corporate clients, or lawyers.
   ○ The creating user defines the order of signatures if a sequential flow is necessary.

3. **User Signature**:
   ○ The user accesses the "Documents Pending Signature" section.
   ○ Selects the document to sign and views its content.
   ○ If they already have saved signatures, they are offered the option to use one or create a new one.
   ○ Chooses whether to upload a PNG image with their signature or use the touch signature tool.
   ○ If touch signature is chosen, a canvas is displayed where they can draw their signature.
   ○ The system asks if they want to save this signature for future documents.
   ○ Positions the signature in the corresponding place in the document.
   ○ Confirms the signature and the system records the action along with security metadata.

4. **Notification to Next Signers**:
   ○ Once signed, the system automatically sends an email notification to the next user who must sign according to the established flow.
   ○ The email includes a direct link to the document requiring their signature.

5. **Completion Notification**:
   ○ When all users have signed the document, the system notifies all participants.
   ○ Participants receive an email with a link to the fully signed document.

### Important Notes

• This development must be done for both the web application and the mobile application, ensuring that users can sign documents from any device.

• The touch signature functionality must adapt to different devices, allowing the use of a finger on touch screens, a digital pen on tablets, or the mouse cursor on desktop computers.

• Security and legal validity of signatures must be guaranteed, storing metadata of each action such as IP address, date, time, and user.

• The system must be able to generate a final PDF document that includes all applied signatures, keeping them in their correct positions.

---

## Template Checklist

Before finalizing a requirement document, verify:

- [ ] Title is clear and descriptive
- [ ] Description explains the current problem/situation
- [ ] Improvement Proposal lists specific features with bullet points
- [ ] Expected Benefits are quantifiable or clearly defined
- [ ] Operation Flow has numbered steps with detailed sub-steps
- [ ] Important Notes include web/mobile development requirement
- [ ] All sections use consistent formatting
- [ ] Technical terms are explained if necessary
- [ ] User roles are clearly identified in the flow