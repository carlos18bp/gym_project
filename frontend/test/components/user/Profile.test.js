import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import { useUserStore } from "@/stores/auth/user";
import { useAuthStore } from "@/stores/auth/auth";

import Profile from "@/components/user/Profile.vue";
import { gsap } from "gsap";

jest.mock("gsap", () => ({
  __esModule: true,
  gsap: {
    fromTo: jest.fn(),
    to: jest.fn((_, opts) => {
      if (opts && typeof opts.onComplete === "function") {
        opts.onComplete();
      }
    }),
  },
}));

const mockShowNotification = jest.fn();

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

const mockGoogleLogout = jest.fn();

jest.mock("vue3-google-login", () => ({
  __esModule: true,
  googleLogout: () => mockGoogleLogout(),
}));

const mockRouterPush = jest.fn();

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

const flushPromises = async () => {
  // Avoid setTimeout-based flushing because tests may use fake timers.
  await Promise.resolve();
};

const findButtonByText = (wrapper, text) => {
  const btn = wrapper
    .findAll("button")
    .find((b) => (b.text() || "").trim().includes(text));
  if (!btn) {
    throw new Error(`Button not found: ${text}`);
  }
  return btn;
};

describe("Profile.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();

    if (!global.URL) {
      global.URL = {};
    }
    if (!global.URL.createObjectURL) {
      global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
    } else {
      jest.spyOn(global.URL, "createObjectURL").mockImplementation(() => "blob:mock-url");
    }

    jest.useRealTimers();
  });

  const mountProfile = ({ currentUserOverrides = {}, currentUser: currentUserArg, props = {} } = {}) => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const authStore = useAuthStore();

    jest.spyOn(userStore, "getUserInfo").mockResolvedValue({ has_signature: true });
    jest.spyOn(userStore, "updateUser").mockResolvedValue();
    jest.spyOn(authStore, "logout").mockImplementation(() => {});

    const currentUser =
      currentUserArg ||
      {
        id: 1,
        first_name: "Test",
        last_name: "User",
        role: "client",
        email: "test@example.com",
        contact: "",
        birthday: "",
        identification: "",
        document_type: "",
        photo_profile: "",
        is_profile_completed: true,
        has_signature: false,
        ...currentUserOverrides,
      };

    const wrapper = mount(Profile, {
      props: {
        visible: true,
        currentUser,
        ...props,
      },
      global: {
        plugins: [pinia],
        stubs: {
          ModalTransition: {
            template: "<div data-test='modal-transition'><slot /></div>",
          },
          ElectronicSignature: {
            props: ["userId", "initialShowOptions"],
            template:
              "<div data-test='electronic-signature' :data-initial-show-options='String(initialShowOptions)'><button data-test='emit-save' @click=\"$emit('signatureSaved', { traceabilityData: { method: 'upload', date: '2026-01-01T00:00:00Z' } })\">emit-save</button></div>",
          },
        },
      },
    });

    return { wrapper, userStore, authStore, currentUser };
  };

  test("opens electronic signature modal when clicking 'Firma electrónica'", async () => {
    const { wrapper } = mountProfile();

    expect(wrapper.text()).toContain("Firma electrónica");

    await findButtonByText(wrapper, "Firma electrónica").trigger("click");

    expect(wrapper.text()).toContain("Firma Electrónica");
  });

  test("handles signatureSaved: shows notification, closes modal after timeout, and shows green indicator", async () => {
    jest.useFakeTimers();

    const { wrapper, userStore, currentUser } = mountProfile({
      currentUserOverrides: { has_signature: false },
    });

    expect(currentUser.has_signature).toBe(false);
    expect(wrapper.find(".bg-green-500").exists()).toBe(false);

    await findButtonByText(wrapper, "Firma electrónica").trigger("click");
    expect(wrapper.text()).toContain("Firma Electrónica");

    await wrapper.find("[data-test='emit-save']").trigger("click");
    await flushPromises();

    expect(userStore.getUserInfo).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Firma electrónica guardada correctamente",
      "success"
    );

    jest.advanceTimersByTime(500);
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).not.toContain("Firma Electrónica");

    // Indicator should be visible after signature is saved
    expect(currentUser.has_signature).toBe(true);
    expect(wrapper.find(".bg-green-500").exists()).toBe(true);

    jest.useRealTimers();
  });

  test("initializes has_signature to false when undefined", async () => {
    const currentUser = {
      id: 1,
      first_name: "Test",
      last_name: "User",
      role: "client",
      email: "test@example.com",
      contact: "",
      birthday: "",
      identification: "",
      document_type: "",
      photo_profile: "",
      is_profile_completed: true,
    };

    const { currentUser: mountedUser } = mountProfile({ currentUser });
    expect(mountedUser.has_signature).toBe(false);
  });

  test("openSignatureModal calls getUserInfo when has_signature is missing and opens modal", async () => {
    const { wrapper, userStore, currentUser } = mountProfile({
      currentUserOverrides: { has_signature: false },
    });

    delete currentUser.has_signature;
    userStore.getUserInfo.mockResolvedValueOnce({ has_signature: true });

    await findButtonByText(wrapper, "Firma electrónica").trigger("click");
    await flushPromises();

    expect(userStore.getUserInfo).toHaveBeenCalled();
    expect(wrapper.text()).toContain("Firma Electrónica");
    expect(wrapper.find("[data-test='electronic-signature']").exists()).toBe(true);
    expect(
      wrapper.find("[data-test='electronic-signature']").attributes("data-initial-show-options")
    ).toBe("false");
  });

  test("triggerFileInput clicks hidden file input", async () => {
    const { wrapper } = mountProfile();
    const input = wrapper.find("input[type='file']");
    expect(input.exists()).toBe(true);

    input.element.click = jest.fn();
    await findButtonByText(wrapper, "Cambiar").trigger("click");
    expect(input.element.click).toHaveBeenCalled();
  });

  test("handleFileChange sets photo_profile and preview URL", async () => {
    const { wrapper, currentUser } = mountProfile();
    const input = wrapper.find("input[type='file']");
    const file = new File(["img"], "avatar.png", { type: "image/png" });

    Object.defineProperty(input.element, "files", {
      value: [file],
      writable: false,
    });
    await input.trigger("change");
    expect(currentUser.photo_profile).toBe(file);
    expect(currentUser.photo_profile_preview).toBe("blob:mock-url");
  });

  test.each([
    ["email", "", "¡Email es requerido!"],
    ["first_name", "", "¡El nombre es requerido!"],
    ["last_name", "", "¡El apellido es requerido!"],
    ["contact", "", "¡Un número de contacto es requerido!"],
    ["birthday", "", "¡Una fecha de nacimiento es requerida!"],
    ["identification", "", "¡Número de cédula es requerido!"],
    ["document_type", "", "¡El tipo de documento es requerido!"],
  ])("updateUserProfile validates required field: %s", async (field, value, msg) => {
    const overrides = {
      email: "test@example.com",
      first_name: "Test",
      last_name: "User",
      contact: "123",
      birthday: "2000-01-01",
      identification: "999",
      document_type: "CC",
      [field]: value,
    };

    const { wrapper, userStore } = mountProfile({ currentUserOverrides: overrides });
    await wrapper.vm.updateUserProfile();

    expect(mockShowNotification).toHaveBeenCalledWith(msg, "warning");
    expect(userStore.updateUser).not.toHaveBeenCalled();
  });

  test("updateUserProfile success updates user, normalizes photo_profile and marks completed", async () => {
    const file = new File(["img"], "avatar.png", { type: "image/png" });
    const { wrapper, userStore, currentUser } = mountProfile({
      currentUserOverrides: {
        email: "test@example.com",
        first_name: "Test",
        last_name: "User",
        contact: "123",
        birthday: "2000-01-01",
        identification: "999",
        document_type: "CC",
        is_profile_completed: false,
        photo_profile: file,
        photo_profile_preview: "blob:mock-url",
      },
    });

    gsap.to.mockClear();
    await wrapper.vm.updateUserProfile();

    expect(userStore.updateUser).toHaveBeenCalledWith(currentUser);
    expect(currentUser.photo_profile).toBe("blob:mock-url");
    expect(currentUser.is_profile_completed).toBe(true);

    expect(gsap.to).toHaveBeenCalledWith(["#viewProfileModal", "#editProfileModal"], {
      x: "0%",
      duration: 0.5,
    });
  });

  test("closeModal emits update:visible false after gsap.to completes", async () => {
    const { wrapper } = mountProfile();
    await wrapper.vm.closeModal();
    expect(wrapper.emitted("update:visible")).toBeTruthy();
    expect(wrapper.emitted("update:visible")[0]).toEqual([false]);
  });

  test("visible watcher triggers gsap.fromTo when opening", async () => {
    const { wrapper } = mountProfile({ props: { visible: false } });
    expect(gsap.fromTo).not.toHaveBeenCalled();

    await wrapper.setProps({ visible: true });
    await flushPromises();

    expect(gsap.fromTo).toHaveBeenCalled();
  });

  test("goToEditProfile animates view and edit modals to the left", async () => {
    const { wrapper } = mountProfile({
      currentUserOverrides: { is_profile_completed: true },
    });

    gsap.to.mockClear();
    await findButtonByText(wrapper, "Editar").trigger("click");

    expect(gsap.to).toHaveBeenCalledWith(["#viewProfileModal", "#editProfileModal"], {
      x: "-100%",
      duration: 0.5,
    });
  });

  test("logOut calls auth logout, googleLogout and router push", async () => {
    const { wrapper, authStore } = mountProfile();
    const logoutSpy = jest.spyOn(authStore, "logout").mockImplementation(() => {});

    await findButtonByText(wrapper, "Cerrar sesión").trigger("click");
    expect(logoutSpy).toHaveBeenCalled();
    expect(mockGoogleLogout).toHaveBeenCalled();
    expect(mockRouterPush).toHaveBeenCalledWith({ name: "sign_in" });
  });
});
