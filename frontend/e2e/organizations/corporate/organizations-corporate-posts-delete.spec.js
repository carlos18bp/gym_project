import { test, expect } from "../../helpers/test.js";

import { setAuthLocalStorage } from "../../helpers/auth.js";
import { installOrganizationsDashboardApiMocks } from "../../helpers/organizationsDashboardMocks.js";

const buildEmail = (prefix) => `${prefix}@mail.local`;

const buildDashboardAuth = ({ id, role, firstName, lastName, email }) => ({
  token: "e2e-token",
  userAuth: {
    id,
    role,
    is_gym_lawyer: false,
    is_profile_completed: true,
    first_name: firstName,
    last_name: lastName,
    email,
  },
});

async function openCorporateDashboard(page) {
  await page.goto("/organizations_dashboard");
  await expect(page.getByRole("heading", { name: "Panel Corporativo", level: 1 })).toBeVisible();
}

async function openClientDashboard(page) {
  await page.goto("/organizations_dashboard");
  await expect(page.getByRole("heading", { name: "Mis Organizaciones", level: 1 })).toBeVisible();
}

async function closeSuccessDialog(page, expectedMessage) {
  const successDialog = page.getByRole("dialog");
  await expect(successDialog).toBeVisible({ timeout: 15_000 });
  await expect(successDialog).toContainText(expectedMessage);
  await page.getByRole("button", { name: /^(OK|Aceptar)$/i }).click();
}

function getPostActionContainer(page, postTitle) {
  const postHeading = page.getByRole("heading", { name: postTitle });
  return postHeading.locator("xpath=ancestor::div[.//button][1]");
}

function buildPostDeleteScenario() {
  const corporateUserId = 4950;
  const clientUserId = 4951;

  return {
    corporateUserId,
    clientUserId,
    postTitle: "Post A Eliminar",
    corporateAuth: buildDashboardAuth({
      id: corporateUserId,
      role: "corporate_client",
      firstName: "E2E",
      lastName: "Corporate",
      email: buildEmail("corp-user"),
    }),
    clientAuth: buildDashboardAuth({
      id: clientUserId,
      role: "client",
      firstName: "E2E",
      lastName: "Client",
      email: buildEmail("client-user"),
    }),
  };
}

async function loginAsCorporate(page, corporateAuth) {
  await setAuthLocalStorage(page, corporateAuth);
  await openCorporateDashboard(page);
}

async function loginAsClient(page, clientAuth) {
  await setAuthLocalStorage(page, clientAuth);
  await openClientDashboard(page);
}

async function createPost(page, postTitle) {
  await page.getByRole("button", { name: "Nuevo Post" }).click();
  await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toBeVisible();

  await page.getByRole("textbox", { name: "Título *" }).fill(postTitle);
  await page.locator("textarea#content").fill("Este post será eliminado");
  await page.getByRole("button", { name: "Crear Post" }).click();

  await closeSuccessDialog(page, "Post creado exitosamente");
  await expect(page.getByRole("heading", { name: "Crear Nuevo Post" })).toHaveCount(0);
  await expect(getPostActionContainer(page, postTitle)).toBeVisible();
}

async function expectClientPostVisibility(page, postTitle, visible) {
  // OrganizationPostsSection root: div > div.mb-6 > div.flex > div > h2
  const announcementsHeading = page.getByRole("heading", { name: "Anuncios de la Organización" });
  const orgPostsSection = announcementsHeading.locator("xpath=ancestor::div[4]");

  await expect(orgPostsSection).toBeVisible();

  if (visible) {
    await expect(orgPostsSection.getByText(postTitle)).toBeVisible();
    return;
  }

  await expect(orgPostsSection.getByText(postTitle)).toHaveCount(0);
}

async function deletePost(page, postTitle) {
  const corporatePostCardToDelete = getPostActionContainer(page, postTitle);
  await expect(corporatePostCardToDelete).toBeVisible();

  await corporatePostCardToDelete.locator("button").click();
  await page.getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByRole("heading", { name: `¿Eliminar post '${postTitle}'?` })).toBeVisible();

  await page.getByRole("button", { name: "Sí, eliminar" }).click();
  await closeSuccessDialog(page, `Post "${postTitle}" eliminado exitosamente`);
  await expect(page.getByRole("heading", { name: postTitle })).toHaveCount(0);
}

test("corporate_client deletes a post and client no longer sees it", { tag: ['@flow:org-posts-management', '@module:organizations', '@priority:P2', '@role:corporate'] }, async ({ page }) => {
  test.setTimeout(60_000);

  const scenario = buildPostDeleteScenario();

  await installOrganizationsDashboardApiMocks(page, {
    userId: scenario.corporateUserId,
    role: "corporate_client",
    startWithOrganizations: true,
    clientUserId: scenario.clientUserId,
    startWithClientMemberships: true,
  });

  await loginAsCorporate(page, scenario.corporateAuth);
  await createPost(page, scenario.postTitle);
  await expect(getPostActionContainer(page, scenario.postTitle)).toBeVisible();

  await loginAsClient(page, scenario.clientAuth);
  await expectClientPostVisibility(page, scenario.postTitle, true);

  await loginAsCorporate(page, scenario.corporateAuth);
  await deletePost(page, scenario.postTitle);
  await expect(page.getByRole("heading", { name: scenario.postTitle })).toHaveCount(0);

  await loginAsClient(page, scenario.clientAuth);
  await expectClientPostVisibility(page, scenario.postTitle, false);
});
