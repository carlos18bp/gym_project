import { mount } from "@vue/test-utils";

import SignatureDocumentCard from "@/components/dynamic_document/cards/SignatureDocumentCard.vue";

const BaseDocumentCardStub = {
  name: "BaseDocumentCard",
  props: [
    "document",
    "statusText",
    "statusBadgeClasses",
    "menuOptions",
    "disableInternalActions",
    "cardType",
    "cardContext",
  ],
  emits: ["click", "refresh", "remove-from-folder"],
  template: `
    <div>
      <div data-test="status-text">{{ statusText }}</div>
      <div data-test="status-classes">{{ statusBadgeClasses }}</div>
      <div data-test="doc-title">{{ document.title }}</div>

      <div data-test="slot-status"><slot name="status-badge" /></div>
      <div data-test="slot-additional"><slot name="additional-badges" /></div>

      <button type="button" data-test="emit-click" @click="$emit('click', document, {})">emit-click</button>
      <button type="button" data-test="emit-refresh" @click="$emit('refresh')">emit-refresh</button>
      <button type="button" data-test="emit-remove" @click="$emit('remove-from-folder', document)">emit-remove</button>
    </div>
  `,
};

describe("SignatureDocumentCard.vue", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("PendingSignatures: shows pending status text/classes and progress badge", () => {
    const wrapper = mount(SignatureDocumentCard, {
      props: {
        document: {
          id: 1,
          title: "Doc",
          state: "PendingSignatures",
          signatures: [
            { id: 1, signed: true },
            { id: 2, signed: false },
          ],
        },
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
        },
      },
    });

    const base = wrapper.findComponent(BaseDocumentCardStub);

    expect(base.props("statusText")).toBe("Pendiente de firmas");
    expect(base.props("statusBadgeClasses")).toContain("bg-yellow-100");

    expect(wrapper.text()).toContain("1/2");
  });

  test("FullySigned: shows signed status text/classes and progress badge", () => {
    const wrapper = mount(SignatureDocumentCard, {
      props: {
        document: {
          id: 1,
          title: "Doc",
          state: "FullySigned",
          signatures: [
            { id: 1, signed: true },
            { id: 2, signed: true },
          ],
        },
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
        },
      },
    });

    const base = wrapper.findComponent(BaseDocumentCardStub);

    expect(base.props("statusText")).toBe("Completamente firmado");
    expect(base.props("statusBadgeClasses")).toContain("bg-green-100");

    expect(wrapper.text()).toContain("2/2");
  });

  test("passes through click/refresh/remove-from-folder events", async () => {
    const doc = {
      id: 1,
      title: "Doc",
      state: "PendingSignatures",
      signatures: [],
    };

    const wrapper = mount(SignatureDocumentCard, {
      props: {
        document: doc,
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
        },
      },
    });

    await wrapper.find("[data-test='emit-click']").trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
    expect(wrapper.emitted("click")[0][0]).toEqual(doc);

    await wrapper.find("[data-test='emit-refresh']").trigger("click");
    expect(wrapper.emitted("refresh")).toBeTruthy();

    await wrapper.find("[data-test='emit-remove']").trigger("click");
    expect(wrapper.emitted("remove-from-folder")).toBeTruthy();
    expect(wrapper.emitted("remove-from-folder")[0][0]).toEqual(doc);
  });

  test("uses provided menuOptions and exposes null statusIcon", () => {
    const menuOptions = [{ label: "Custom" }];

    const wrapper = mount(SignatureDocumentCard, {
      props: {
        document: {
          id: 2,
          title: "Doc",
          state: "PendingSignatures",
          signatures: [],
        },
        menuOptions,
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
        },
      },
    });

    const base = wrapper.findComponent(BaseDocumentCardStub);

    expect(base.props("menuOptions")).toEqual(menuOptions);
    expect(wrapper.vm.$.setupState.statusIcon).toBeNull();
  });

  test("defaults menuOptions to undefined and shows zero signatures when missing", () => {
    const wrapper = mount(SignatureDocumentCard, {
      props: {
        document: {
          id: 3,
          title: "Doc",
          state: "PendingSignatures",
        },
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
        },
      },
    });

    const base = wrapper.findComponent(BaseDocumentCardStub);
    expect(base.props("menuOptions")).toBeUndefined();
    expect(wrapper.text()).toContain("0/0");
  });

  test("helper methods return defaults when signatures are missing", () => {
    const document = {
      id: 4,
      title: "Doc",
      state: "PendingSignatures",
    };

    const wrapper = mount(SignatureDocumentCard, {
      props: {
        document,
        menuOptions: null,
      },
      global: {
        stubs: {
          BaseDocumentCard: BaseDocumentCardStub,
        },
      },
    });

    const { menuOptions, getTotalSignatures, getCompletedSignatures } = wrapper.vm.$.setupState;

    expect(menuOptions).toBeUndefined();
    expect(getTotalSignatures(document)).toBe(0);
    expect(getCompletedSignatures(document)).toBe(0);
  });
});
