import { mount } from "@vue/test-utils";

import QuickActionButtons from "@/components/dashboard/QuickActionButtons.vue";

const findClickableCardByText = (wrapper, text) => {
  const card = wrapper.findAll("div").find((node) => {
    const className = node.attributes("class") || "";
    return className.includes("cursor-pointer") && (node.text() || "").includes(text);
  });
  if (!card) {
    throw new Error(`Card not found: ${text}`);
  }
  return card;
};

const mountView = (user) =>
  mount(QuickActionButtons, {
    props: { user },
    global: {
      stubs: {
        RouterLink: { template: "<a><slot /></a>" },
        ModalTransition: {
          template: "<div data-test='facturation-modal' v-bind='$attrs'><slot /></div>",
        },
        FacturationForm: { template: "<div data-test='facturation-form' />" },
        FolderOpenIcon: { template: "<span />" },
        DocumentArrowDownIcon: { template: "<span />" },
        DocumentTextIcon: { template: "<span />" },
        DocumentChartBarIcon: { template: "<span />" },
        CalendarDaysIcon: { template: "<span />" },
        FolderIcon: { template: "<span />" },
        PlusCircleIcon: { template: "<span />" },
        ChevronRightIcon: { template: "<span />" },
      },
    },
  });

describe("QuickActionButtons.vue", () => {
  test("renders lawyer actions and opens facturation modal", async () => {
    const wrapper = mountView({ role: "lawyer" });

    expect(wrapper.text()).toContain("Todos los Procesos");
    expect(wrapper.text()).toContain("Radicar Proceso");
    expect(wrapper.text()).toContain("Nueva Minuta");
    expect(wrapper.text()).toContain("Radicar Informe");
    expect(wrapper.text()).not.toContain("Mis Procesos");

    expect(wrapper.vm.$.setupState.showFacturationModal).toBe(false);

    await findClickableCardByText(wrapper, "Radicar Informe").trigger("click");

    expect(wrapper.vm.$.setupState.showFacturationModal).toBe(true);
  });

  test("renders client actions for non-lawyers", () => {
    const wrapper = mountView({ role: "client" });

    expect(wrapper.text()).toContain("Mis Procesos");
    expect(wrapper.text()).toContain("Agendar Cita");
    expect(wrapper.text()).toContain("Radicar Solicitud");
    expect(wrapper.text()).not.toContain("Radicar Informe");
  });

  test("renders lawyer navigation links", () => {
    const wrapper = mountView({ role: "lawyer" });
    const links = wrapper.findAll("a");

    expect(links.some((link) => link.text().includes("Nueva Minuta"))).toBe(true);
    expect(links.length).toBeGreaterThanOrEqual(3);
  });
});
