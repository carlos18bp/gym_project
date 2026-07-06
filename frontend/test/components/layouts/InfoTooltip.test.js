import { mount } from "@vue/test-utils";
import InfoTooltip from "@/components/layouts/InfoTooltip.vue";

async function hover(wrapper) {
  await wrapper.trigger("mouseenter");
}

describe("InfoTooltip", () => {
  it("renders the information icon", () => {
    const wrapper = mount(InfoTooltip, { props: { text: "Ayuda" } });

    expect(wrapper.find('[data-testid="info-tooltip-icon"]').exists()).toBe(true);
  });

  it("keeps the tooltip text out of the DOM until hover", () => {
    // Hidden-but-present copy would collide with text-based selectors
    // in the E2E suite, so the bubble must not render at rest.
    const wrapper = mount(InfoTooltip, { props: { text: "Ayuda" } });

    expect(wrapper.find('[data-testid="info-tooltip"]').exists()).toBe(false);
  });

  it("renders the provided text inside the bubble on hover", async () => {
    const wrapper = mount(InfoTooltip, {
      props: { text: "Crea o actualiza tu firma electrónica" },
    });

    await hover(wrapper);

    expect(wrapper.find('[data-testid="info-tooltip"]').text()).toBe(
      "Crea o actualiza tu firma electrónica",
    );
  });

  it("hides the bubble again on mouse leave", async () => {
    const wrapper = mount(InfoTooltip, { props: { text: "Ayuda" } });

    await hover(wrapper);
    await wrapper.trigger("mouseleave");

    expect(wrapper.find('[data-testid="info-tooltip"]').exists()).toBe(false);
  });

  it("positions the bubble above the icon by default", async () => {
    const wrapper = mount(InfoTooltip, { props: { text: "Ayuda" } });

    await hover(wrapper);

    expect(wrapper.find('[data-testid="info-tooltip"]').classes()).toContain(
      "bottom-full",
    );
  });

  it.each([
    ["bottom", "top-full"],
    ["left", "right-full"],
    ["right", "left-full"],
  ])(
    "positions the bubble to the %s when requested",
    async (position, expected) => {
      const wrapper = mount(InfoTooltip, { props: { text: "Ayuda", position } });

      await hover(wrapper);

      expect(wrapper.find('[data-testid="info-tooltip"]').classes()).toContain(
        expected,
      );
    },
  );

  it("applies a custom icon class", () => {
    const wrapper = mount(InfoTooltip, {
      props: { text: "Ayuda", iconClass: "size-4" },
    });

    expect(
      wrapper.find('[data-testid="info-tooltip-icon"] svg').classes(),
    ).toContain("size-4");
  });

  it.each([
    ["top", "border-t-gray-900"],
    ["bottom", "border-b-gray-900"],
    ["left", "border-l-gray-900"],
    ["right", "border-r-gray-900"],
  ])("points the arrow toward the icon for position %s", async (position, expected) => {
    const wrapper = mount(InfoTooltip, { props: { text: "Ayuda", position } });

    await hover(wrapper);

    const arrow = wrapper.find('[data-testid="info-tooltip-arrow"]');
    expect(arrow.classes()).toContain(expected);
    expect(arrow.text()).toBe("");
  });
});
