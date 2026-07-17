import { mount } from "@vue/test-utils";

import ScheduleAppointment from "@/views/schedule_appointment/ScheduleAppointment.vue";

const ModuleHeaderStub = {
  name: "ModuleHeader",
  props: ["title"],
  template: "<header :data-title='title'><slot name='menu-button' /></header>",
};
const SearchBarStub = {
  name: "SearchBarAndFilterBy",
  emits: ["update:searchQuery"],
  template: "<div />",
};

const mountView = () =>
  mount(ScheduleAppointment, {
    global: {
      stubs: {
        ModuleHeader: ModuleHeaderStub,
        SearchBarAndFilterBy: SearchBarStub,
      },
    },
  });

describe("views/schedule_appointment/ScheduleAppointment.vue", () => {
  afterEach(() => {
    document.head
      .querySelectorAll("script[src*='calendly']")
      .forEach((s) => s.remove());
  });

  test("renders the module header titled Agendar Cita", () => {
    const wrapper = mountView();

    expect(wrapper.findComponent(ModuleHeaderStub).props("title")).toBe(
      "Agendar Cita"
    );
  });

  test("renders the Calendly inline widget pointing to the cita-abogado URL", () => {
    const wrapper = mountView();

    const widget = wrapper.get(".calendly-inline-widget");
    expect(widget.attributes("data-url")).toBe(
      "https://calendly.com/infogym/cita-abogado"
    );
  });

  test("appends the Calendly script to the document head on mount", () => {
    mountView();

    // quality: allow-fragile-selector (script injected into document.head, outside the wrapper)
    const script = document.head.querySelector(
      "script[src='https://assets.calendly.com/assets/external/widget.js']"
    );
    expect(script).not.toBeNull();
  });

  test("loads the Calendly script asynchronously", () => {
    mountView();

    // quality: allow-fragile-selector (script injected into document.head, outside the wrapper)
    const script = document.head.querySelector("script[src*='calendly']");
    expect(script.async).toBe(true);
  });
});
