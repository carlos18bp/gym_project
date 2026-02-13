import { mount } from "@vue/test-utils";

import StatusUpdateModal from "@/components/legal-requests/lawyer-only/StatusUpdateModal.vue";

const mockUpdateRequestStatus = jest.fn();
let mockLegalStore;

jest.mock("@/stores/legal/legal_requests_management.js", () => ({
  __esModule: true,
  useLegalRequestsStore: () => mockLegalStore,
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  XMarkIcon: { template: "<span />" },
}));

const StatusBadgeStub = {
  name: "StatusBadge",
  props: ["status"],
  template: "<div data-test='status-badge'>{{ status }}</div>",
};

const buildRequest = (overrides = {}) => ({
  id: 1,
  request_number: "REQ-1",
  first_name: "Ana",
  last_name: "Diaz",
  status: "PENDING",
  ...overrides,
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("StatusUpdateModal.vue", () => {
  beforeEach(() => {
    mockUpdateRequestStatus.mockReset();
    mockLegalStore = {
      updateRequestStatus: mockUpdateRequestStatus,
    };
  });

  test("disables update button until status changes", async () => {
    const wrapper = mount(StatusUpdateModal, {
      props: {
        request: buildRequest(),
      },
      global: {
        stubs: {
          StatusBadge: StatusBadgeStub,
        },
      },
    });

    const updateButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Actualizar"));

    expect(updateButton.attributes("disabled")).toBeDefined();

    await wrapper.find("select").setValue("PENDING");

    expect(updateButton.attributes("disabled")).toBeDefined();

    await wrapper.find("select").setValue("RESPONDED");

    expect(updateButton.attributes("disabled")).toBeUndefined();
  });

  test("updates status and emits updated", async () => {
    const updatedRequest = buildRequest({ status: "RESPONDED" });
    mockUpdateRequestStatus.mockResolvedValue(updatedRequest);

    const wrapper = mount(StatusUpdateModal, {
      props: {
        request: buildRequest(),
      },
      global: {
        stubs: {
          StatusBadge: StatusBadgeStub,
        },
      },
    });

    await wrapper.find("select").setValue("RESPONDED");

    const updateButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Actualizar"));

    await updateButton.trigger("click");
    await flushPromises();

    expect(mockUpdateRequestStatus).toHaveBeenCalledWith(1, "RESPONDED");
    expect(wrapper.emitted("updated")).toBeTruthy();
    expect(wrapper.emitted("updated")[0]).toEqual([updatedRequest]);
  });

  test("logs error when update fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockUpdateRequestStatus.mockRejectedValue(new Error("Boom"));

    const wrapper = mount(StatusUpdateModal, {
      props: {
        request: buildRequest(),
      },
      global: {
        stubs: {
          StatusBadge: StatusBadgeStub,
        },
      },
    });

    await wrapper.find("select").setValue("RESPONDED");

    const updateButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Actualizar"));

    await updateButton.trigger("click");
    await flushPromises();

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error updating status:",
      expect.any(Error)
    );
    expect(wrapper.emitted("updated")).toBeFalsy();

    consoleSpy.mockRestore();
  });
});
