import { shallowMount } from "@vue/test-utils";

import UserWelcomeCard from "@/components/dashboard/UserWelcomeCard.vue";

const mockProcessInit = jest.fn();
const mockUpdateUser = jest.fn();
const mockGetUserInfo = jest.fn();
const mockShowNotification = jest.fn();

let mockActiveProcesses = [];

jest.mock("@/stores/process", () => ({
  __esModule: true,
  useProcessStore: () => ({
    init: (...args) => mockProcessInit(...args),
    activeProcessesForCurrentUser: mockActiveProcesses,
  }),
}));

jest.mock("@/stores/auth/user", () => ({
  __esModule: true,
  useUserStore: () => ({
    updateUser: (...args) => mockUpdateUser(...args),
    getUserInfo: (...args) => mockGetUserInfo(...args),
  }),
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

const flushPromises = async () => {
  await Promise.resolve();
};

const mountView = (props = {}) =>
  shallowMount(UserWelcomeCard, {
    props,
    global: {
      stubs: {
        CalendarDaysIcon: { template: "<div />" },
        RectangleStackIcon: { template: "<div />" },
        PencilIcon: { template: "<div />" },
      },
    },
  });

describe("UserWelcomeCard.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActiveProcesses = [];
    mockProcessInit.mockResolvedValue();
    mockUpdateUser.mockResolvedValue();
    mockGetUserInfo.mockResolvedValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("renders a random welcome message with membership date and active processes", async () => {
    mockActiveProcesses = [{}, {}, {}];
    const mathSpy = jest.spyOn(Math, "random").mockReturnValue(0.7);

    const wrapper = mountView({
      user: {
        id: 1,
        first_name: "Ana",
        created_at: "2024-01-02T00:00:00Z",
      },
    });

    await flushPromises();

    expect(mockProcessInit).toHaveBeenCalled();
    expect(wrapper.text()).toContain("Proyecto en marcha");
    expect(wrapper.text()).toContain("Ana");
    expect(wrapper.text()).toContain("2024");
    expect(wrapper.text()).toContain("3");

    mathSpy.mockRestore();
  });

  test("uses time-based greeting when random threshold is met", async () => {
    const mathSpy = jest.spyOn(Math, "random").mockReturnValue(0.5);
    const hoursSpy = jest.spyOn(Date.prototype, "getHours").mockReturnValue(9);

    const wrapper = mountView({
      user: {
        id: 2,
        first_name: "Luis",
        created_at: "2024-02-10T00:00:00Z",
      },
    });

    await flushPromises();

    expect(wrapper.text()).toContain("Buenos días");
    expect(wrapper.text()).toContain("Luis");

    mathSpy.mockRestore();
    hoursSpy.mockRestore();
  });

  test("updates profile photo and notifies on success", async () => {
    jest.useFakeTimers();

    if (!URL.createObjectURL) {
      Object.defineProperty(URL, "createObjectURL", {
        value: jest.fn(),
        writable: true,
      });
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, "revokeObjectURL", {
        value: jest.fn(),
        writable: true,
      });
    }

    const createUrlSpy = jest
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:preview");
    const revokeUrlSpy = jest
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => {});

    mockUpdateUser.mockResolvedValue(200);
    mockGetUserInfo.mockResolvedValue({ photo_profile: "server-photo" });

    const user = {
      id: 3,
      first_name: "Maria",
      created_at: "2024-01-10T00:00:00Z",
      photo_profile: "old-photo",
    };

    const wrapper = mountView({ user });

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    await wrapper.vm.$.setupState.handleFileChange({
      target: { files: [file] },
    });

    await flushPromises();
    jest.runAllTimers();

    expect(createUrlSpy).toHaveBeenCalledWith(file);
    expect(mockUpdateUser).toHaveBeenCalledWith(
      expect.objectContaining({ photo_profile: file })
    );
    expect(mockGetUserInfo).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Foto de perfil actualizada correctamente",
      "success"
    );
    expect(user.photo_profile).toBe("server-photo");
    expect(revokeUrlSpy).toHaveBeenCalledWith("blob:preview");

    createUrlSpy.mockRestore();
    revokeUrlSpy.mockRestore();
  });

  test("shows error notification when photo update fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockUpdateUser.mockRejectedValue(new Error("fail"));

    const wrapper = mountView({
      user: {
        id: 4,
        first_name: "Nora",
        created_at: "2024-03-10T00:00:00Z",
      },
    });

    const file = new File(["avatar"], "avatar.png", { type: "image/png" });

    await wrapper.vm.$.setupState.handleFileChange({
      target: { files: [file] },
    });

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al actualizar la foto de perfil",
      "error"
    );
    expect(mockGetUserInfo).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
