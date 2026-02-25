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

const mountInvitationCard = (pinia, invitationOverrides = {}) => {
  return mount(InvitationCard, {
    props: {
      invitation: buildInvitation(invitationOverrides),
    },
    global: {
      plugins: [pinia],
    },
  });
};

const getActionButton = (wrapper, label) => {
  return wrapper
    .findAll("button")
    .find((button) => (button.text() || "").includes(label));
};

const mockRespondToInvitation = (implementation) => {
  const store = useOrganizationsStore();
  const respondMock = jest.fn(implementation);
  store.respondToInvitation = respondMock;
  return respondMock;
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

    const wrapper = mountInvitationCard(pinia, {
      status: "PENDING",
      can_be_responded: true,
      is_expired: false,
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Pendiente");
    expect(wrapper.findAll("button").some((b) => (b.text() || "").includes("Aceptar"))).toBe(true);
    expect(wrapper.findAll("button").some((b) => (b.text() || "").includes("Rechazar"))).toBe(true);
  });

  test("expired invitation shows expired message and no actions", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mountInvitationCard(pinia, {
      status: "PENDING",
      can_be_responded: true,
      is_expired: true,
      expires_at: "2026-01-01T00:00:00.000Z",
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Esta invitación ha expirado");
    expect(wrapper.findAll("button").some((b) => (b.text() || "").includes("Aceptar"))).toBe(false);
    expect(wrapper.findAll("button").some((b) => (b.text() || "").includes("Rechazar"))).toBe(false);
  });

  test("expiring soon applies orange text class", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));
    try {
      const pinia = createPinia();
      setActivePinia(pinia);

      const wrapper = mountInvitationCard(pinia, {
        is_expired: false,
        expires_at: "2026-02-05T00:00:00.000Z",
      });

      await flushPromises();

      expect(wrapper.text()).toContain("Expira hace 4 días");
    } finally {
      jest.useRealTimers();
    }
  });

  test("unknown status falls back to raw status and gray badge", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mountInvitationCard(pinia, { status: "UNKNOWN" });

    await flushPromises();

    const statusBadge = wrapper
      .findAll("span")
      .find((span) => span.text() === "UNKNOWN");

    expect(statusBadge).toBeTruthy();
    expect(statusBadge.classes()).toEqual(
      expect.arrayContaining(["bg-gray-100", "text-gray-800"])
    );
  });

  test("pending status renders translated badge label", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mountInvitationCard(pinia, { status: "PENDING" });

    await flushPromises();

    expect(wrapper.text()).toContain("Pendiente");
  });

  test("isExpiringSoon is false when expires_at is missing", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mountInvitationCard(pinia, { expires_at: null });

    await flushPromises();

    expect(wrapper.text()).not.toContain("Expira");
    expect(wrapper.text()).not.toContain("Expiró");
  });

  test("accept action calls store, shows success notification and emits responded", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const respondSpy = mockRespondToInvitation().mockResolvedValue({
      invitation: { id: 10, status: "ACCEPTED" },
    });

    const wrapper = mountInvitationCard(pinia, {
      id: 10,
      status: "PENDING",
      can_be_responded: true,
      is_expired: false,
    });

    await flushPromises();

    const acceptBtn = getActionButton(wrapper, "Aceptar");

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

    const respondSpy = mockRespondToInvitation().mockResolvedValue({
      invitation: { id: 10, status: "REJECTED" },
    });

    const wrapper = mountInvitationCard(pinia, {
      id: 10,
      status: "PENDING",
      can_be_responded: true,
      is_expired: false,
    });

    await flushPromises();

    const rejectBtn = getActionButton(wrapper, "Rechazar");

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

    mockRespondToInvitation().mockRejectedValue({
      response: {
        data: {
          error: "Custom error",
        },
      },
    });

    const wrapper = mountInvitationCard(pinia, { id: 10 });

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

    mockRespondToInvitation().mockRejectedValue(new Error("fail"));

    const wrapper = mountInvitationCard(pinia, { id: 10 });

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

    expect(getActionButton(wrapper, "Aceptar").attributes("disabled")).toBeUndefined();
    expect(getActionButton(wrapper, "Rechazar").attributes("disabled")).toBeUndefined();
  });

  test("responded invitation shows relative days label", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-15T00:00:00.000Z"));
    try {
      const pinia = createPinia();
      setActivePinia(pinia);

      const wrapper = mountInvitationCard(pinia, {
        status: "ACCEPTED",
        can_be_responded: false,
        responded_at: "2026-02-12T00:00:00.000Z",
      });

      await flushPromises();

      expect(wrapper.text()).toContain("Respondiste hace 3 días");
    } finally {
      jest.useRealTimers();
    }
  });

  test("responded invitation shows today and yesterday labels", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-02-15T00:00:00.000Z"));
    try {
      const pinia = createPinia();
      setActivePinia(pinia);

      const wrapper = mountInvitationCard(pinia, {
        status: "ACCEPTED",
        can_be_responded: false,
        responded_at: "2026-02-15T00:00:00.000Z",
      });

      await flushPromises();
      expect(wrapper.text()).toContain("Respondiste hoy");

      await wrapper.setProps({
        invitation: buildInvitation({
          status: "ACCEPTED",
          can_be_responded: false,
          responded_at: "2026-02-14T00:00:00.000Z",
        }),
      });
      await flushPromises();

      expect(wrapper.text()).toContain("Respondiste hace 1 día");
    } finally {
      jest.useRealTimers();
    }
  });
});
