import { mount } from "@vue/test-utils";

import HierarchicalMenu from "@/components/dynamic_document/cards/HierarchicalMenu.vue";

const MenuStub = {
  name: "Menu",
  template: "<div><slot /></div>",
};

const MenuButtonStub = {
  name: "MenuButton",
  template: "<button type='button'><slot /></button>",
};

const MenuItemsStub = {
  name: "MenuItems",
  template: "<div><slot /></div>",
};

const MenuItemStub = {
  name: "MenuItem",
  template: "<div><slot /></div>",
};

describe("HierarchicalMenu.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("emits menu-action when clicking a simple menu item", async () => {
    const wrapper = mount(HierarchicalMenu, {
      props: {
        menuItems: [{ id: "preview", label: "Previsualizar", action: "preview" }],
        menuPosition: "right-0",
      },
      global: {
        stubs: {
          Menu: MenuStub,
          MenuButton: MenuButtonStub,
          MenuItems: MenuItemsStub,
          MenuItem: MenuItemStub,
          EllipsisVerticalIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
          NoSymbolIcon: { template: "<span />" },
        },
      },
    });

    const btn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Previsualizar");
    expect(btn).toBeTruthy();

    await btn.trigger("click");

    expect(wrapper.emitted("menu-action")).toBeTruthy();
    expect(wrapper.emitted("menu-action")[0][0]).toBe("preview");
  });

  test("shows submenu on mouseenter and emits child action", async () => {
    const wrapper = mount(HierarchicalMenu, {
      props: {
        menuItems: [
          {
            id: "edit",
            label: "Editar",
            children: [{ label: "Editar Documento", action: "editDocument" }],
          },
        ],
        menuPosition: "right-0",
      },
      global: {
        stubs: {
          Menu: MenuStub,
          MenuButton: MenuButtonStub,
          MenuItems: MenuItemsStub,
          MenuItem: MenuItemStub,
          EllipsisVerticalIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
          NoSymbolIcon: { template: "<span />" },
        },
      },
    });

    const groupHeader = wrapper.find(".submenu-container .w-full");
    expect(groupHeader.exists()).toBe(true);

    await groupHeader.trigger("mouseenter");

    expect(wrapper.find(".z-60").exists()).toBe(true);

    const childBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").trim() === "Editar Documento");
    expect(childBtn).toBeTruthy();

    await childBtn.trigger("click");

    expect(wrapper.emitted("menu-action")).toBeTruthy();
    expect(wrapper.emitted("menu-action")[0][0]).toBe("editDocument");
    expect(wrapper.find(".z-60").exists()).toBe(false);
  });

  test("hides submenu after mouseleave delay", async () => {
    jest.useFakeTimers();

    const wrapper = mount(HierarchicalMenu, {
      props: {
        menuItems: [
          {
            id: "edit",
            label: "Editar",
            children: [{ label: "Editar Documento", action: "editDocument" }],
          },
        ],
        menuPosition: "right-0",
      },
      global: {
        stubs: {
          Menu: MenuStub,
          MenuButton: MenuButtonStub,
          MenuItems: MenuItemsStub,
          MenuItem: MenuItemStub,
          EllipsisVerticalIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
          NoSymbolIcon: { template: "<span />" },
        },
      },
    });

    const groupHeader = wrapper.find(".submenu-container .w-full");
    await groupHeader.trigger("mouseenter");
    expect(wrapper.find(".z-60").exists()).toBe(true);

    await groupHeader.trigger("mouseleave");

    // Still visible before timer
    expect(wrapper.find(".z-60").exists()).toBe(true);

    jest.advanceTimersByTime(160);
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".z-60").exists()).toBe(false);

    jest.useRealTimers();
  });

  test("showSubmenu clears pending hideSubmenu timeout", async () => {
    jest.useFakeTimers();

    const wrapper = mount(HierarchicalMenu, {
      props: {
        menuItems: [
          {
            id: "edit",
            label: "Editar",
            children: [{ label: "Editar Documento", action: "editDocument" }],
          },
        ],
        menuPosition: "right-0",
      },
      global: {
        stubs: {
          Menu: MenuStub,
          MenuButton: MenuButtonStub,
          MenuItems: MenuItemsStub,
          MenuItem: MenuItemStub,
          EllipsisVerticalIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
          NoSymbolIcon: { template: "<span />" },
        },
      },
    });

    wrapper.vm.$.setupState.showSubmenu("edit");
    wrapper.vm.$.setupState.hideSubmenu("edit");

    wrapper.vm.$.setupState.showSubmenu("edit");

    jest.advanceTimersByTime(200);
    await wrapper.vm.$nextTick();

    expect(wrapper.vm.$.setupState.activeSubmenu).toBe("edit");

    jest.useRealTimers();
  });

  test("renders divider items", () => {
    const wrapper = mount(HierarchicalMenu, {
      props: {
        menuItems: [
          { id: "one", label: "Uno", action: "one" },
          { id: "divider-1", divider: true },
          { id: "two", label: "Dos", action: "two" },
        ],
        menuPosition: "right-0",
      },
      global: {
        stubs: {
          Menu: MenuStub,
          MenuButton: MenuButtonStub,
          MenuItems: MenuItemsStub,
          MenuItem: MenuItemStub,
          EllipsisVerticalIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
          NoSymbolIcon: { template: "<span />" },
        },
      },
    });

    expect(wrapper.findAll(".border-t").length).toBe(1);
  });
});
