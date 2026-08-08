import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";
import { bypassCaptcha } from "../helpers/captcha.js";
import { installAuthSignInApiMocks } from "../helpers/authSignInMocks.js";
import { accelerateLongTimers, installLongTimerControl } from "../helpers/idleTimers.js";

// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

// Do NOT reach for `page.clock` here. `clock.install()` (Playwright 1.60) has no
// `toFake` option and always fakes requestAnimationFrame alongside setTimeout;
// one of this app's rAF-driven dashboard libraries clears a rAF handle with
// clearInterval, and Playwright's fake registry throws on that mismatch
// ("Cannot clear timer: timer created with requestAnimationFrame() but cleared
// with clearInterval()"), so fastForward() dies before advancing any time and
// the idle timer never runs. See e2e/helpers/idleTimers.js for the full note
// and for the native-timer approach used below instead.

test("idle timeout logs the user out and redirects to sign_in without any activity", { tag: ['@flow:auth-idle-logout', '@module:auth', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  test.setTimeout(60_000);
  const userId = 8103;
  const email = `lawyer.${userId}@test.local`;

  await installAuthSignInApiMocks(page, { userId, role: "lawyer", signInStatus: 200 });

  // Wrap the native timers before the SPA boots: useIdleLogout's
  // setTimeout(handleIdle, 15 min) is only scheduled by App.vue's real
  // router/authStore wiring (watch(authStore.token) -> subscribe()) once login
  // succeeds, well after this call — the wrapper has to be in place by then to
  // record it.
  await installLongTimerControl(page);

  await page.goto("/sign_in");
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible({
    timeout: 15_000,
  });

  await page.locator('[id="email"]').fill(email);
  await page.locator('[id="password"]').fill("password");
  await bypassCaptcha(page);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("token")), { timeout: 10_000 })
    .toBe("e2e-access-token");

  // No further interaction from here on. Re-arm the idle timer the app itself
  // scheduled so it fires now instead of in 15 minutes; the browser invokes the
  // real handleIdle. A count of 0 means login never armed one — the wiring
  // regression this test exists to catch (useIdleLogout only ever receives a
  // real router/authStore here; its unit test supplies mocks).
  const armedTimers = await accelerateLongTimers(page, { fireInMs: 500 });
  expect(armedTimers).toBeGreaterThan(0);

  await expect(page).toHaveURL(/\/sign_in/, { timeout: 15_000 });
  const token = await page.evaluate(() => localStorage.getItem("token"));
  expect(token).toBeNull();
});

test("unauthenticated user accessing dashboard is redirected to sign_in", { tag: ['@flow:auth-idle-logout', '@module:auth', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 8101;

  // Mock validate_token to return 401 (simulating post-idle state)
  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") {
      return { status: 401, contentType: "application/json", body: JSON.stringify({ error: "expired" }) };
    }

    if (apiPath === "google-captcha/site-key/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };
    }

    return null;
  });

  // Set an expired/invalid token — simulates state after idle logout clears auth
  await setAuthLocalStorage(page, {
    token: "expired-token",
    userAuth: { id: userId, role: "lawyer" },
  });

  await page.goto("/dashboard");

  // Should be redirected to sign_in because token validation fails
  await expect(page).toHaveURL(/\/sign_in/, { timeout: 15_000 });

  // Sign-in page should render correctly
  await expect(page.getByRole("heading", { name: "Te damos la bienvenida de nuevo" })).toBeVisible();
});
