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

  test("formatDate handles plain dates and close emits", async () => {
    const wrapper = mount(ProcessHistoryModal, {
      props: {
        isOpen: true,
        stages: [buildStage()],
      },
    });

    const { formatDate } = wrapper.vm;

    const plainDate = "2026-02-01";
    const expectedPlain = new Date(2026, 1, 1).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    expect(formatDate(plainDate)).toBe(expectedPlain);

    const dateTime = "2026-02-01T12:30:00.000Z";
    const expectedDateTime = new Date(dateTime).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Bogota",
    });

    expect(formatDate(dateTime)).toBe(expectedDateTime);

    const closeBtn = wrapper
      .findAll("button")
      .find((button) => (button.text() || "").includes("Cerrar"));

    expect(closeBtn).toBeTruthy();
    await closeBtn.trigger("click");

    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
