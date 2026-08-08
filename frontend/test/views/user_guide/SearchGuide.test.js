import { mount } from "@vue/test-utils";

const mockSearchGuideContent = jest.fn();

jest.mock("@/stores/user_guide", () => ({
  useUserGuideStore: () => ({
    searchGuideContent: mockSearchGuideContent,
  }),
}));

import SearchGuide from "@/views/user_guide/components/SearchGuide.vue";

const IconStub = { template: "<svg />" };

const resultsFixture = [
  {
    title: "Crear proceso",
    module: "Procesos",
    section: "Gestión",
    snippet: "Cómo crear un proceso nuevo",
    icon: IconStub,
  },
];

const mountSearch = (props = {}) => mount(SearchGuide, { props });

const typeQuery = async (wrapper, text) => {
  const input = wrapper.get("input");
  await input.setValue(text);
  return input;
};

describe("views/user_guide/components/SearchGuide.vue", () => {
  beforeEach(() => {
    mockSearchGuideContent.mockReset();
    mockSearchGuideContent.mockReturnValue(resultsFixture);
  });

  test("emits update:modelValue while typing", async () => {
    const wrapper = mountSearch();

    await typeQuery(wrapper, "pro");

    expect(wrapper.emitted("update:modelValue").at(-1)).toEqual(["pro"]);
  });

  test("does not search with fewer than three characters", async () => {
    const wrapper = mountSearch();

    await typeQuery(wrapper, "pr");

    expect(mockSearchGuideContent).not.toHaveBeenCalled();
    expect(wrapper.text()).not.toContain("resultado(s)");
  });

  test("shows the results dropdown after typing three or more characters", async () => {
    const wrapper = mountSearch();

    await typeQuery(wrapper, "proceso");

    expect(mockSearchGuideContent).toHaveBeenCalledWith("proceso");
    expect(wrapper.text()).toContain("1 resultado(s) encontrado(s)");
    expect(wrapper.text()).toContain("Crear proceso");
  });

  test("emits search when pressing enter with a valid query", async () => {
    const wrapper = mountSearch();

    const input = await typeQuery(wrapper, "proceso");
    await input.trigger("keyup.enter");

    expect(wrapper.emitted("search")).toEqual([["proceso"]]);
  });

  test("does not emit search when pressing enter with a short query", async () => {
    const wrapper = mountSearch();

    const input = await typeQuery(wrapper, "pr");
    await input.trigger("keyup.enter");

    expect(wrapper.emitted("search")).toBeUndefined();
  });

  test("emits result-selected and hides the dropdown when a result is clicked", async () => {
    const wrapper = mountSearch();
    await typeQuery(wrapper, "proceso");

    await wrapper
      .findAll("button")
      .find((b) => b.text().includes("Crear proceso"))
      .trigger("click");

    expect(wrapper.emitted("result-selected")).toEqual([[resultsFixture[0]]]);
    expect(wrapper.text()).not.toContain("resultado(s)");
  });

  test("shows the empty state when the search returns nothing", async () => {
    mockSearchGuideContent.mockReturnValue([]);
    const wrapper = mountSearch();

    await typeQuery(wrapper, "zzzzz");

    expect(wrapper.text()).toContain('No se encontraron resultados para "zzzzz"');
  });

  test("clears the query and notifies the parent from the clear button", async () => {
    const wrapper = mountSearch();
    await typeQuery(wrapper, "proceso");

    await wrapper
      .findAll("button")
      .find((b) => !b.text().includes("Crear proceso"))
      .trigger("click");

    expect(wrapper.get("input").element.value).toBe("");
    expect(wrapper.emitted("update:modelValue").at(-1)).toEqual([""]);
  });

  test("syncs the input when the modelValue prop changes", async () => {
    const wrapper = mountSearch({ modelValue: "" });

    await wrapper.setProps({ modelValue: "firmas" });

    expect(wrapper.get("input").element.value).toBe("firmas");
  });
});
