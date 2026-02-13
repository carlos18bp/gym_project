import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { installProfileApiMocks } from "../helpers/profileMocks.js";

test("user can open profile modal and view their information", async ({ page }) => {
  const userId = 7000;

  await installProfileApiMocks(page, {
    userId,
    role: "lawyer",
    firstName: "Carlos",
    lastName: "García",
    email: "carlos@example.com",
    isProfileCompleted: true,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "lawyer",
      is_gym_lawyer: true,
      is_profile_completed: true,
    },
  });

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Open user menu and click profile
  const userMenuButton = page.getByRole("button", { name: /Open user menu|Carlos García/i });
  await userMenuButton.click();

  const profileLink = page.getByText("Perfil");
  await expect(profileLink).toBeVisible({ timeout: 5_000 });
  await profileLink.click();

  // Profile modal should be visible with user information
  const profileModal = page.locator("#viewProfileModal");
  await expect(profileModal).toBeVisible({ timeout: 10_000 });
  await expect(profileModal.getByText("Carlos García")).toBeVisible();
  await expect(profileModal.getByText("carlos@example.com")).toBeVisible();
});

test("user can navigate to edit profile form and update fields", async ({ page }) => {
  const userId = 7001;

  await installProfileApiMocks(page, {
    userId,
    role: "client",
    firstName: "María",
    lastName: "López",
    email: "maria@example.com",
    isProfileCompleted: true,
    updateProfileStatus: 200,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "client",
      is_profile_completed: true,
    },
  });

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Open profile modal
  const userMenuButton = page.getByRole("button", { name: /Open user menu|María López/i });
  await userMenuButton.click();
  await page.getByText("Perfil").click();

  // Wait for profile modal
  const profileModal = page.locator("#viewProfileModal");
  await expect(profileModal).toBeVisible({ timeout: 10_000 });
  await expect(profileModal.getByText("María López")).toBeVisible();

  // Click edit button
  await profileModal.getByRole("button", { name: "Editar" }).click();

  // Edit profile form should be visible
  await expect(page.getByText("Editar perfil")).toBeVisible({ timeout: 10_000 });

  // Update first name
  const firstNameInput = page.locator("#firstName");
  await expect(firstNameInput).toBeVisible();
  await firstNameInput.clear();
  await firstNameInput.fill("María Elena");

  // Update phone number
  const phoneInput = page.locator("#phone-number");
  await phoneInput.clear();
  await phoneInput.fill("3109876543");

  // Click save button
  await page.getByRole("button", { name: "Guardar" }).click();

  // After save, profile slides back to view mode — verify view profile is shown
  const viewModal = page.locator("#viewProfileModal");
  await expect(viewModal).toBeVisible({ timeout: 10_000 });
});

test("incomplete profile shows 'Completa tu perfil' button", async ({ page }) => {
  const userId = 7002;

  await installProfileApiMocks(page, {
    userId,
    role: "client",
    firstName: "Nuevo",
    lastName: "Usuario",
    email: "nuevo@example.com",
    isProfileCompleted: false,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "client",
      is_profile_completed: false,
    },
  });

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Profile modal should auto-open for incomplete profiles or be accessible via menu
  // Check if "Completa tu perfil" text appears
  await expect(page.getByText("Completa tu perfil")).toBeVisible({ timeout: 15_000 });
});
