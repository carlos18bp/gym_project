import { mockApi } from "./api.js";

export async function installForgetPasswordApiMocks(
  page,
  {
    sendPasscodeStatus = 200,
    resetStatus = 200,
    resetError = "Código inválido",
  } = {}
) {
  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "google-captcha/site-key/") {
      return {
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ site_key: "e2e-site-key" }),
      };
    }

    if (apiPath === "send_passcode/") {
      if (route.request().method() === "POST") {
        if (sendPasscodeStatus !== 200) {
          return {
            status: sendPasscodeStatus,
            contentType: "application/json",
            body: JSON.stringify({ error: "Usuario no encontrado" }),
          };
        }

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        };
      }
    }

    if (apiPath === "verify_passcode_and_reset_password/") {
      if (route.request().method() === "POST") {
        if (resetStatus !== 200) {
          return {
            status: resetStatus,
            contentType: "application/json",
            body: JSON.stringify({ error: resetError }),
          };
        }

        return {
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        };
      }
    }

    return null;
  });
}
