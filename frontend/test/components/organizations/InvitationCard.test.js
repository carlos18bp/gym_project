import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useOrganizationsStore } from "@/stores/organizations";

import InvitationCard from "@/components/organizations/client/cards/InvitationCard.vue";

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
    ClockIcon: IconStub,
    CheckIcon: IconStub,
    XMarkIcon: IconStub,
  };
});

const flushPromises = async () => {
  await Promise.resolve();

  const isUsingFakeTimers = () => {
    if (jest.isMockFunction(setTimeout)) return true;
    try {
      jest.getTimerCount();
      return true;
    } catch (error) {
      return false;
    }
  };

  if (isUsingFakeTimers()) {
    jest.runOnlyPendingTimers();
    await Promise.resolve();
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 0));
};

const buildInvitation = (overrides = {}) => {
  return {
    id: 10,
    status: "PENDING",
    can_be_responded: true,
    is_expired: false,
    created_at: "2026-02-01T00:00:00.000Z",
    expires_at: "2026-02-10T00:00:00.000Z",
    responded_at: null,
    message: "Mensaje",
    invited_by_info: {
      full_name: "Corp Owner",
      email: "corp@example.com",
    },
    organization_info: {
      title: "Acme Corp",
      description: "Desc",
      cover_image_url: "",
      profile_image_url: "",
      member_count: 2,
    },
    ...overrides,
  };
};

describe("InvitationCard.vue", () => {
  beforeEach(() => {
    jest.useRealTimers();
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();

    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  test("pending invitation shows accept/reject actions and status badge", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    jest.spyOn(store, "respondToInvitation").mockResolvedValue({
      invitation: { id: 10, status: "ACCEPTED" },
    });

    const wrapper = mount(InvitationCard, {
      props: {
        invitation: buildInvitation({
          status: "PENDING",
          can_be_responded: true,
          is_expired: false,
        }),
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Pendiente");
    expect(wrapper.findAll("button").some((b) => (b.text() || "").includes("Aceptar"))).toBe(true);
    expect(wrapper.findAll("button").some((b) => (b.text() || "").includes("Rechazar"))).toBe(true);
  });

  test("expired invitation shows expired message and no actions", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(InvitationCard, {
      props: {
        invitation: buildInvitation({
          status: "PENDING",
          can_be_responded: true,
          is_expired: true,
          expires_at: "2026-01-01T00:00:00.000Z",
        }),
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Esta invitación ha expirado");
    expect(wrapper.findAll("button").some((b) => (b.text() || "").includes("Aceptar"))).toBe(false);
    expect(wrapper.findAll("button").some((b) => (b.text() || "").includes("Rechazar"))).toBe(false);
  });

  test("expiring soon applies orange text class", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));

    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(InvitationCard, {
      props: {
        invitation: buildInvitation({
          is_expired: false,
          expires_at: "2026-02-05T00:00:00.000Z",
        }),
      },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.find(".text-orange-600").exists()).toBe(true);

    jest.useRealTimers();
  });

  test("unknown status falls back to raw status and gray badge", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(InvitationCard, {
      props: {
        invitation: buildInvitation({ status: "UNKNOWN" }),
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    const statusBadge = wrapper
      .findAll("span")
      .find((span) => span.text() === "UNKNOWN");

    expect(statusBadge).toBeTruthy();
    expect(statusBadge.classes()).toEqual(
      expect.arrayContaining(["bg-gray-100", "text-gray-800"])
    );
  });

  test("getStatusDisplay/getStatusColorClass fall back for unknown status", () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(InvitationCard, {
      props: {
        invitation: buildInvitation({ status: "UNKNOWN" }),
      },
      global: {
        plugins: [pinia],
      },
    });

    const { getStatusDisplay, getStatusColorClass } = wrapper.vm.$.setupState;

    expect(getStatusDisplay("UNKNOWN")).toBe("UNKNOWN");
    expect(getStatusColorClass("UNKNOWN")).toBe("bg-gray-100 text-gray-800");
  });

  test("isExpiringSoon is false when expires_at is missing", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(InvitationCard, {
      props: {
        invitation: buildInvitation({ expires_at: null }),
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    const expiringSoonRef = wrapper.vm.$.setupState.isExpiringSoon;
    expect(expiringSoonRef).toBe(false);
  });

  test("accept action calls store, shows success notification and emits responded", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    const respondSpy = jest.spyOn(store, "respondToInvitation").mockResolvedValue({
      invitation: { id: 10, status: "ACCEPTED" },
    });

    const wrapper = mount(InvitationCard, {
      props: {
        invitation: buildInvitation({
          id: 10,
          status: "PENDING",
          can_be_responded: true,
          is_expired: false,
        }),
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    const acceptBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Aceptar"));

    expect(acceptBtn).toBeTruthy();

    await acceptBtn.trigger("click");
    await flushPromises();

    expect(respondSpy).toHaveBeenCalledWith(10, "accept");
    expect(mockShowNotification).toHaveBeenCalledWith("Invitación aceptada exitosamente", "success");

    expect(wrapper.emitted("responded")).toBeTruthy();
    expect(wrapper.emitted("responded")[0]).toEqual([{ id: 10, status: "ACCEPTED" }]);
  });

  test("reject action calls store, shows success notification and emits responded", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    const respondSpy = jest.spyOn(store, "respondToInvitation").mockResolvedValue({
      invitation: { id: 10, status: "REJECTED" },
    });

    const wrapper = mount(InvitationCard, {
      props: {
        invitation: buildInvitation({
          id: 10,
          status: "PENDING",
          can_be_responded: true,
          is_expired: false,
        }),
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    const rejectBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Rechazar"));

    expect(rejectBtn).toBeTruthy();

    await rejectBtn.trigger("click");
    await flushPromises();

    expect(respondSpy).toHaveBeenCalledWith(10, "reject");
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Invitación rechazada exitosamente",
      "success"
    );

    expect(wrapper.emitted("responded")).toBeTruthy();
    expect(wrapper.emitted("responded")[0]).toEqual([{ id: 10, status: "REJECTED" }]);
  });

  test("error response with message shows error notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    jest.spyOn(store, "respondToInvitation").mockRejectedValue({
      response: {
        data: {
          error: "Custom error",
        },
      },
    });

    const wrapper = mount(InvitationCard, {
      props: {
        invitation: buildInvitation({ id: 10 }),
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    const acceptBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Aceptar"));

    await acceptBtn.trigger("click");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith("Custom error", "error");
  });

  test("generic error shows default error notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationsStore();
    jest.spyOn(store, "respondToInvitation").mockRejectedValue(new Error("fail"));

    const wrapper = mount(InvitationCard, {
      props: {
        invitation: buildInvitation({ id: 10 }),
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    const acceptBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Aceptar"));

    await acceptBtn.trigger("click");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al responder la invitación",
      "error"
    );

    expect(wrapper.vm.$.setupState.isLoading).toBe(false);
    expect(wrapper.vm.$.setupState.actionType).toBe(null);
  });

  test("formatRelativeDate handles days and older dates", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-15T00:00:00.000Z"));

    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(InvitationCard, {
      props: {
        invitation: buildInvitation({ can_be_responded: false, responded_at: null }),
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    const { formatRelativeDate } = wrapper.vm.$.setupState;

    expect(formatRelativeDate("2026-02-12T00:00:00.000Z")).toBe("hace 3 días");
    expect(formatRelativeDate("2026-02-01T00:00:00.000Z")).toBe("hace 2 semanas");

    const olderDate = "2025-12-01T00:00:00.000Z";
    const expectedDate = new Date(olderDate).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    expect(formatRelativeDate(olderDate)).toBe(expectedDate);

    jest.useRealTimers();
  });

  test("formatRelativeDate handles today, yesterday, and weeks", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-15T00:00:00.000Z"));

    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(InvitationCard, {
      props: {
        invitation: buildInvitation({ can_be_responded: false, responded_at: null }),
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();

    const { formatRelativeDate } = wrapper.vm.$.setupState;

    expect(formatRelativeDate("2026-02-15T00:00:00.000Z")).toBe("hoy");
    expect(formatRelativeDate("2026-02-14T00:00:00.000Z")).toBe("hace 1 día");
    expect(formatRelativeDate("2026-02-01T00:00:00.000Z")).toBe("hace 2 semanas");
  });
});
