import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";

import { useOrganizationPostsStore } from "@/stores/organization_posts";

import CorporateOrganizationPostsSection from "@/components/organizations/corporate_client/sections/OrganizationPostsSection.vue";

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
    DocumentIcon: IconStub,
    PlusIcon: IconStub,
    InformationCircleIcon: IconStub,
  };
});

const flushPromises = async () => {
  await Promise.resolve();
  await nextTick();
};

const CorporatePostCardStub = {
  name: "CorporatePostCard",
  props: ["post", "organizationId"],
  template: `
    <div data-test="post-card">
      <span data-test="post-title">{{ post.title }}</span>
      <button type="button" data-test="edit" @click="$emit('edit', post)">edit</button>
      <button type="button" data-test="delete" @click="$emit('delete', post)">delete</button>
      <button type="button" data-test="toggle-pin" @click="$emit('toggle-pin', post)">pin</button>
      <button type="button" data-test="toggle-status" @click="$emit('toggle-status', post)">status</button>
    </div>
  `,
};

const PostFormModalStub = {
  name: "PostFormModal",
  props: ["visible", "post", "organizationId"],
  template: `
    <div v-if="visible" data-test="post-form-modal">
      <span data-test="modal-post-title">{{ post ? post.title : 'new' }}</span>
      <button type="button" data-test="modal-close" @click="$emit('close')">close</button>
      <button type="button" data-test="modal-saved" @click="$emit('saved')">saved</button>
    </div>
  `,
};

const ConfirmationModalStub = {
  name: "ConfirmationModal",
  props: ["visible", "title", "message", "isLoading"],
  template: `
    <div v-if="visible" data-test="confirm-modal">
      <span data-test="confirm-title">{{ title }}</span>
      <button type="button" data-test="confirm" @click="$emit('confirm')">confirm</button>
      <button type="button" data-test="cancel" @click="$emit('cancel')">cancel</button>
    </div>
  `,
};

const buildPost = (overrides = {}) => ({
  id: 1,
  title: "Post 1",
  content: "Content",
  is_pinned: false,
  is_active: true,
  created_at: "2026-02-01T00:00:00.000Z",
  ...overrides,
});

describe("corporate_client/sections/OrganizationPostsSection.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
  });

  test("onMounted loads posts via store.getManagementPosts", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const postsStore = useOrganizationPostsStore();
    const getSpy = jest
      .spyOn(postsStore, "getManagementPosts")
      .mockResolvedValue({ results: [] });

    postsStore.$patch({ managementPosts: [buildPost({ id: 1 })] });

    mount(CorporateOrganizationPostsSection, {
      props: {
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          CorporatePostCard: CorporatePostCardStub,
          PostFormModal: PostFormModalStub,
          ConfirmationModal: ConfirmationModalStub,
        },
      },
    });

    await flushPromises();

    expect(getSpy).toHaveBeenCalledWith(10);
  });

  test("loadPosts error shows notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const postsStore = useOrganizationPostsStore();
    jest.spyOn(postsStore, "getManagementPosts").mockRejectedValue(new Error("fail"));

    mount(CorporateOrganizationPostsSection, {
      props: {
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          CorporatePostCard: CorporatePostCardStub,
          PostFormModal: PostFormModalStub,
          ConfirmationModal: ConfirmationModalStub,
        },
      },
    });

    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al cargar los posts",
      "error"
    );
  });

  test("open create modal shows PostFormModal with selectedPost=null; close resets", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const postsStore = useOrganizationPostsStore();
    jest.spyOn(postsStore, "getManagementPosts").mockResolvedValue({ results: [] });

    const wrapper = mount(CorporateOrganizationPostsSection, {
      props: {
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          CorporatePostCard: CorporatePostCardStub,
          PostFormModal: PostFormModalStub,
          ConfirmationModal: ConfirmationModalStub,
        },
      },
    });

    await flushPromises();

    const newBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Nuevo Post"));

    expect(newBtn).toBeTruthy();

    await newBtn.trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-test='post-form-modal']").exists()).toBe(true);
    expect(wrapper.find("[data-test='modal-post-title']").text()).toBe("new");

    await wrapper.find("[data-test='modal-close']").trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-test='post-form-modal']").exists()).toBe(false);
  });

  test("edit flow: CorporatePostCard emits edit, opens modal with selected post", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const postsStore = useOrganizationPostsStore();
    jest.spyOn(postsStore, "getManagementPosts").mockResolvedValue({ results: [] });

    postsStore.$patch({
      managementPosts: [buildPost({ id: 1, title: "P1" }), buildPost({ id: 2, title: "P2" })],
    });

    const wrapper = mount(CorporateOrganizationPostsSection, {
      props: {
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          CorporatePostCard: CorporatePostCardStub,
          PostFormModal: PostFormModalStub,
          ConfirmationModal: ConfirmationModalStub,
        },
      },
    });

    await flushPromises();

    await wrapper.findAll("[data-test='edit']")[0].trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-test='post-form-modal']").exists()).toBe(true);
    expect(wrapper.find("[data-test='modal-post-title']").text()).toBe("P1");
  });

  test("delete flow: emits delete -> opens confirmation; confirm calls deletePost and notifies", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const postsStore = useOrganizationPostsStore();
    jest.spyOn(postsStore, "getManagementPosts").mockResolvedValue({ results: [] });

    const deleteSpy = jest.spyOn(postsStore, "deletePost").mockResolvedValue({ ok: true });

    postsStore.$patch({ managementPosts: [buildPost({ id: 5, title: "To Delete" })] });

    const wrapper = mount(CorporateOrganizationPostsSection, {
      props: {
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          CorporatePostCard: CorporatePostCardStub,
          PostFormModal: PostFormModalStub,
          ConfirmationModal: ConfirmationModalStub,
        },
      },
    });

    await flushPromises();

    await wrapper.find("[data-test='delete']").trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-test='confirm-modal']").exists()).toBe(true);
    expect(wrapper.find("[data-test='confirm-title']").text()).toContain("To Delete");

    await wrapper.find("[data-test='confirm']").trigger("click");
    await flushPromises();

    expect(deleteSpy).toHaveBeenCalledWith(10, 5);
    expect(mockShowNotification).toHaveBeenCalledWith(
      'Post "To Delete" eliminado exitosamente',
      "success"
    );

    expect(wrapper.find("[data-test='confirm-modal']").exists()).toBe(false);
  });

  test("delete error shows error notification and keeps confirmation modal open", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const postsStore = useOrganizationPostsStore();
    jest.spyOn(postsStore, "getManagementPosts").mockResolvedValue({ results: [] });

    jest.spyOn(postsStore, "deletePost").mockRejectedValue(new Error("fail"));

    postsStore.$patch({ managementPosts: [buildPost({ id: 5, title: "To Delete" })] });

    const wrapper = mount(CorporateOrganizationPostsSection, {
      props: {
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          CorporatePostCard: CorporatePostCardStub,
          PostFormModal: PostFormModalStub,
          ConfirmationModal: ConfirmationModalStub,
        },
      },
    });

    await flushPromises();

    await wrapper.find("[data-test='delete']").trigger("click");
    await flushPromises();

    await wrapper.find("[data-test='confirm']").trigger("click");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith("Error al eliminar el post", "error");
    expect(wrapper.find("[data-test='confirm-modal']").exists()).toBe(true);
  });

  test("toggle pin/status call store and show success notification", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const postsStore = useOrganizationPostsStore();
    jest.spyOn(postsStore, "getManagementPosts").mockResolvedValue({ results: [] });

    const togglePinSpy = jest.spyOn(postsStore, "togglePinPost").mockResolvedValue({ ok: true });
    const toggleStatusSpy = jest.spyOn(postsStore, "togglePostStatus").mockResolvedValue({ ok: true });

    postsStore.$patch({ managementPosts: [buildPost({ id: 7, title: "P" })] });

    const wrapper = mount(CorporateOrganizationPostsSection, {
      props: {
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          CorporatePostCard: CorporatePostCardStub,
          PostFormModal: PostFormModalStub,
          ConfirmationModal: ConfirmationModalStub,
        },
      },
    });

    await flushPromises();

    await wrapper.find("[data-test='toggle-pin']").trigger("click");
    await flushPromises();

    expect(togglePinSpy).toHaveBeenCalledWith(10, 7);
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Post fijado exitosamente",
      "success"
    );

    await wrapper.find("[data-test='toggle-status']").trigger("click");
    await flushPromises();

    expect(toggleStatusSpy).toHaveBeenCalledWith(10, 7);
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Post desactivado exitosamente",
      "success"
    );
  });

  test("toggle pin/status errors show error notifications", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const postsStore = useOrganizationPostsStore();
    jest.spyOn(postsStore, "getManagementPosts").mockResolvedValue({ results: [] });

    jest.spyOn(postsStore, "togglePinPost").mockRejectedValue(new Error("fail"));
    jest.spyOn(postsStore, "togglePostStatus").mockRejectedValue(new Error("fail"));

    postsStore.$patch({ managementPosts: [buildPost({ id: 7, title: "P" })] });

    const wrapper = mount(CorporateOrganizationPostsSection, {
      props: {
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          CorporatePostCard: CorporatePostCardStub,
          PostFormModal: PostFormModalStub,
          ConfirmationModal: ConfirmationModalStub,
        },
      },
    });

    await flushPromises();

    await wrapper.find("[data-test='toggle-pin']").trigger("click");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al cambiar el estado de fijado",
      "error"
    );

    await wrapper.find("[data-test='toggle-status']").trigger("click");
    await flushPromises();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al cambiar el estado del post",
      "error"
    );
  });

  test("saved event closes modal and reloads posts", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const postsStore = useOrganizationPostsStore();
    const getSpy = jest
      .spyOn(postsStore, "getManagementPosts")
      .mockResolvedValue({ results: [] });

    const wrapper = mount(CorporateOrganizationPostsSection, {
      props: {
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          CorporatePostCard: CorporatePostCardStub,
          PostFormModal: PostFormModalStub,
          ConfirmationModal: ConfirmationModalStub,
        },
      },
    });

    await flushPromises();

    getSpy.mockClear();

    const newBtn = wrapper
      .findAll("button")
      .find((b) => (b.text() || "").includes("Nuevo Post"));

    await newBtn.trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-test='post-form-modal']").exists()).toBe(true);

    await wrapper.find("[data-test='modal-saved']").trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-test='post-form-modal']").exists()).toBe(false);
    expect(getSpy).toHaveBeenCalledWith(10);
  });

  test("watch organizationId reloads posts", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const postsStore = useOrganizationPostsStore();
    const getSpy = jest
      .spyOn(postsStore, "getManagementPosts")
      .mockResolvedValue({ results: [] });

    const wrapper = mount(CorporateOrganizationPostsSection, {
      props: {
        organizationId: 10,
      },
      global: {
        plugins: [pinia],
        stubs: {
          CorporatePostCard: CorporatePostCardStub,
          PostFormModal: PostFormModalStub,
          ConfirmationModal: ConfirmationModalStub,
        },
      },
    });

    await flushPromises();

    getSpy.mockClear();

    await wrapper.setProps({ organizationId: 20 });
    await flushPromises();

    expect(getSpy).toHaveBeenCalledWith(20);
  });
});
