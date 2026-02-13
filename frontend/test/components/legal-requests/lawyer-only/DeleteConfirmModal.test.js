import { mount } from "@vue/test-utils";

import DeleteConfirmModal from "@/components/legal-requests/lawyer-only/DeleteConfirmModal.vue";

const mockDeleteRequest = jest.fn();
const mockRouterReplace = jest.fn();
let mockLegalStore;

jest.mock("@/stores/legal/legal_requests_management.js", () => ({
  __esModule: true,
  useLegalRequestsStore: () => mockLegalStore,
}));

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    replace: mockRouterReplace,
  }),
}));

jest.mock("@heroicons/vue/24/outline", () => ({
  __esModule: true,
  XMarkIcon: { template: "<span />" },
  ExclamationTriangleIcon: { template: "<span />" },
}));

const buildRequest = (overrides = {}) => ({
  id: 1,
  request_number: "REQ-1",
  first_name: "Ana",
  last_name: "Diaz",
  email: "ana@example.com",
  ...overrides,
});

describe("DeleteConfirmModal.vue", () => {
  beforeEach(() => {
    mockDeleteRequest.mockReset();
    mockRouterReplace.mockReset();
    mockLegalStore = {
      deleteRequest: mockDeleteRequest,
    };
  });

  test("shows validation message when confirmation text is invalid", async () => {
    const wrapper = mount(DeleteConfirmModal, {
      props: { request: buildRequest() },
    });

    await wrapper.find("input").setValue("no");

    expect(wrapper.text()).toContain("Debes escribir exactamente \"eliminar\"");
    expect(mockDeleteRequest).not.toHaveBeenCalled();
  });

  test("deletes request, emits events, and navigates", async () => {
    jest.useFakeTimers();
    mockDeleteRequest.mockResolvedValue();

    const wrapper = mount(DeleteConfirmModal, {
      props: { request: buildRequest({ id: 9 }) },
    });

    await wrapper.find("input").setValue("eliminar");

    const deleteButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Eliminar Solicitud"));

    await deleteButton.trigger("click");
    await Promise.resolve();

    expect(mockDeleteRequest).toHaveBeenCalledWith(9);
    expect(wrapper.emitted("deleted")).toBeTruthy();
    expect(wrapper.emitted("close")).toBeTruthy();

    jest.runAllTimers();

    expect(mockRouterReplace).toHaveBeenCalledWith({ name: "legal_requests_list" });

    jest.useRealTimers();
  });

  test("handleEnterKey triggers delete when confirmation is valid", async () => {
    mockDeleteRequest.mockResolvedValue();

    const wrapper = mount(DeleteConfirmModal, {
      props: { request: buildRequest({ id: 3 }) },
    });

    await wrapper.find("input").setValue("eliminar");
    await wrapper.find("input").trigger("keyup.enter");
    await Promise.resolve();

    expect(mockDeleteRequest).toHaveBeenCalledWith(3);
  });

  test("shows error message when delete fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockDeleteRequest.mockRejectedValue(new Error("Boom"));

    const wrapper = mount(DeleteConfirmModal, {
      props: { request: buildRequest({ id: 7 }) },
    });

    await wrapper.find("input").setValue("eliminar");

    const deleteButton = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Eliminar Solicitud"));

    await deleteButton.trigger("click");
    await Promise.resolve();

    expect(consoleSpy).toHaveBeenCalled();
    expect(wrapper.text()).toContain("Boom");

    consoleSpy.mockRestore();
  });
});
