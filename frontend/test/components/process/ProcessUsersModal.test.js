import { mount } from "@vue/test-utils";

import ProcessUsersModal from "@/components/process/ProcessUsersModal.vue";

const buildUser = (overrides = {}) => ({
  id: 1,
  first_name: "Ana",
  last_name: "Diaz",
  email: "ana@example.com",
  photo_profile: "",
  ...overrides,
});

describe("ProcessUsersModal.vue", () => {
  test("renders users list and emits close", async () => {
    const wrapper = mount(ProcessUsersModal, {
      props: {
        isOpen: true,
        title: "Usuarios",
        users: [buildUser(), buildUser({ id: 2, first_name: "Luis" })],
      },
    });

    expect(wrapper.text()).toContain("Usuarios");
    expect(wrapper.text()).toContain("Ana Diaz");
    expect(wrapper.text()).toContain("Luis");

    const closeBtn = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Cerrar"));

    expect(closeBtn).toBeTruthy();
    await closeBtn.trigger("click");

    expect(wrapper.emitted("close")).toBeTruthy();
  });

  test("shows empty state when there are no users", () => {
    const wrapper = mount(ProcessUsersModal, {
      props: {
        isOpen: true,
        users: [],
      },
    });

    expect(wrapper.text()).toContain("Sin usuarios asociados");
  });

  test("shows initials fallback when names are missing", () => {
    const wrapper = mount(ProcessUsersModal, {
      props: {
        isOpen: true,
        users: [buildUser({ first_name: null, last_name: null })],
      },
    });

    expect(wrapper.find(".bg-gradient-to-br").text()).toContain("?");
  });
});
