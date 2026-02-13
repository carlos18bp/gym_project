import { mockApi } from "./api.js";

export function buildMockUser({
  id,
  role,
  isProfileCompleted = true,
  isGymLawyer = role === "lawyer",
  hasSignature = false,
} = {}) {
  return {
    id,
    first_name: "E2E",
    last_name: role === "lawyer" ? "Lawyer" : "Client",
    email: "e2e@example.com",
    role,
    contact: "",
    birthday: "",
    identification: "",
    document_type: "",
    photo_profile: "",
    created_at: new Date().toISOString(),
    is_profile_completed: isProfileCompleted,
    is_gym_lawyer: isGymLawyer,
    has_signature: hasSignature,
  };
}

export async function installTinyMceCloudStub(page) {
  await page.route("**://cdn.tiny.cloud/**", async (route) => {
    const url = route.request().url();

    if (url.endsWith(".css")) {
      return route.fulfill({
        status: 200,
        contentType: "text/css",
        body: "",
      });
    }

    // Default: JS
    const stub = `
      (function(){
        function createToolbar(buttonDefs) {
          var existing = document.querySelector('[data-e2e-tinymce-toolbar="1"]');
          if (existing) existing.remove();

          var toolbar = document.createElement('div');
          toolbar.setAttribute('data-e2e-tinymce-toolbar', '1');
          toolbar.style.position = 'fixed';
          toolbar.style.top = '0';
          toolbar.style.left = '0';
          toolbar.style.right = '0';
          toolbar.style.zIndex = '99999';
          toolbar.style.background = '#ffffff';
          toolbar.style.borderBottom = '1px solid #e5e7eb';
          toolbar.style.padding = '8px';
          toolbar.style.display = 'flex';
          toolbar.style.gap = '8px';

          Object.keys(buttonDefs).forEach(function(name){
            var def = buttonDefs[name];
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = def && def.text ? def.text : name;
            btn.style.padding = '6px 10px';
            btn.style.border = '1px solid #d1d5db';
            btn.style.borderRadius = '6px';
            btn.style.background = '#f9fafb';
            btn.style.cursor = 'pointer';
            btn.addEventListener('click', function(){
              try {
                if (def && typeof def.onAction === 'function') def.onAction();
              } catch(e) {}
            });
            toolbar.appendChild(btn);
          });

          document.body.appendChild(toolbar);
        }

        function createEditor() {
          var handlers = {};
          var buttonDefs = {};
          var editor = {
            ui: { registry: {
              addButton: function(name, def){ buttonDefs[name] = def || {}; },
              addMenuItem: function(){}
            } },
            on: function(evt, cb){ (handlers[evt]||(handlers[evt]=[])).push(cb); },
            fire: function(evt){ (handlers[evt]||[]).forEach(function(fn){ try { fn({}); } catch(e){} }); },
            getContent: function(){ return '<p>Contenido inicial</p>'; },
            setContent: function(){},
            dom: { select: function(){ return []; }, create: function(){ return document.createElement('span'); }, insertAfter: function(){} },
            selection: {
              getNode: function(){ return document.body; },
              getRng: function(){ return { commonAncestorContainer: document.body }; },
              getContent: function(){ return ''; },
              select: function(){},
              collapse: function(){}
            },
            getBody: function(){ return document.body; },
            __e2eButtonDefs: buttonDefs,
            __e2eCreateToolbar: function(){ createToolbar(buttonDefs); }
          };
          return editor;
        }

        var tinymce = {
          activeEditor: null,
          init: function(opts){
            var editor = createEditor();
            tinymce.activeEditor = editor;
            if (opts && typeof opts.setup === 'function') {
              try { opts.setup(editor); } catch(e) {}
            }
            // Render toolbar after setup registers custom buttons.
            setTimeout(function(){
              try { editor.__e2eCreateToolbar(); } catch(e) {}
              editor.fire('init');
            }, 0);
            return Promise.resolve([editor]);
          },
          remove: function(){},
          get: function(){ return tinymce.activeEditor; }
        };

        window.tinymce = tinymce;
      })();
    `;

    return route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: stub,
    });
  });
}

export async function installDocumentEditorApiMocks(
  page,
  { userId, role = "lawyer", documentId = 101, document = null }
) {
  const user = buildMockUser({ id: userId, role, hasSignature: false });

  const nowIso = new Date().toISOString();

  let doc =
    document ||
    {
      id: documentId,
      title: "Minuta E2E",
      state: "Draft",
      created_by: userId,
      assigned_to: null,
      code: `DOC-${documentId}`,
      tags: [],
      created_at: nowIso,
      updated_at: nowIso,
      content: "<p>Contenido inicial</p>",
      variables: [],
    };

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "users/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([user]),
      };
    }

    if (apiPath === `users/${userId}/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(user),
      };
    }

    if (apiPath === `users/${userId}/signature/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ has_signature: false }),
      };
    }

    // Document editor load
    if (apiPath === `dynamic-documents/${documentId}/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(doc),
      };
    }

    // Documents list (dashboard refresh after save)
    if (apiPath === "dynamic-documents/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([doc]),
      };
    }

    if (apiPath === `dynamic-documents/${documentId}/update/`) {
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON?.() || {};
        doc = {
          ...doc,
          ...body,
          updated_at: new Date().toISOString(),
        };
        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(doc),
        };
      }
    }

    // Dynamic document dashboard tabs
    if (apiPath === "dynamic-documents/folders/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      };
    }

    // Tags / permissions (used by DocumentVariablesConfig managers)
    if (apiPath === "dynamic-documents/tags/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "dynamic-documents/permissions/clients/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          clients: [
            {
              id: 2001,
              user_id: 2001,
              full_name: "Client One",
              email: "client@example.com",
              role: "client",
            },
          ],
        }),
      };
    }

    if (apiPath === "dynamic-documents/permissions/roles/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            code: "client",
            display_name: "Clientes",
            description: "Clientes del sistema",
            user_count: 1,
            has_automatic_access: false,
            can_be_granted_permissions: true,
          },
        ]),
      };
    }

    if (apiPath === `dynamic-documents/${documentId}/permissions/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          is_public: false,
          visibility_user_ids: [],
          usability_user_ids: [],
          visibility_roles: [],
          usability_roles: [],
        }),
      };
    }

    // Dashboard misc
    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "dynamic-documents/recent/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "create-activity/") {
      const now = new Date().toISOString();
      return {
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: 1, action_type: "update", description: "", created_at: now }),
      };
    }

    if (apiPath === "legal-updates/active/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "google-captcha/site-key/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ site_key: "e2e-site-key" }),
      };
    }

    return null;
  });
}
