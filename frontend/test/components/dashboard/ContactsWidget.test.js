import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";

import { useUserStore } from "@/stores/auth/user";

import ContactsWidget from "@/components/dashboard/widgets/ContactsWidget.vue";

const flushPromises = async () => {
  await Promise.resolve();
};

describe("ContactsWidget.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  test("client user sees only lawyers", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({
      users: [
        { id: 1, role: "client", first_name: "C", last_name: "User", email: "c@x.com", photo_profile: null },
        { id: 2, role: "lawyer", first_name: "L", last_name: "One", email: "l1@x.com", photo_profile: null },
        { id: 3, role: "lawyer", first_name: "L", last_name: "Two", email: "l2@x.com", photo_profile: null },
      ],
    });

    jest.spyOn(userStore, "init").mockResolvedValue();

    const wrapper = mount(ContactsWidget, {
      props: {
        user: { id: 1, role: "client" },
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain("L One");
    expect(wrapper.text()).toContain("L Two");
    expect(wrapper.text()).not.toContain("C User");

    const dots = wrapper.findAll("span.bg-blue-500");
    expect(dots.length).toBeGreaterThan(0);
    expect(wrapper.findAll("span.bg-orange-500").length).toBe(0);

    jest.restoreAllMocks();
  });

  test("lawyer user sees clients and lawyers (excluding self) with role-based dot color", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({
      users: [
        { id: 1, role: "lawyer", first_name: "Self", last_name: "Lawyer", email: "self@x.com", photo_profile: null },
        { id: 2, role: "lawyer", first_name: "Other", last_name: "Lawyer", email: "ol@x.com", photo_profile: null },
        { id: 3, role: "client", first_name: "Client", last_name: "One", email: "c1@x.com", photo_profile: null },
      ],
    });

    jest.spyOn(userStore, "init").mockResolvedValue();

    const wrapper = mount(ContactsWidget, {
      props: {
        user: { id: 1, role: "lawyer" },
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain("Other Lawyer");
    expect(wrapper.text()).toContain("Client One");
    expect(wrapper.text()).not.toContain("Self Lawyer");

    expect(wrapper.findAll("span.bg-blue-500").length).toBeGreaterThan(0);
    expect(wrapper.findAll("span.bg-orange-500").length).toBeGreaterThan(0);

    jest.restoreAllMocks();
  });

  test("image load/error updates loading state for a contact", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({
      users: [
        { id: 1, role: "client", first_name: "C", last_name: "User", email: "c@x.com", photo_profile: null },
        { id: 2, role: "lawyer", first_name: "L", last_name: "One", email: "l1@x.com", photo_profile: null },
      ],
    });

    jest.spyOn(userStore, "init").mockResolvedValue();

    const wrapper = mount(ContactsWidget, {
      props: {
        user: { id: 1, role: "client" },
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();
    await flushPromises();

    expect(wrapper.findAll(".bg-gray-200").length).toBeGreaterThan(0);

    const img = wrapper.findAll("img")[0];
    await img.trigger("load");
    await flushPromises();

    expect(wrapper.findAll(".bg-gray-200").length).toBe(0);

    const img2 = wrapper.findAll("img")[0];
    await img2.trigger("error");
    await flushPromises();

    expect(wrapper.findAll(".bg-gray-200").length).toBe(0);

    jest.restoreAllMocks();
  });

  test("shows loading state while contacts are loading", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ users: [] });

    let resolveInit;
    const initPromise = new Promise((resolve) => {
      resolveInit = resolve;
    });

    jest.spyOn(userStore, "init").mockImplementation(() => initPromise);

    const wrapper = mount(ContactsWidget, {
      props: {
        user: { id: 1, role: "client" },
      },
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain("Cargando contactos...");

    resolveInit();
    await flushPromises();

    jest.restoreAllMocks();
  });

  test("shows empty state when there are no contacts", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ users: [] });

    jest.spyOn(userStore, "init").mockResolvedValue();

    const wrapper = mount(ContactsWidget, {
      props: {
        user: { id: 1, role: "client" },
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();
    await flushPromises();

    expect(wrapper.text()).toContain("No hay contactos disponibles.");

    jest.restoreAllMocks();
  });

  test("returns early when user id is missing", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const initSpy = jest.spyOn(userStore, "init").mockResolvedValue();

    const wrapper = mount(ContactsWidget, {
      props: {
        user: { role: "client" },
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();
    await flushPromises();

    expect(initSpy).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("No hay contactos disponibles.");

    jest.restoreAllMocks();
  });

  test("logs error when loadContacts fails", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const error = new Error("fail");

    jest.spyOn(userStore, "init").mockRejectedValueOnce(error);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const wrapper = mount(ContactsWidget, {
      props: {
        user: { id: 1, role: "client" },
      },
      global: {
        plugins: [pinia],
      },
    });

    await flushPromises();
    await flushPromises();

    expect(consoleSpy).toHaveBeenCalledWith("Error loading contacts:", error);
    expect(wrapper.text()).toContain("No hay contactos disponibles.");

    jest.restoreAllMocks();
    consoleSpy.mockRestore();
  });
});
