import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installProfileApiMocks } from "../helpers/profileMocks.js";

/**
 * E2E tests for profile-complete flow.
 * Covers: forced profile completion modal on first login.
 */

test("user with incomplete profile sees profile completion modal on dashboard", { tag: ['@flow:profile-complete', '@module:profile', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 8800;

  await installProfileApiMocks(page, {
    userId,
    role: "client",
    firstName: "Nuevo",
    lastName: "Usuario",
    isProfileCompleted: false,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: false },
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // The profile modal auto-opens with the "Completa tu perfil" call to action
  const profileModal = page.locator("#viewProfileModal"); // quality: allow-fragile-selector (stable DOM id)
  await expect(profileModal).toBeVisible({ timeout: 15_000 });
  await expect(profileModal.getByRole("button", { name: "Completa tu perfil" })).toBeVisible();
  await expect(profileModal.getByText("Nuevo Usuario")).toBeVisible();
});

test("user with completed profile does not see profile completion modal", { tag: ['@flow:profile-complete', '@module:profile', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 8801;

  await installProfileApiMocks(page, {
    userId,
    role: "client",
    firstName: "Completo",
    lastName: "Usuario",
    isProfileCompleted: true,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: true },
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Positive anchor: dashboard content rendered for the completed user
  await expect(page.getByText("Procesos activos")).toBeVisible({ timeout: 15_000 });

  // The forced profile-completion modal must NOT be present
  await expect(page.locator("#viewProfileModal")).toBeHidden(); // quality: allow-fragile-selector (stable DOM id)
  await expect(page.getByRole("button", { name: "Completa tu perfil" })).toBeHidden();
});

test("lawyer with incomplete profile sees completion prompt", { tag: ['@flow:profile-complete', '@module:profile', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const userId = 8802;

  await installProfileApiMocks(page, {
    userId,
    role: "lawyer",
    firstName: "Nuevo",
    lastName: "Abogado",
    isProfileCompleted: false,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: false },
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  const profileModal = page.locator("#viewProfileModal"); // quality: allow-fragile-selector (stable DOM id)
  await expect(profileModal).toBeVisible({ timeout: 15_000 });
  await expect(profileModal.getByRole("button", { name: "Completa tu perfil" })).toBeVisible();
  await expect(profileModal.getByText("Nuevo Abogado")).toBeVisible();
});

// Multipart field extractor: userStore.updateUser() sends the profile update
// as FormData (not JSON), so the field values must be pulled out of the raw
// multipart body rather than parsed with postDataJSON().
function parseMultipartField(body, field) {
  const match = body.match(
    new RegExp(`name="${field}"\\s*\\r?\\n\\r?\\n([\\s\\S]*?)\\r?\\n--`)
  );
  return match ? match[1] : undefined;
}

test("completing the forced profile modal submits the real payload and unlocks the close control", { tag: ['@flow:profile-complete', '@module:profile', '@priority:P2', '@role:shared'] }, async ({ page }) => {
  const userId = 8803;

  await installProfileApiMocks(page, {
    userId,
    role: "client",
    firstName: "Nuevo",
    lastName: "Usuario",
    isProfileCompleted: false,
  });

  // Supersedes installProfileApiMocks' own PUT handler for this one path
  // (registered after it, so it takes precedence) purely to capture the
  // request the form actually sends.
  const updateRequests = [];
  await page.route(`**/update_profile/${userId}/`, async (route) => {
    updateRequests.push(route.request());
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: userId, role: "client", is_gym_lawyer: false, is_profile_completed: false },
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  const profileModal = page.locator("#viewProfileModal"); // quality: allow-fragile-selector (stable DOM id)
  await expect(profileModal).toBeVisible({ timeout: 15_000 });

  // The close (X) control only renders via v-if="currentUser.is_profile_completed"
  // — before completing, it must not exist at all (not just be hidden).
  await expect(page.getByTestId("profile-close-button")).toHaveCount(0);

  await profileModal.getByRole("button", { name: "Completa tu perfil" }).click();
  await expect(page.getByText("Editar perfil")).toBeVisible({ timeout: 10_000 });

  await page.locator("#firstName").fill("Laura"); // quality: allow-fragile-selector (stable DOM id)
  await page.locator("#lastName").fill("Restrepo"); // quality: allow-fragile-selector (stable DOM id)
  await page.locator("#phone-number").fill("3009998877"); // quality: allow-fragile-selector (stable DOM id)
  await page.locator("#email").fill("laura.restrepo@example.com"); // quality: allow-fragile-selector (stable DOM id)
  await page.locator("#dob").fill("1988-04-12"); // quality: allow-fragile-selector (stable DOM id)
  await page.locator("#civil-status").selectOption("NIT"); // quality: allow-fragile-selector (stable DOM id)
  await page.locator("#idNumber").fill("987654321"); // quality: allow-fragile-selector (stable DOM id)

  await page.getByRole("button", { name: "Guardar" }).click();

  // The completion form must reach the real user's endpoint carrying the
  // values just typed — not stale defaults and not a mismatched user id.
  await expect.poll(() => updateRequests.length, { timeout: 10_000 }).toBe(1);
  expect(updateRequests[0].method()).toBe("PUT");
  const body = updateRequests[0].postData() || "";
  expect(parseMultipartField(body, "first_name")).toBe("Laura");
  expect(parseMultipartField(body, "last_name")).toBe("Restrepo");
  expect(parseMultipartField(body, "contact")).toBe("3009998877");
  expect(parseMultipartField(body, "document_type")).toBe("NIT");

  // Only after genuinely completing the required fields does the close
  // control appear — the modal is not dismissable before that point.
  const closeButton = page.getByTestId("profile-close-button");
  await expect(closeButton).toBeVisible({ timeout: 10_000 });
  await closeButton.click();

  await expect(profileModal).toBeHidden({ timeout: 10_000 });
});
