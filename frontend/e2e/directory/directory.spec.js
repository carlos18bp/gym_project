import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
// quality: allow-fragile-test-data (seeded fake data from generate_fake_data command)

  installDirectoryApiMocks,
  buildMockUser,
  buildMockProcess,
} from "../helpers/directoryMocks.js";

test("directory list renders, can search, and shows user modal", { tag: ['@flow:directory-search', '@module:directory', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const lawyerId = 1900;
  const clientId = 1901;

  const users = [
    buildMockUser({
      id: lawyerId,
      role: "lawyer",
      firstName: "E2E",
      lastName: "Lawyer",
      email: "lawyer@example.com",
      identification: "LAW-1",
    }),
    buildMockUser({
      id: clientId,
      role: "client",
      firstName: "Ana",
      lastName: "Client",
      email: "ana@example.com",
      identification: "CLI-1",
    }),
  ];

  const processes = [
    buildMockProcess({ id: 501, lawyerId, clientId }),
    buildMockProcess({ id: 502, lawyerId, clientId }),
  ];

  await installDirectoryApiMocks(page, {
    currentUserId: lawyerId,
    users,
    processes,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: lawyerId,
      role: "lawyer",
      is_gym_lawyer: true,
      is_profile_completed: true,
    },
  });

  await page.goto("/directory_list");
  await expect(page).toHaveURL(/\/directory_list/);

  const list = page.locator("main ul.divide-y.divide-gray-100");

  // List should show both users
  await expect(list.getByText("E2E Lawyer (Abogado)")).toBeVisible();
  await expect(list.getByText("Ana Client (Cliente)")).toBeVisible();

  // Search should filter
  await page.locator("#search-field").fill("ana"); // quality: allow-fragile-selector (stable DOM id)
  await expect(list.getByText("Ana Client (Cliente)")).toBeVisible();
  await expect(list.getByText("E2E Lawyer (Abogado)")).toHaveCount(0);

  // Open modal
  await list.getByText("Ana Client (Cliente)").click();
  await expect(page.getByRole("heading", { name: "Ana Client" })).toBeVisible();
  await expect(page.getByText("Información del usuario")).toBeVisible();

  // Processes section should load using process store
  await expect(page.getByText("Procesos del usuario")).toBeVisible();
  await expect(page.getByText(/Se encontraron 2 proceso\(s\) asociados/)).toBeVisible();

  // Close modal
  await page
    .locator("div.bg-gradient-to-r")
    .locator("button")
    .first() // quality: allow-fragile-selector (positional selector for first matching element)
    .click();
  await expect(page.getByRole("heading", { name: "Ana Client" })).toHaveCount(0);
});

test("directory search clears when input is emptied", { tag: ['@flow:directory-search', '@module:directory', '@priority:P2', '@role:lawyer'] }, async ({ page }) => {
  const lawyerId = 1910;
  const clientId = 1911;

  const users = [
    buildMockUser({
      id: lawyerId,
      role: "lawyer",
      firstName: "Carlos",
      lastName: "Abogado",
      email: "carlos@example.com",
      identification: "LAW-10",
    }),
    buildMockUser({
      id: clientId,
      role: "client",
      firstName: "María",
      lastName: "Cliente",
      email: "maria@example.com",
      identification: "CLI-10",
    }),
  ];

  await installDirectoryApiMocks(page, {
    currentUserId: lawyerId,
    users,
    processes: [],
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: { id: lawyerId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
  });

  await page.goto("/directory_list");

  const list = page.locator("main ul.divide-y.divide-gray-100");

  // Both users visible initially
  await expect(list.getByText("Carlos Abogado (Abogado)")).toBeVisible();
  await expect(list.getByText("María Cliente (Cliente)")).toBeVisible();

  // Search filters to María only
  await page.locator("#search-field").fill("María"); // quality: allow-fragile-selector (stable DOM id)
  await expect(list.getByText("María Cliente (Cliente)")).toBeVisible();
  await expect(list.getByText("Carlos Abogado (Abogado)")).toHaveCount(0);

  // Clearing search restores both
  await page.locator("#search-field").clear(); // quality: allow-fragile-selector (stable DOM id)
  await expect(list.getByText("Carlos Abogado (Abogado)")).toBeVisible();
  await expect(list.getByText("María Cliente (Cliente)")).toBeVisible();
});
