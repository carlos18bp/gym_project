import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installCalendlyWidgetStub,
  installScheduleAppointmentApiMocks,
} from "../helpers/scheduleAppointmentMocks.js";

test("schedule appointment loads Calendly widget", { tag: ['@flow:schedule-appointment', '@module:schedule', '@priority:P2', '@role:client'] }, async ({ page }) => {
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

  await page.goto("/schedule_appointment");

  const widget = page.locator(".calendly-inline-widget"); // quality: allow-fragile-selector (class selector targets stable UI structure)
  await expect(widget).toBeVisible();
  await expect(widget).toHaveAttribute("data-url", /calendly\.com\/infogym\/cita-abogado/);

  // Assert our stub ran
  await expect(widget).toHaveAttribute("data-e2e-calendly", "loaded");
  await expect(page.locator("[data-e2e-calendly-banner]")).toBeVisible();
});

test("client schedule appointment loads Calendly widget with client URL", { tag: ['@flow:schedule-appointment', '@module:schedule', '@priority:P2', '@role:client'] }, async ({ page }) => {
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

  await page.goto("/schedule_appointment");

  const widget = page.locator(".calendly-inline-widget"); // quality: allow-fragile-selector (class selector targets stable UI structure)
  await expect(widget).toBeVisible();
  await expect(widget).toHaveAttribute("data-url", /calendly\.com/);
  await expect(widget).toHaveAttribute("data-e2e-calendly", "loaded");
});
