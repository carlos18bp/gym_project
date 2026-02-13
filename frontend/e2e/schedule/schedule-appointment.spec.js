import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installCalendlyWidgetStub,
  installScheduleAppointmentApiMocks,
} from "../helpers/scheduleAppointmentMocks.js";

test("schedule appointment loads Calendly widget", async ({ page }) => {
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

  const widget = page.locator(".calendly-inline-widget");
  await expect(widget).toBeVisible();
  await expect(widget).toHaveAttribute("data-url", /calendly\.com\/infogym\/cita-abogado/);

  // Assert our stub ran
  await expect(widget).toHaveAttribute("data-e2e-calendly", "loaded");
  await expect(page.locator("[data-e2e-calendly-banner]")).toBeVisible();
});
