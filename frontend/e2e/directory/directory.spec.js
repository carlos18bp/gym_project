import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDirectoryApiMocks,
  buildMockUser,
  buildMockProcess,
} from "../helpers/directoryMocks.js";

test("directory list renders, can search, and shows user modal", async ({ page }) => {
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
  await page.locator("#search-field").fill("ana");
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
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Ana Client" })).toHaveCount(0);
});
