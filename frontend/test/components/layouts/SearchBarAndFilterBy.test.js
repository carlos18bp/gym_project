import { mount } from "@vue/test-utils";

import SearchBarAndFilterBy from "@/components/layouts/SearchBarAndFilterBy.vue";

jest.mock("@heroicons/vue/20/solid", () => {
  const Stub = { name: "MagnifyingGlassIcon", template: "<span />" };
  return { __esModule: true, MagnifyingGlassIcon: Stub };
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("SearchBarAndFilterBy.vue", () => {
  test("renders search input field", () => {
    const wrapper = mount(SearchBarAndFilterBy);

    // quality: allow-fragile-selector (stable DOM id defined in component template)
    const input = wrapper.find("#search-field");
    expect(input.exists()).toBe(true);
    expect(input.attributes("placeholder")).toBe("Buscar");
    expect(input.attributes("type")).toBe("search");
  });

  test("renders magnifying glass icon", () => {
    const wrapper = mount(SearchBarAndFilterBy);

    const icon = wrapper.findComponent({ name: "MagnifyingGlassIcon" });
    expect(icon.exists()).toBe(true);
  });

  test("typing in search field emits update:searchQuery", async () => {
    const wrapper = mount(SearchBarAndFilterBy);

    const input = wrapper.find("#search-field"); // quality: allow-fragile-selector (stable DOM id)
    await input.setValue("test query");
    await input.trigger("input");
    await flushPromises();

    expect(wrapper.emitted("update:searchQuery")).toBeTruthy();
    expect(wrapper.emitted("update:searchQuery")[0]).toEqual(["test query"]);
  });

  test("search field starts empty", () => {
    const wrapper = mount(SearchBarAndFilterBy);

    const input = wrapper.find("#search-field"); // quality: allow-fragile-selector (stable DOM id)
    expect(input.element.value).toBe("");
  });

  test("renders default slot content", () => {
    const wrapper = mount(SearchBarAndFilterBy, {
      slots: {
        default: '<button id="menu-btn">Menu</button>',
      },
    });

    // quality: allow-fragile-selector (test-injected slot id, not from component template)
    expect(wrapper.find("#menu-btn").exists()).toBe(true);
    expect(wrapper.find("#menu-btn").text()).toBe("Menu");
  });

  test("renders auxiliary_button slot content", () => {
    const wrapper = mount(SearchBarAndFilterBy, {
      slots: {
        auxiliary_button: '<button id="filter-btn">Filter</button>',
      },
    });

    // quality: allow-fragile-selector (test-injected slot id, not from component template)
    expect(wrapper.find("#filter-btn").exists()).toBe(true);
    expect(wrapper.find("#filter-btn").text()).toBe("Filter");
  });

  test("multiple input events emit corresponding values", async () => {
    const wrapper = mount(SearchBarAndFilterBy);

    const input = wrapper.find("#search-field"); // quality: allow-fragile-selector (stable DOM id)

    await input.setValue("first");
    await input.trigger("input");

    await input.setValue("second");
    await input.trigger("input");

    await flushPromises();

    const emissions = wrapper.emitted("update:searchQuery");
    expect(emissions.length).toBeGreaterThanOrEqual(2);

    const emittedValues = emissions.map((e) => e[0]);
    expect(emittedValues).toContain("first");
    expect(emittedValues).toContain("second");
  });

  test("clearing search field emits empty string", async () => {
    const wrapper = mount(SearchBarAndFilterBy);

    const input = wrapper.find("#search-field"); // quality: allow-fragile-selector (stable DOM id)
    await input.setValue("query");
    await input.trigger("input");

    await input.setValue("");
    await input.trigger("input");

    await flushPromises();

    const emissions = wrapper.emitted("update:searchQuery");
    expect(emissions[emissions.length - 1]).toEqual([""]);
  });
});
