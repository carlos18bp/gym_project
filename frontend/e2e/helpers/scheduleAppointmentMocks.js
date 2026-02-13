import { mockApi } from "./api.js";

export function buildMockUser({
  id,
  role,
  isProfileCompleted = true,
  isGymLawyer = role === "lawyer",
  hasSignature = true,
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

export async function installCalendlyWidgetStub(page) {
  await page.route("**://assets.calendly.com/assets/external/widget.js", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        (function(){
          // Minimal Calendly stub for E2E.
          window.Calendly = window.Calendly || {};
          window.__e2eCalendlyLoaded = true;

          function markLoaded(){
            var el = document.querySelector('.calendly-inline-widget');
            if (el) {
              el.setAttribute('data-e2e-calendly', 'loaded');
              if (!el.querySelector('[data-e2e-calendly-banner]')) {
                var banner = document.createElement('div');
                banner.setAttribute('data-e2e-calendly-banner', '1');
                banner.textContent = 'Calendly widget loaded (stub)';
                banner.style.padding = '8px';
                banner.style.fontSize = '12px';
                banner.style.color = '#374151';
                banner.style.background = '#f3f4f6';
                banner.style.border = '1px solid #e5e7eb';
                banner.style.borderRadius = '8px';
                banner.style.margin = '8px';
                el.appendChild(banner);
              }
            }
          }

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', markLoaded);
          } else {
            markLoaded();
          }
        })();
      `,
    });
  });
}

export async function installScheduleAppointmentApiMocks(page, { userId, role = "lawyer" }) {
  const me = buildMockUser({ id: userId, role });

  await mockApi(page, async ({ apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 200, contentType: "application/json", body: "{}" };
    }

    if (apiPath === "google-captcha/site-key/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ site_key: "e2e-site-key" }),
      };
    }

    if (apiPath === "users/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([me]),
      };
    }

    if (apiPath === `users/${userId}/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(me),
      };
    }

    if (apiPath === `users/${userId}/signature/`) {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ has_signature: true }),
      };
    }

    // Dashboard misc endpoints (avoid noise if any widgets request them)
    if (apiPath === "recent-processes/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "dynamic-documents/recent/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "user-activities/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    if (apiPath === "legal-updates/active/") {
      return { status: 200, contentType: "application/json", body: "[]" };
    }

    return null;
  });
}
