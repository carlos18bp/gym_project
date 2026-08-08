import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installCalendlyWidgetStub,
  installScheduleAppointmentApiMocks,
} from "../helpers/scheduleAppointmentMocks.js";

/**
 * E2E — "Agendar Cita".
 *
 * The Calendly embed is the whole feature, so both tests drive the sidebar
 * entry that mounts it and assert the widget only exists after that click.
 * The booking URL is currently the same for every role (see the note in the
 * client test), so the two tests differ in the role that reaches it.
 */

test("lawyer opens Agendar Cita from the sidebar and the Calendly widget loads", { tag: ['@flow:schedule-appointment', '@module:schedule', '@priority:P2', '@role:client'] }, async ({ page }) => {
  const userId = 1800;

  await installCalendlyWidgetStub(page);
  await installScheduleAppointmentApiMocks(page, { userId, role: "lawyer" });

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
  await page.getByText("Agendar Cita").first().waitFor({ timeout: 15_000 });

  // quality: allow-fragile-selector (class selector targets stable UI structure)
  await expect(page.locator(".calendly-inline-widget")).toHaveCount(0);

  await page.getByText("Agendar Cita").first().click();

  await expect(page).toHaveURL(/\/schedule_appointment$/, { timeout: 15_000 });

  const widget = page.locator(".calendly-inline-widget"); // quality: allow-fragile-selector (class selector targets stable UI structure)
  await expect(widget).toBeVisible({ timeout: 10_000 });
  await expect(widget).toHaveAttribute("data-url", /calendly\.com\/infogym\/cita-abogado/);

  // Assert our stub ran
  await expect(widget).toHaveAttribute("data-e2e-calendly", "loaded");
  await expect(page.locator("[data-e2e-calendly-banner]")).toBeVisible();
});

test("client opens Agendar Cita from the sidebar and gets the same booking URL", { tag: ['@flow:schedule-appointment', '@module:schedule', '@priority:P2', '@role:client'] }, async ({ page }) => {
  const userId = 1801;

  await installCalendlyWidgetStub(page);
  await installScheduleAppointmentApiMocks(page, { userId, role: "client" });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "client",
      is_profile_completed: true,
    },
  });

  await page.goto("/dashboard");
  await page.getByText("Agendar Cita").first().waitFor({ timeout: 15_000 });

  await page.getByText("Agendar Cita").first().click();

  await expect(page).toHaveURL(/\/schedule_appointment$/, { timeout: 15_000 });

  const widget = page.locator(".calendly-inline-widget"); // quality: allow-fragile-selector (class selector targets stable UI structure)
  await expect(widget).toBeVisible({ timeout: 10_000 });
  // The embed URL is hardcoded in ScheduleAppointment.vue — clients book on the
  // very same "cita-abogado" calendar as lawyers, there is no per-role URL.
  await expect(widget).toHaveAttribute("data-url", /calendly\.com\/infogym\/cita-abogado/);
  await expect(widget).toHaveAttribute("data-e2e-calendly", "loaded");
});
