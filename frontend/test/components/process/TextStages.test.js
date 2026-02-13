import { mount } from "@vue/test-utils";

import TextStages from "@/components/process/TextStages.vue";

describe("TextStages.vue", () => {
  test("renders last three stages when more than two", () => {
    const wrapper = mount(TextStages, {
      props: {
        stages: [
          { status: "Inicio" },
          { status: "Etapa 2" },
          { status: "Etapa 3" },
          { status: "Etapa 4" },
        ],
      },
    });

    const texts = wrapper.findAll("p").map((node) => node.text());
    expect(texts).toEqual(["Etapa 2", "Etapa 3", "Etapa 4"]);
  });

  test("renders two stages when length is 2", () => {
    const wrapper = mount(TextStages, {
      props: {
        stages: [{ status: "Uno" }, { status: "Dos" }],
      },
    });

    const texts = wrapper.findAll("p").map((node) => node.text());
    expect(texts).toEqual(["Uno", "Dos"]);
  });

  test("renders single stage", () => {
    const wrapper = mount(TextStages, {
      props: {
        stages: [{ status: "Solo" }],
      },
    });

    expect(wrapper.text()).toContain("Solo");
  });
});
