// quality: disable fragile_test_data (emails are mock credentials used only for API route interception, not real production data)
import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installServiceTramiteApiMocks,
  buildMockServiceRequest,
  buildMockServiceRequestAnswer,
} from "../helpers/serviceTramiteMocks.js";

const LAWYER_ID = 8100;

test(
  "lawyer can view inbox with submitted requests",
  {
    tag: [
      "@flow:service-inbox-view",
      "@module:services",
      "@priority:P1",
      "@role:lawyer",
    ],
  },
  async ({ page }) => {
    const requests = [
      buildMockServiceRequest({
        id: 1,
        tracking_number: "2026-00010",
        status: "OPEN",
        status_display: "Abierto",
        requester_name: "Cliente Uno",
      }),
      buildMockServiceRequest({
        id: 2,
        tracking_number: "2026-00011",
        status: "IN_STUDY",
        status_display: "En Estudio",
        requester_name: "Cliente Dos",
      }),
    ];

    await installServiceTramiteApiMocks(page, {
      userId: LAWYER_ID,
      role: "lawyer",
      requests,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: LAWYER_ID,
        role: "lawyer",
        first_name: "Lawyer",
        last_name: "E2E",
        email: "lawyer@example.com",
        is_profile_completed: true,
        is_gym_lawyer: true,
      },
    });

    await page.goto("/service_requests/inbox");
    await expect(page.getByText("2026-00010")).toBeVisible();
    await expect(page.getByText("2026-00011")).toBeVisible();
  }
);

test(
  "lawyer can manage request and change status",
  {
    tag: [
      "@flow:service-manage-request",
      "@module:services",
      "@priority:P1",
      "@role:lawyer",
    ],
  },
  async ({ page }) => {
    const detail = buildMockServiceRequest({
      id: 50,
      tracking_number: "2026-00050",
      status: "OPEN",
      status_display: "Abierto",
      requester_name: "Cliente Test",
      document_url: "/api/service-requests/50/document/download/",
      answers: [
        buildMockServiceRequestAnswer({
          field_key: "nombre",
          field_label: "Nombre completo",
          value_text: "Maria Garcia",
          stage_title: "Datos",
          stage_order: 1,
        }),
      ],
    });

    await installServiceTramiteApiMocks(page, {
      userId: LAWYER_ID,
      role: "lawyer",
      requests: [detail],
      requestDetail: detail,
    });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: {
        id: LAWYER_ID,
        role: "lawyer",
        first_name: "Lawyer",
        last_name: "E2E",
        email: "lawyer@example.com",
        is_profile_completed: true,
        is_gym_lawyer: true,
      },
    });

    await page.goto(`/service_requests/${detail.id}`);

    // Should see request detail
    await expect(page.getByText("2026-00050")).toBeVisible();
    await expect(page.getByText("Maria Garcia")).toBeVisible();

    // Should see management panel (lawyer only)
    await expect(page.getByText("Gestionar solicitud")).toBeVisible();

    // Change status
    // quality: allow-fragile-selector (single status select in this view; positional first() is deterministic)
    const statusSelect = page.locator("select").first();
    await statusSelect.selectOption("IN_STUDY");

    const messageField = page.locator("textarea");
    await messageField.fill("Iniciando revision del caso");
  }
);
