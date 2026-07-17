import { mount } from "@vue/test-utils";

import HighlightText from "@/components/utils/HighlightText.vue";

describe("components/utils/HighlightText.vue", () => {
  test("renders plain text without a highlight span when the query is empty", () => {
    const wrapper = mount(HighlightText, { props: { text: "hello world", query: "" } });

    expect(wrapper.text()).toContain("hello world");
    expect(wrapper.findAll("span")).toHaveLength(1); // only the root span
  });

  test("wraps the matched query in a highlight span", () => {
    const wrapper = mount(HighlightText, { props: { text: "hello world", query: "lo" } });

    expect(wrapper.findAll("span")).toHaveLength(2); // root + one highlight
  });

  test("matches the query case-insensitively", () => {
    const wrapper = mount(HighlightText, { props: { text: "HELLO", query: "hello" } });

    expect(wrapper.findAll("span")).toHaveLength(2);
  });

  test("applies a custom highlight class", () => {
    const wrapper = mount(HighlightText, {
      props: { text: "hello", query: "he", highlightClass: "bg-yellow-200" },
    });

    expect(wrapper.html()).toContain("bg-yellow-200");
  });

  test("escapes HTML in the source text so no markup is injected", () => {
    const wrapper = mount(HighlightText, { props: { text: "<b>x</b>", query: "" } });

    expect(wrapper.findAll("b")).toHaveLength(0);
    expect(wrapper.text()).toContain("<b>x</b>");
  });
});
