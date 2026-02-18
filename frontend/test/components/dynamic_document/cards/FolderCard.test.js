import { mount } from "@vue/test-utils";

import FolderCard from "@/components/dynamic_document/cards/FolderCard.vue";

const mockUseUserStore = jest.fn();
const mockGetColorById = jest.fn();

jest.mock("@/stores/auth/user", () => ({
  __esModule: true,
  useUserStore: () => mockUseUserStore(),
}));

jest.mock("@/shared/color_palette", () => ({
  __esModule: true,
  getColorById: (...args) => mockGetColorById(...args),
}));

describe("FolderCard.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUserStore.mockReturnValue({ currentUser: { id: 1 } });
    mockGetColorById.mockReturnValue({ hex: "#6B7280", name: "Gray" });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mountWithCreatedAt = (createdAt) =>
    mount(FolderCard, {
      props: {
        folder: {
          id: 1,
          name: "Dates",
          color_id: 1,
          created_at: createdAt,
          documents: [],
        },
      },
      global: {
        stubs: {
          FolderIcon: { template: "<span />" },
          DocumentIcon: { template: "<span />" },
          EllipsisVerticalIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          PlusIcon: { template: "<span />" },
          TrashIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
        },
      },
    });

  test("renders folder name and document count", () => {
    const wrapper = mount(FolderCard, {
      props: {
        folder: {
          id: 1,
          name: "My Folder",
          color_id: 1,
          created_at: "2026-01-01T00:00:00Z",
          documents: [{ id: 1 }, { id: 2 }],
        },
      },
      global: {
        stubs: {
          FolderIcon: { template: "<span />" },
          DocumentIcon: { template: "<span />" },
          EllipsisVerticalIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          PlusIcon: { template: "<span />" },
          TrashIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
        },
      },
    });

    expect(wrapper.text()).toContain("My Folder");
    expect(wrapper.text()).toContain("2 documentos");
  });

  test("uses default color when palette lookup fails", () => {
    mockGetColorById.mockReturnValueOnce(null);

    const wrapper = mount(FolderCard, {
      props: {
        folder: {
          id: 1,
          name: "Fallback",
          color_id: 99,
          created_at: "2026-01-01T00:00:00Z",
          documents: [],
        },
      },
      global: {
        stubs: {
          FolderIcon: { name: "FolderIcon", template: "<span class='folder-icon' />" },
          DocumentIcon: { template: "<span />" },
          EllipsisVerticalIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          PlusIcon: { template: "<span />" },
          TrashIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
        },
      },
    });

    expect(wrapper.vm.$.setupState.folderColor).toEqual({
      hex: "#6B7280",
      name: "Gray",
    });
    expect(wrapper.find("div.absolute").attributes("style")).toContain(
      "background-color: rgb(107, 114, 128)"
    );
  });

  test("shows empty state when folder has no documents", () => {
    const wrapper = mount(FolderCard, {
      props: {
        folder: {
          id: 1,
          name: "Empty",
          color_id: 1,
          created_at: "2026-01-01T00:00:00Z",
          documents: [],
        },
      },
      global: {
        stubs: {
          FolderIcon: { template: "<span />" },
          DocumentIcon: { template: "<span />" },
          EllipsisVerticalIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          PlusIcon: { template: "<span />" },
          TrashIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
        },
      },
    });

    expect(wrapper.text()).toContain("Carpeta vacía");
  });

  test("handles missing documents list and shows zero count", () => {
    const wrapper = mount(FolderCard, {
      props: {
        folder: {
          id: 1,
          name: "Missing",
          color_id: 1,
          created_at: "2026-01-01T00:00:00Z",
        },
      },
      global: {
        stubs: {
          FolderIcon: { template: "<span />" },
          DocumentIcon: { template: "<span />" },
          EllipsisVerticalIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          PlusIcon: { template: "<span />" },
          TrashIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
        },
      },
    });

    expect(wrapper.text()).toContain("0 documentos");
    expect(wrapper.text()).toContain("Carpeta vacía");
  });

  test("uses singular label when only one document", () => {
    const wrapper = mount(FolderCard, {
      props: {
        folder: {
          id: 1,
          name: "Single",
          color_id: 1,
          created_at: "2026-01-01T00:00:00Z",
          documents: [{ id: 1 }],
        },
      },
      global: {
        stubs: {
          FolderIcon: { template: "<span />" },
          DocumentIcon: { template: "<span />" },
          EllipsisVerticalIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          PlusIcon: { template: "<span />" },
          TrashIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
        },
      },
    });

    expect(wrapper.text()).toContain("1 documento");
  });

  test("shows category counts based on document types", () => {
    const wrapper = mount(FolderCard, {
      props: {
        folder: {
          id: 1,
          name: "Types",
          color_id: 1,
          created_at: "2026-01-01T00:00:00Z",
          documents: [
            { id: 1, assigned_to: 1, state: "Progress" },
            { id: 2, assigned_to: 1, state: "Completed" },
            { id: 3, state: "Published", assigned_to: null },
            { id: 4, state: "PendingSignatures" },
            { id: 5, state: "FullySigned" },
            // not counted
            { id: 6, assigned_to: 2, state: "Completed" },
            { id: 7, state: "Draft" },
          ],
        },
      },
      global: {
        stubs: {
          FolderIcon: { template: "<span />" },
          DocumentIcon: { template: "<span />" },
          EllipsisVerticalIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          PlusIcon: { template: "<span />" },
          TrashIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
        },
      },
    });

    expect(wrapper.text()).toContain("2 mis documentos");
    expect(wrapper.text()).toContain("1 formatos disponibles");
    expect(wrapper.text()).toContain("2 documentos con firmas");
  });

  test("menu actions emit edit/add-documents/delete", async () => {
    const wrapper = mount(FolderCard, {
      props: {
        folder: {
          id: 1,
          name: "Actions",
          color_id: 1,
          created_at: "2026-01-01T00:00:00Z",
          documents: [],
        },
      },
      global: {
        stubs: {
          FolderIcon: { template: "<span />" },
          DocumentIcon: { template: "<span />" },
          EllipsisVerticalIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          PlusIcon: { template: "<span />" },
          TrashIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
        },
      },
    });

    const menuToggle = wrapper.find(".folder-menu-container button");
    await menuToggle.trigger("click");

    const buttons = wrapper.findAll(".folder-menu-container .absolute button");
    expect(buttons).toHaveLength(3);

    await buttons[0].trigger("click");
    expect(wrapper.emitted("edit")).toBeTruthy();

    await menuToggle.trigger("click");
    await wrapper.findAll(".folder-menu-container .absolute button")[1].trigger("click");
    expect(wrapper.emitted("add-documents")).toBeTruthy();

    await menuToggle.trigger("click");
    await wrapper.findAll(".folder-menu-container .absolute button")[2].trigger("click");
    expect(wrapper.emitted("delete")).toBeTruthy();
  });

  test("clicking card while menu is open does not emit click", async () => {
    const wrapper = mount(FolderCard, {
      props: {
        folder: {
          id: 1,
          name: "Open Menu",
          color_id: 1,
          created_at: "2026-01-01T00:00:00Z",
          documents: [],
        },
      },
      global: {
        stubs: {
          FolderIcon: { template: "<span />" },
          DocumentIcon: { template: "<span />" },
          EllipsisVerticalIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          PlusIcon: { template: "<span />" },
          TrashIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
        },
      },
    });

    const menuToggle = wrapper.find(".folder-menu-container button");
    await menuToggle.trigger("click");

    await wrapper.trigger("click");

    expect(wrapper.emitted("click")).toBeFalsy();
  });

  test("clicking outside closes menu and prevents folder opening until timer clears", async () => {
    jest.useFakeTimers();

    const wrapper = mount(FolderCard, {
      props: {
        folder: {
          id: 1,
          name: "Outside",
          color_id: 1,
          created_at: "2026-01-01T00:00:00Z",
          documents: [],
        },
      },
      attachTo: document.body,
      global: {
        stubs: {
          FolderIcon: { template: "<span />" },
          DocumentIcon: { template: "<span />" },
          EllipsisVerticalIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          PlusIcon: { template: "<span />" },
          TrashIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
        },
      },
    });

    const menuToggle = wrapper.find(".folder-menu-container button");
    await menuToggle.trigger("click");

    expect(wrapper.find(".folder-menu-container .absolute").exists()).toBe(true);

    // Click outside
    await document.body.click();

    expect(wrapper.find(".folder-menu-container .absolute").exists()).toBe(false);

    // Immediately clicking the card should not emit click due to menuJustClosed
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeFalsy();

    jest.advanceTimersByTime(60);

    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();

    wrapper.unmount();
    jest.useRealTimers();
  });

  test("formatDate returns empty string when date is missing", () => {
    const wrapper = mount(FolderCard, {
      props: {
        folder: {
          id: 1,
          name: "No Date",
          color_id: 1,
          created_at: "",
          documents: [],
        },
      },
      global: {
        stubs: {
          FolderIcon: { template: "<span />" },
          DocumentIcon: { template: "<span />" },
          EllipsisVerticalIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          PlusIcon: { template: "<span />" },
          TrashIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
        },
      },
    });

    const footerText = wrapper.find("span.text-xs.text-gray-500").text();
    expect(footerText).toBe("Creada");
  });

  test("clicking menu container does not emit click", async () => {
    const wrapper = mount(FolderCard, {
      props: {
        folder: {
          id: 1,
          name: "Menu",
          color_id: 1,
          created_at: "2026-01-01T00:00:00Z",
          documents: [],
        },
      },
      global: {
        stubs: {
          FolderIcon: { template: "<span />" },
          DocumentIcon: { template: "<span />" },
          EllipsisVerticalIcon: { template: "<span />" },
          PencilIcon: { template: "<span />" },
          PlusIcon: { template: "<span />" },
          TrashIcon: { template: "<span />" },
          ChevronRightIcon: { template: "<span />" },
        },
      },
    });

    const menuContainer = wrapper.find(".folder-menu-container").element;
    const event = new MouseEvent("click", { bubbles: true });
    Object.defineProperty(event, "target", { value: menuContainer });
    wrapper.element.dispatchEvent(event);

    expect(wrapper.emitted("click")).toBeFalsy();
  });

  test("formatDate handles hoy/ayer", async () => {
    jest.useFakeTimers();
    const now = new Date("2026-02-10T12:00:00.000Z");
    jest.setSystemTime(now);

    const wrapper = mountWithCreatedAt(now.toISOString());

    expect(wrapper.text()).toContain("Creada hoy");

    await wrapper.setProps({
      folder: {
        ...wrapper.props("folder"),
        created_at: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    expect(wrapper.text()).toContain("Creada ayer");

    jest.useRealTimers();
  });

  test("formatDate handles days/weeks", async () => {
    jest.useFakeTimers();
    const now = new Date("2026-02-10T12:00:00.000Z");
    jest.setSystemTime(now);

    const wrapper = mountWithCreatedAt(
      new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
    );

    expect(wrapper.text()).toContain("Creada hace 3 días");

    await wrapper.setProps({
      folder: {
        ...wrapper.props("folder"),
        created_at: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    expect(wrapper.text()).toContain("Creada hace 1 semana");

    await wrapper.setProps({
      folder: {
        ...wrapper.props("folder"),
        created_at: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    expect(wrapper.text()).toContain("Creada hace 2 semanas");

    jest.useRealTimers();
  });

  test("formatDate handles months and older dates", async () => {
    jest.useFakeTimers();
    const now = new Date("2026-02-10T12:00:00.000Z");
    jest.setSystemTime(now);

    const wrapper = mountWithCreatedAt(
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    );

    expect(wrapper.text()).toContain("Creada hace 1 mes");

    await wrapper.setProps({
      folder: {
        ...wrapper.props("folder"),
        created_at: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    expect(wrapper.text()).toContain("Creada hace 3 meses");

    const oldDate = new Date(now.getTime() - 400 * 24 * 60 * 60 * 1000);
    await wrapper.setProps({
      folder: { ...wrapper.props("folder"), created_at: oldDate.toISOString() },
    });
    const expected = oldDate.toLocaleDateString("es-ES", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    expect(wrapper.text()).toContain(expected);

    jest.useRealTimers();
  });
});
