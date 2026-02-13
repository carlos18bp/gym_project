import { mount } from "@vue/test-utils";

import LegalRequestCard from "@/components/legal-requests/LegalRequestCard.vue";

jest.mock("@heroicons/vue/24/outline", () => {
  const IconStub = { name: "IconStub", template: "<span />" };

  return {
    __esModule: true,
    EllipsisVerticalIcon: IconStub,
    PencilIcon: IconStub,
    TrashIcon: IconStub,
  };
});

jest.mock("@heroicons/vue/24/solid", () => ({
  __esModule: true,
  ClockIcon: { name: "ClockIcon", template: "<span />" },
  EyeIcon: { name: "EyeIcon", template: "<span />" },
  CheckCircleIcon: { name: "CheckCircleIcon", template: "<span />" },
  XCircleIcon: { name: "XCircleIcon", template: "<span />" },
}));

const StatusUpdateModalStub = {
  props: ["request"],
  template:
    "<div data-test='status-modal'><button data-test='status-updated' @click=\"$emit('updated', { id: 99 })\">ok</button></div>",
};

const DeleteConfirmModalStub = {
  props: ["request"],
  template:
    "<div data-test='delete-modal'><button data-test='delete-confirm' @click=\"$emit('deleted')\">ok</button></div>",
};

const buildRequest = (overrides = {}) => ({
  id: 1,
  request_number: "REQ-1",
  first_name: "Ana",
  last_name: "Diaz",
  email: "ana@example.com",
  request_type_name: "Consulta",
  discipline_name: "Civil",
  response_count: 2,
  description: "Detalle de solicitud",
  created_at: "2026-02-10T12:00:00.000Z",
  status: "PENDING",
  ...overrides,
});

describe("LegalRequestCard.vue", () => {
  test("renders request details for client role", () => {
    const wrapper = mount(LegalRequestCard, {
      props: {
        request: buildRequest(),
      },
    });

    expect(wrapper.text()).toContain("REQ-1");
    expect(wrapper.text()).toContain("Ana Diaz");
    expect(wrapper.text()).toContain("ana@example.com");
    expect(wrapper.text()).toContain("Consulta");
    expect(wrapper.text()).toContain("Civil");
    expect(wrapper.text()).toContain("2");
    expect(wrapper.text()).toContain("Detalle de solicitud");
  });

  test("lawyer actions open status modal and emit status-updated", async () => {
    const wrapper = mount(LegalRequestCard, {
      props: {
        request: buildRequest({ id: 12 }),
        userRole: "lawyer",
      },
      global: {
        stubs: {
          StatusUpdateModal: StatusUpdateModalStub,
          DeleteConfirmModal: DeleteConfirmModalStub,
        },
      },
    });

    wrapper.vm.showActions = true;
    await wrapper.vm.$nextTick();

    const statusButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Cambiar Estado"));

    expect(statusButton).toBeTruthy();

    await statusButton.trigger("click");

    expect(wrapper.find("[data-test='status-modal']").exists()).toBe(true);

    await wrapper.find("[data-test='status-updated']").trigger("click");

    expect(wrapper.emitted("status-updated")).toBeTruthy();
    expect(wrapper.emitted("status-updated")[0]).toEqual([{ id: 99 }]);
    expect(wrapper.find("[data-test='status-modal']").exists()).toBe(false);
  });

  test("lawyer actions open delete modal and emit deleted", async () => {
    const wrapper = mount(LegalRequestCard, {
      props: {
        request: buildRequest({ id: 44 }),
        userRole: "lawyer",
      },
      global: {
        stubs: {
          StatusUpdateModal: StatusUpdateModalStub,
          DeleteConfirmModal: DeleteConfirmModalStub,
        },
      },
    });

    wrapper.vm.showActions = true;
    await wrapper.vm.$nextTick();

    const deleteButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Eliminar"));

    expect(deleteButton).toBeTruthy();

    await deleteButton.trigger("click");

    expect(wrapper.find("[data-test='delete-modal']").exists()).toBe(true);

    await wrapper.find("[data-test='delete-confirm']").trigger("click");

    expect(wrapper.emitted("deleted")).toBeTruthy();
    expect(wrapper.emitted("deleted")[0]).toEqual([44]);
    expect(wrapper.find("[data-test='delete-modal']").exists()).toBe(false);
  });
});
