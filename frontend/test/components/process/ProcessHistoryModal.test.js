import { mount } from "@vue/test-utils";

import ProcessHistoryModal from "@/components/process/ProcessHistoryModal.vue";

const buildStage = (overrides = {}) => ({
  id: 1,
  status: "Etapa",
  created_at: "2026-02-01T00:00:00.000Z",
  ...overrides,
});

describe("ProcessHistoryModal.vue", () => {
  test("shows empty state when there are no stages", () => {
    const wrapper = mount(ProcessHistoryModal, {
      props: {
        isOpen: true,
        stages: [],
      },
    });

    expect(wrapper.text()).toContain("Sin etapas registradas");
  });

  test("preserves original stage order from the array", () => {
    const wrapper = mount(ProcessHistoryModal, {
      props: {
        isOpen: true,
        stages: [
          buildStage({ id: 1, status: "Primera", date: "2026-02-01" }),
          buildStage({ id: 2, status: "Segunda", date: "2026-03-01" }),
        ],
      },
    });

    const titles = wrapper.findAll("h4").map((node) => node.text());

    expect(titles[0]).toContain("Primera");
    expect(titles[1]).toContain("Segunda");
  });

  test.each([
    {
      label: "plain YYYY-MM-DD date",
      date: "2026-02-01",
      expected: new Date(2026, 1, 1).toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    },
    {
      label: "full ISO datetime",
      date: "2026-02-01T12:30:00.000Z",
      expected: new Date("2026-02-01T12:30:00.000Z").toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Bogota",
      }),
    },
  ])("renders the $label formatted in the stage entry", ({ date, expected }) => {
    const wrapper = mount(ProcessHistoryModal, {
      props: {
        isOpen: true,
        stages: [buildStage({ date })],
      },
    });

    expect(wrapper.text()).toContain(expected);
  });

  test("emits close when the footer button is clicked", async () => {
    const wrapper = mount(ProcessHistoryModal, {
      props: {
        isOpen: true,
        stages: [buildStage()],
      },
    });

    const closeBtn = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Cerrar"));

    await closeBtn.trigger("click");

    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  test("renders alert badge with lawyer-and-clients tooltip when notify_clients=true", () => {
    const wrapper = mount(ProcessHistoryModal, {
      props: {
        isOpen: true,
        stages: [
          buildStage({
            id: 5,
            status: "Audiencia",
            date: "2026-06-15",
            alert: { id: 1, is_active: true, notify_clients: true },
          }),
        ],
      },
    });

    const badge = wrapper.find(
      'span[title="Notifica al abogado y clientes"]'
    );
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toContain("Alerta");
  });

  test("alert tooltip says lawyer-only when notify_clients=false", () => {
    const wrapper = mount(ProcessHistoryModal, {
      props: {
        isOpen: true,
        stages: [
          buildStage({
            id: 6,
            status: "Audiencia",
            date: "2026-06-15",
            alert: { id: 2, is_active: true, notify_clients: false },
          }),
        ],
      },
    });

    const badge = wrapper.find('span[title="Notifica solo al abogado"]');
    expect(badge.exists()).toBe(true);
  });

  test("inactive alert renders Inactiva badge with disabled tooltip", () => {
    const wrapper = mount(ProcessHistoryModal, {
      props: {
        isOpen: true,
        stages: [
          buildStage({
            id: 7,
            status: "Audiencia",
            date: "2026-06-15",
            alert: { id: 3, is_active: false, notify_clients: true },
          }),
        ],
      },
    });

    const badge = wrapper.find('span[title="Alerta desactivada"]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toContain("Inactiva");
  });

  test("does not render badge when stage has no alert", () => {
    const wrapper = mount(ProcessHistoryModal, {
      props: {
        isOpen: true,
        stages: [buildStage({ id: 8, status: "Apertura", date: "2026-06-01" })],
      },
    });

    expect(wrapper.find('span[title*="Notifica"]').exists()).toBe(false);
    expect(wrapper.find('span[title="Alerta desactivada"]').exists()).toBe(false);
  });
});
