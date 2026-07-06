import { mount } from "@vue/test-utils";
import InfoTooltip from "@/components/layouts/InfoTooltip.vue";

describe("InfoTooltip", () => {
  it("renders the information icon", () => {
    const wrapper = mount(InfoTooltip, { props: { text: "Ayuda" } });

    expect(wrapper.find('[data-testid="info-tooltip-icon"]').exists()).toBe(true);
  });

  it("renders the provided text inside the tooltip bubble", () => {
    const wrapper = mount(InfoTooltip, {
      props: { text: "Crea o actualiza tu firma electrónica" },
    });

    expect(wrapper.find('[data-testid="info-tooltip"]').text()).toBe(
      "Crea o actualiza tu firma electrónica",
    );
  });

  it("positions the bubble above the icon by default", () => {
    const wrapper = mount(InfoTooltip, { props: { text: "Ayuda" } });

    expect(wrapper.find('[data-testid="info-tooltip"]').classes()).toContain(
      "bottom-full",
    );
  });

  it.each([
    ["bottom", "top-full"],
    ["left", "right-full"],
    ["right", "left-full"],
  ])("positions the bubble to the %s when requested", (position, expected) => {
    const wrapper = mount(InfoTooltip, { props: { text: "Ayuda", position } });

    expect(wrapper.find('[data-testid="info-tooltip"]').classes()).toContain(
      expected,
    );
  });

  it("applies a custom icon class", () => {
    const wrapper = mount(InfoTooltip, {
      props: { text: "Ayuda", iconClass: "size-4" },
    });

    expect(
      wrapper.find('[data-testid="info-tooltip-icon"] svg').classes(),
    ).toContain("size-4");
  });
});
