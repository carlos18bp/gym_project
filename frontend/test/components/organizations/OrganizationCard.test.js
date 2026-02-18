import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useOrganizationsStore } from "@/stores/organizations";

import OrganizationCard from "@/components/organizations/client/cards/OrganizationCard.vue";

const mockShowNotification = jest.fn();

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@heroicons/vue/24/outline", () => {
  const IconStub = {
    name: "IconStub",
    template: "<span />",
  };

  return {
    __esModule: true,
    UsersIcon: IconStub,
    CalendarIcon: IconStub,
    CheckIcon: IconStub,
    PlusIcon: IconStub,
    EyeIcon: IconStub,
    ArrowLeftOnRectangleIcon: IconStub,
  };
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const ConfirmationModalStub = {
  name: "ConfirmationModal",
  props: ["visible", "isLoading", "title", "message"],
  template: `
    <div v-if="visible" data-test="confirm-modal">
      <div data-test="confirm-title">{{ title }}</div>
      <div data-test="confirm-message">{{ message }}</div>
      <button type="button" data-test="confirm" @click="$emit('confirm')">confirm</button>
      <button type="button" data-test="cancel" @click="$emit('cancel')">cancel</button>
    </div>
  `,
};

const buildOrg = (overrides = {}) => {
  return {
    id: 1,
    title: "Acme Corp",
    description: "Desc",
    member_count: 2,
    joined_at: "2026-02-01T00:00:00.000Z",
    profile_image_url: "",
    cover_image_url: "",
    corporate_client_info: {
      full_name: "Corp Owner",
      email: "corp@example.com",
      profile_image_url: "",
    },
    ...overrides,
  };
};

const mountOrganizationCard = async (organizationOverrides = {}) => {
  const pinia = createPinia();
  setActivePinia(pinia);

  const wrapper = mount(OrganizationCard, {
    props: {
      organization: buildOrg(organizationOverrides),
    },
    global: {
      plugins: [pinia],
      stubs: {
        ConfirmationModal: ConfirmationModalStub,
      },
    },
  });

  await flushPromises();

  return wrapper;
};

const openLeaveModal = async (wrapper) => {
  const leaveBtn = wrapper
    .findAll("button")
    .find((b) => (b.text() || "").trim() === "Salir" || (b.text() || "").includes("Salir"));

  if (!leaveBtn) {
    throw new Error("Leave button not found");
  }

  await leaveBtn.trigger("click");
  await flushPromises();
};

describe("OrganizationCard.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  test("emits create-request and view-details with organization id", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(OrganizationCard, {
      props: {
        organization: buildOrg({ id: 10 }),
      },
      global: {
        plugins: [pinia],
        stubs: {
          ConfirmationModal: ConfirmationModalStub,
        },
      },
    });

    await flushPromises();

    const createBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Nueva Solicitud"));

    expect(createBtn).toBeTruthy();
    await createBtn.trigger("click");

    expect(wrapper.emitted("create-request")).toBeTruthy();
    expect(wrapper.emitted("create-request")[0]).toEqual([10]);

    const viewBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Ver Detalles") || (b.text() || "").includes("Detalles"));

    expect(viewBtn).toBeTruthy();
    await viewBtn.trigger("click");

    expect(wrapper.emitted("view-details")).toBeTruthy();
    expect(wrapper.emitted("view-details")[0]).toEqual([10]);
  });

  test("leave flow: opens confirmation and cancel closes", async () => {
    const wrapper = await mountOrganizationCard({ id: 22, title: "Org 22" });

    await openLeaveModal(wrapper);
    const modalExistsAfterOpen = wrapper.find("[data-test='confirm-modal']").exists();

    await wrapper.find("[data-test='cancel']").trigger("click");
    await flushPromises();

    expect([modalExistsAfterOpen, wrapper.find("[data-test='confirm-modal']").exists()]).toEqual([
      true,
      false,
    ]);
  });

  test("leave flow: confirm calls store, notifies, emits left, and closes modal", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useOrganizationsStore();
    const leaveSpy = jest.spyOn(store, "leaveOrganization").mockResolvedValue({ ok: true });

    const wrapper = mount(OrganizationCard, {
      props: {
        organization: buildOrg({ id: 22, title: "Org 22" }),
      },
      global: {
        plugins: [pinia],
        stubs: {
          ConfirmationModal: ConfirmationModalStub,
        },
      },
    });

    await flushPromises();

    await openLeaveModal(wrapper);
    await wrapper.find("[data-test='confirm']").trigger("click");
    await flushPromises();

    expect([
      leaveSpy.mock.calls[0]?.[0],
      mockShowNotification.mock.calls[0],
      wrapper.emitted("left")?.[0],
      wrapper.find("[data-test='confirm-modal']").exists(),
    ]).toEqual([22, ["Has abandonado Org 22", "success"], [22], false]);
  });

  test("leave flow: store error with response.data.error shows error notification and keeps modal open", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    jest.spyOn(store, "leaveOrganization").mockRejectedValue({
      response: {
        data: {
          error: "No puedes salir",
        },
      },
    });

    const wrapper = mount(OrganizationCard, {
      props: {
        organization: buildOrg({ id: 33, title: "Org 33" }),
      },
      global: {
        plugins: [pinia],
        stubs: {
          ConfirmationModal: ConfirmationModalStub,
        },
      },
    });

    await flushPromises();

    const leaveBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Salir"));

    await leaveBtn.trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-test='confirm-modal']").exists()).toBe(true);

    await wrapper.find("[data-test='confirm']").trigger("click");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith("No puedes salir", "error");
    expect(wrapper.find("[data-test='confirm-modal']").exists()).toBe(true);
    expect(wrapper.emitted("left")).toBeFalsy();
  });
});
