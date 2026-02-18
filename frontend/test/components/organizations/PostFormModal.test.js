import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import { useOrganizationPostsStore } from "@/stores/organization_posts";

import PostFormModal from "@/components/organizations/modals/PostFormModal.vue";

const mockShowNotification = jest.fn();

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@heroicons/vue/24/outline", () => {
  const IconStub = {
    name: "IconStub",
    template: "<span />",
  };

  return {
    __esModule: true,
    XMarkIcon: IconStub,
    DocumentIcon: IconStub,
    ArrowTopRightOnSquareIcon: IconStub,
  };
});

const TransitionRootStub = {
  name: "TransitionRoot",
  props: ["show"],
  template: "<div v-if='show'><slot /></div>",
};

const TransitionChildStub = {
  name: "TransitionChild",
  template: "<div><slot /></div>",
};

const DialogStub = {
  name: "Dialog",
  template: "<div><slot /></div>",
};

const DialogPanelStub = {
  name: "DialogPanel",
  template: "<div><slot /></div>",
};

const DialogTitleStub = {
  name: "DialogTitle",
  template: "<div><slot /></div>",
};

const modalStubs = {
  TransitionRoot: TransitionRootStub,
  TransitionChild: TransitionChildStub,
  Dialog: DialogStub,
  DialogPanel: DialogPanelStub,
  DialogTitle: DialogTitleStub,
};

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const buildPost = (overrides = {}) => ({
  id: 1,
  title: "Post",
  content: "Content",
  link_name: "",
  link_url: "",
  is_pinned: false,
  is_active: true,
  ...overrides,
});

const mountModal = async ({ pinia = createPinia(), props = {} } = {}) => {
  setActivePinia(pinia);

  const wrapper = mount(PostFormModal, {
    props: {
      visible: true,
      post: null,
      organizationId: 10,
      ...props,
    },
    global: {
      plugins: [pinia],
      stubs: modalStubs,
    },
  });

  await flushPromises();

  return wrapper;
};

const openLinkSection = async (wrapper) => {
  const toggleLinkBtn = wrapper
    .findAll("button")
    .find((b) => (b.text() || "").includes("Agregar enlace"));

  if (!toggleLinkBtn) {
    throw new Error("Agregar enlace button not found");
  }

  await toggleLinkBtn.trigger("click");
  await flushPromises();
};

describe("PostFormModal.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  test("submit button enables when title/content are valid", async () => {
    const wrapper = await mountModal();

    const submitBtn = wrapper.find('button[type="submit"]');
    expect(submitBtn.attributes("disabled")).toBeDefined();

    await wrapper.find("input#title").setValue("  Title  ");
    await flushPromises();
    expect(submitBtn.attributes("disabled")).toBeDefined();

    await wrapper.find("textarea#content").setValue("  Content  ");
    await flushPromises();

    expect(submitBtn.attributes("disabled")).toBeUndefined();
  });

  test("link fields require both values to keep submit enabled", async () => {
    const wrapper = await mountModal();
    const submitBtn = wrapper.find('button[type="submit"]');

    await wrapper.find("input#title").setValue("Title");
    await wrapper.find("textarea#content").setValue("Content");
    await flushPromises();

    await openLinkSection(wrapper);

    await wrapper.find("input#link_name").setValue("Ver");
    await flushPromises();
    const disabledAfterName = submitBtn.attributes("disabled");

    await wrapper.find("input#link_url").setValue("https://example.com");
    await flushPromises();

    expect([disabledAfterName !== undefined, submitBtn.attributes("disabled") === undefined]).toEqual([
      true,
      true,
    ]);
  });

  test("link mismatch triggers warning and does not call store", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationPostsStore();
    const createSpy = jest.spyOn(store, "createPost").mockResolvedValue({ id: 123 });

    const wrapper = mount(PostFormModal, {
      props: {
        visible: true,
        post: null,
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await flushPromises();

    await wrapper.find("input#title").setValue("Title");
    await wrapper.find("textarea#content").setValue("Content");

    const toggleLinkBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Agregar enlace"));

    await toggleLinkBtn.trigger("click");
    await flushPromises();

    await wrapper.find("input#link_name").setValue("Ver");
    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Si agregas un enlace, tanto el texto como la URL son obligatorios",
      "warning"
    );
    expect(createSpy).not.toHaveBeenCalled();
  });

  test("create flow: calls createPost, notifies success and emits saved", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationPostsStore();
    const createSpy = jest.spyOn(store, "createPost").mockResolvedValue({ post: { id: 50 } });

    const wrapper = mount(PostFormModal, {
      props: {
        visible: true,
        post: null,
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await flushPromises();

    await wrapper.find("input#title").setValue("  Title  ");
    await wrapper.find("textarea#content").setValue("  Content  ");

    await wrapper.find("input#is_pinned").setChecked();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith(10, {
      title: "Title",
      content: "Content",
      is_pinned: true,
    });

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Post creado exitosamente",
      "success"
    );

    expect(wrapper.emitted("saved")).toBeTruthy();
    expect(wrapper.emitted("saved")[0]).toEqual([{ post: { id: 50 } }]);
  });

  test("edit flow populates fields and shows link/is_active inputs", async () => {
    const wrapper = await mountModal({
      props: {
        visible: false,
        post: buildPost({
          id: 6,
          title: "Old",
          content: "OldC",
          link_name: "Doc",
          link_url: "https://x.com",
          is_pinned: false,
          is_active: false,
        }),
      },
    });

    await wrapper.setProps({ visible: true });
    await flushPromises();

    expect([
      wrapper.find("input#title").element.value,
      wrapper.find("textarea#content").element.value,
    ]).toEqual(["Old", "OldC"]);
    expect([
      wrapper.find("input#link_name").exists(),
      wrapper.find("input#link_url").exists(),
      wrapper.find("input#is_active").exists(),
    ]).toEqual([true, true, true]);
  });

  test("edit flow submits updatePost, notifies, and emits saved", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationPostsStore();
    const updateSpy = jest.spyOn(store, "updatePost").mockResolvedValue({ post: { id: 60 } });

    const wrapper = await mountModal({
      pinia,
      props: {
        visible: false,
        post: buildPost({
          id: 6,
          title: "Old",
          content: "OldC",
          link_name: "Doc",
          link_url: "https://x.com",
          is_pinned: false,
          is_active: false,
        }),
      },
    });

    await wrapper.setProps({ visible: true });
    await flushPromises();

    await wrapper.find("input#is_active").setChecked();
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(updateSpy).toHaveBeenCalledWith(10, 6, {
      title: "Old",
      content: "OldC",
      is_pinned: false,
      link_name: "Doc",
      link_url: "https://x.com",
      is_active: true,
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Post actualizado exitosamente",
      "success"
    );
    expect(wrapper.emitted("saved")).toBeTruthy();
  });

  test("edit flow uses fallback values when post fields are empty", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(PostFormModal, {
      props: {
        visible: false,
        post: buildPost({
          id: 9,
          title: "",
          content: "",
          link_name: "",
          link_url: "",
          is_pinned: false,
          is_active: undefined,
        }),
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await flushPromises();

    await wrapper.setProps({ visible: true });
    await flushPromises();

    expect(wrapper.find("input#title").element.value).toBe("");
    expect(wrapper.find("textarea#content").element.value).toBe("");
    expect(wrapper.find("input#link_name").exists()).toBe(false);
    expect(wrapper.find("input#link_url").exists()).toBe(false);

    const isActive = wrapper.find("input#is_active");
    expect(isActive.exists()).toBe(true);
    expect(isActive.element.checked).toBe(true);
  });

  test("resetForm shows link inputs for editing post", async () => {
    const wrapper = await mountModal({
      props: {
        visible: false,
        post: buildPost({
          title: "Editing",
          content: "Editing content",
          link_name: "Link",
          link_url: "https://example.com",
          is_pinned: true,
          is_active: false,
        }),
      },
    });

    await wrapper.setProps({ visible: true });
    await flushPromises();

    expect(wrapper.find("input#link_name").exists()).toBe(true);
  });

  test("resetForm clears fields when post is removed", async () => {
    const wrapper = await mountModal({
      props: {
        post: buildPost({
          title: "Editing",
          content: "Editing content",
          link_name: "Link",
          link_url: "https://example.com",
          is_pinned: true,
          is_active: false,
        }),
      },
    });

    await wrapper.setProps({ post: null });
    await flushPromises();

    expect([
      wrapper.find("input#title").element.value,
      wrapper.find("textarea#content").element.value,
      wrapper.find("input#link_name").exists(),
      wrapper.find("input#link_url").exists(),
      wrapper.find("input#is_active").exists(),
      wrapper.find("input#is_pinned").element.checked,
    ]).toEqual(["", "", false, false, false, false]);
  });

  test("link section toggles and preview reflects link and pinned", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(PostFormModal, {
      props: {
        visible: true,
        post: null,
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await flushPromises();

    const toggleLinkBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Agregar enlace"));
    await toggleLinkBtn.trigger("click");
    await flushPromises();

    expect(wrapper.find("input#link_name").exists()).toBe(true);

    await wrapper.find("input#title").setValue("My title");
    await wrapper.find("textarea#content").setValue("My content");
    await wrapper.find("input#is_pinned").setChecked();
    await wrapper.find("input#link_name").setValue("Ver más");
    await wrapper.find("input#link_url").setValue("https://example.com");
    await flushPromises();

    expect(wrapper.text()).toContain("Vista Previa");
    expect(wrapper.text()).toContain("Fijado");
    expect(wrapper.text()).toContain("Ver más");
  });

  test("resetForm when visible toggles and post changes", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(PostFormModal, {
      props: {
        visible: false,
        post: null,
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await flushPromises();

    await wrapper.setProps({
      visible: true,
      post: buildPost({ title: "A", content: "B" }),
    });
    await flushPromises();

    expect(wrapper.find("input#title").element.value).toBe("A");

    await wrapper.setProps({
      post: buildPost({ title: "C", content: "D", link_name: "Link", link_url: "https://x.com" }),
    });
    await flushPromises();

    expect(wrapper.find("input#title").element.value).toBe("C");
    expect(wrapper.find("input#link_name").exists()).toBe(true);
  });

  test("error with response.data.details displays field errors", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationPostsStore();
    jest.spyOn(store, "createPost").mockRejectedValue({
      response: {
        data: {
          details: {
            title: ["Title invalid"],
          },
        },
      },
    });

    const wrapper = mount(PostFormModal, {
      props: {
        visible: true,
        post: null,
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await flushPromises();

    await wrapper.find("input#title").setValue("Title");
    await wrapper.find("textarea#content").setValue("Content");

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(wrapper.text()).toContain("Title invalid");
  });

  test("error with response.data.error shows error notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationPostsStore();
    jest.spyOn(store, "createPost").mockRejectedValue({
      response: {
        data: {
          error: "Custom error",
        },
      },
    });

    const wrapper = mount(PostFormModal, {
      props: {
        visible: true,
        post: null,
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await flushPromises();

    await wrapper.find("input#title").setValue("Title");
    await wrapper.find("textarea#content").setValue("Content");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith("Custom error", "error");
  });

  test("generic error shows default create error notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationPostsStore();
    jest.spyOn(store, "createPost").mockRejectedValue({});

    const wrapper = mount(PostFormModal, {
      props: {
        visible: true,
        post: null,
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await flushPromises();

    await wrapper.find("input#title").setValue("Title");
    await wrapper.find("textarea#content").setValue("Content");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith("Error al crear el post", "error");
  });

  test("generic error shows default update error notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useOrganizationPostsStore();
    jest.spyOn(store, "updatePost").mockRejectedValue({});

    const wrapper = mount(PostFormModal, {
      props: {
        visible: true,
        post: buildPost({ id: 12, title: "Title", content: "Content" }),
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await flushPromises();

    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith("Error al actualizar el post", "error");
  });

  test("handleClose does not emit when submitting", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(PostFormModal, {
      props: {
        visible: true,
        post: null,
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await flushPromises();

    wrapper.vm.isSubmitting = true;
    await wrapper.vm.$nextTick();

    const closeBtn = wrapper.find("button");
    expect(closeBtn.exists()).toBe(true);

    await closeBtn.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("close")).toBeFalsy();
  });

  test("cancel emits close", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(PostFormModal, {
      props: {
        visible: true,
        post: null,
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TransitionRoot: TransitionRootStub,
          TransitionChild: TransitionChildStub,
          Dialog: DialogStub,
          DialogPanel: DialogPanelStub,
          DialogTitle: DialogTitleStub,
        },
      },
    });

    await flushPromises();

    const cancelBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Cancelar"));

    expect(cancelBtn).toBeTruthy();

    await cancelBtn.trigger("click");
    await flushPromises();

    expect(wrapper.emitted("close")).toBeTruthy();
  });
});
