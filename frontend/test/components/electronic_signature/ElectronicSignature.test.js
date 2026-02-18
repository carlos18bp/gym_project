import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { Blob as NodeBlob } from "buffer";
import { h } from "vue";

import { useUserStore } from "@/stores/auth/user";
import { useAuthStore } from "@/stores/auth/auth";

import ElectronicSignature from "@/components/electronic_signature/ElectronicSignature.vue";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const findButtonByText = (wrapper, text) => {
  const btn = wrapper
    .findAll("button")
    .find((b) => (b.text() || "").trim().includes(text));
  if (!btn) {
    throw new Error(`Button not found: ${text}`);
  }
  return btn;
};

describe("ElectronicSignature.vue", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();

    globalThis.Blob = globalThis.Blob || NodeBlob;
    globalThis.File = class File extends globalThis.Blob {
      constructor(chunks, name, options = {}) {
        super(chunks, options);
        this.name = name;
        this.lastModified = options.lastModified || Date.now();
      }
    };

    if (globalThis.window) {
      globalThis.window.Blob = globalThis.Blob;
      globalThis.window.File = globalThis.File;
    }

    if (typeof global.atob === "undefined") {
      global.atob = (b64) => Buffer.from(b64, "base64").toString("binary");
    }
  });

  const mountWithStores = ({
    userSignature = null,
    authUser = { id: 123 },
    props = {},
    updateUserSignatureImpl,
  } = {}) => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    const authStore = useAuthStore();

    userStore.$patch({ userSignature });
    authStore.$patch({ userAuth: authUser });

    const updateSpy = jest
      .spyOn(userStore, "updateUserSignature")
      .mockImplementation(updateUserSignatureImpl || (async () => true));

    const wrapper = mount(ElectronicSignature, {
      props,
      global: {
        plugins: [pinia],
        stubs: {
          SignatureModal: { template: "<div data-test='signature-modal' />" },
          ImageUploadSignature: {
            props: ["isSubmitting"],
            emits: ["save", "cancel"],
            setup(_props, { emit }) {
              return () =>
                h("div", { "data-test": "upload-stub" }, [
                  h(
                    "button",
                    {
                      "data-test": "emit-save",
                      onClick: () =>
                        emit("save", {
                          signatureImage: "data:image/png;base64,QQ==",
                          originalFile: new globalThis.File(["a"], "sig.png", { type: "image/png" }),
                          traceabilityData: {
                            date: "2026-01-31T00:00:00Z",
                            method: "upload",
                          },
                        }),
                    },
                    "save"
                  ),
                  h(
                    "button",
                    { "data-test": "emit-cancel", onClick: () => emit("cancel") },
                    "cancel"
                  ),
                ]);
            },
          },
          DrawSignature: {
            props: ["isSubmitting"],
            emits: ["save", "cancel"],
            setup(_props, { emit }) {
              return () =>
                h("div", { "data-test": "draw-stub" }, [
                  h(
                    "button",
                    {
                      "data-test": "emit-save",
                      onClick: () =>
                        emit("save", {
                          signatureImage: "data:image/png;base64,QQ==",
                          traceabilityData: {
                            date: "2026-01-31T00:00:00Z",
                            method: "draw",
                          },
                        }),
                    },
                    "save"
                  ),
                  h(
                    "button",
                    { "data-test": "emit-cancel", onClick: () => emit("cancel") },
                    "cancel"
                  ),
                ]);
            },
          },
        },
      },
    });

    return { wrapper, userStore, authStore, updateSpy };
  };

  test("renders options when there is no saved signature", () => {
    const { wrapper } = mountWithStores({ userSignature: null, props: { initialShowOptions: true } });

    expect(wrapper.text()).toContain("Añadir firma electrónica");
    expect(wrapper.text()).toContain("Subir imagen");
    expect(wrapper.text()).toContain("Dibujar firma");
  });

  const runUploadFlow = async () => {
    let capturedParams;

    const { wrapper, updateSpy } = mountWithStores({
      userSignature: null,
      authUser: { id: 555 },
      updateUserSignatureImpl: async (params) => {
        capturedParams = params;
        return true;
      },
    });

    await findButtonByText(wrapper, "Subir imagen").trigger("click");
    await wrapper.find("[data-test='upload-stub'] [data-test='emit-save']").trigger("click");
    await flushPromises();

    return { wrapper, updateSpy, capturedParams };
  };

  test("upload flow sends userId and FormData", async () => {
    const { updateSpy, capturedParams } = await runUploadFlow();

    const uploadedFile = capturedParams.formData.get("signature_image");

    expect(updateSpy).toHaveBeenCalled();
    expect([
      capturedParams.userId,
      capturedParams.formData.get("method"),
      uploadedFile?.type,
    ]).toEqual([555, "upload", "image/png"]);
  });

  test("upload flow emits signatureSaved and shows preview", async () => {
    const { wrapper } = await runUploadFlow();

    const img = wrapper.find("img[alt='Firma guardada']");

    expect(wrapper.emitted("signatureSaved")).toBeTruthy();
    expect([img.exists(), img.attributes("src")]).toEqual([
      true,
      "data:image/png;base64,QQ==",
    ]);
  });

  test("draw flow: converts data URL to File and calls updateUserSignature", async () => {
    let capturedParams;

    const { wrapper } = mountWithStores({
      userSignature: null,
      authUser: { id: 777 },
      updateUserSignatureImpl: async (params) => {
        capturedParams = params;
        return true;
      },
    });

    await findButtonByText(wrapper, "Dibujar firma").trigger("click");
    await wrapper.find("[data-test='draw-stub'] [data-test='emit-save']").trigger("click");
    await flushPromises();

    expect(capturedParams.userId).toBe(777);
    expect(capturedParams.formData.get("method")).toBe("draw");

    const uploadedFile = capturedParams.formData.get("signature_image");
    expect(uploadedFile).toBeTruthy();
    expect(typeof uploadedFile).toBe("object");
    expect(uploadedFile.type).toBe("image/png");
  });

  test("shows saved signature preview and 'Cambiar' toggles options", async () => {
    const { wrapper } = mountWithStores({
      userSignature: {
        signature: {
          signature_image: "https://example.com/sig.png",
          method: "upload",
          created_at: "2026-01-31T00:00:00Z",
        },
      },
      props: { initialShowOptions: false },
    });

    const img = wrapper.find("img[alt='Firma guardada']");
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toBe("https://example.com/sig.png");

    await findButtonByText(wrapper, "Cambiar").trigger("click");

    expect(wrapper.text()).toContain("Subir imagen");
    expect(wrapper.text()).toContain("Dibujar firma");
  });

  test("emits cancel when child emits cancel", async () => {
    const { wrapper } = mountWithStores({ userSignature: null, props: { initialShowOptions: true } });

    await findButtonByText(wrapper, "Subir imagen").trigger("click");
    await wrapper.find("[data-test='upload-stub'] [data-test='emit-cancel']").trigger("click");

    expect(wrapper.emitted("cancel")).toBeTruthy();
  });

  test("logs error when there is no user id available", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { wrapper, updateSpy } = mountWithStores({
      userSignature: null,
      authUser: { id: null },
      props: { initialShowOptions: true },
    });

    await findButtonByText(wrapper, "Subir imagen").trigger("click");
    await wrapper.find("[data-test='upload-stub'] [data-test='emit-save']").trigger("click");
    await flushPromises();

    expect(updateSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("logs error when signatureImage data URL is malformed", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { wrapper, updateSpy } = mountWithStores({
      userSignature: null,
      authUser: { id: 123 },
      props: { initialShowOptions: true },
    });

    await wrapper.vm.saveSignature({
      signatureImage: "data:image/png;base64",
      traceabilityData: { method: "draw", date: "2026-01-31T00:00:00Z" },
    });

    expect(updateSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("logs error when signatureImage is not a data URL", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { wrapper, updateSpy } = mountWithStores({
      userSignature: null,
      authUser: { id: 123 },
      props: { initialShowOptions: true },
    });

    await wrapper.vm.saveSignature({
      signatureImage: "not-a-data-url",
      traceabilityData: { method: "draw", date: "2026-01-31T00:00:00Z" },
    });

    expect(updateSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("logs error when signature image data is missing", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const { wrapper, updateSpy } = mountWithStores({
      userSignature: null,
      authUser: { id: 123 },
      props: { initialShowOptions: true },
    });

    await wrapper.vm.saveSignature({
      traceabilityData: { method: "draw", date: "2026-01-31T00:00:00Z" },
    });

    expect(updateSpy).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("displays formatted date and method for saved signature", () => {
    const localeSpy = jest
      .spyOn(Date.prototype, "toLocaleString")
      .mockReturnValue("formatted-date");

    const { wrapper } = mountWithStores({
      userSignature: {
        signature: {
          signature_image: "https://example.com/sig.png",
          method: "draw",
          created_at: "2026-01-31T12:30:00Z",
        },
      },
      props: { initialShowOptions: false },
    });

    expect(wrapper.text()).toContain("formatted-date");
    expect(wrapper.text()).toContain("Dibujada");

    localeSpy.mockRestore();
  });

  test("renders local signature image, date, and upload method", () => {
    const localeSpy = jest
      .spyOn(Date.prototype, "toLocaleString")
      .mockReturnValue("local-date");

    const { wrapper } = mountWithStores({
      userSignature: {
        signatureImage: "data:image/png;base64,QQ==",
        traceabilityData: {
          method: "upload",
          date: "2026-01-10T10:00:00Z",
        },
      },
      props: { initialShowOptions: false },
    });

    const img = wrapper.find("img[alt='Firma guardada']");
    expect(img.exists()).toBe(true);
    expect(img.attributes("src")).toBe("data:image/png;base64,QQ==");
    expect(wrapper.text()).toContain("local-date");
    expect(wrapper.text()).toContain("Subida");

    localeSpy.mockRestore();
  });

  test("child cancel emits parent cancel and closes signature mode", async () => {
    const { wrapper } = mountWithStores({
      userSignature: null,
      props: { initialShowOptions: true },
    });

    await findButtonByText(wrapper, "Dibujar firma").trigger("click");
    await wrapper.find("[data-test='draw-stub'] [data-test='emit-cancel']").trigger("click");
    await flushPromises();

    expect(wrapper.emitted("cancel")).toBeTruthy();
  });

  test("openModal/closeModal toggles SignatureModal", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(ElectronicSignature, {
      props: { initialShowOptions: false },
      global: {
        plugins: [pinia],
        stubs: {
          SignatureModal: {
            emits: ["close"],
            template:
              '<div data-test="modal-opened"><button data-test="close" @click="$emit(\'close\')">close</button></div>',
          },
          ImageUploadSignature: { template: "<div />" },
          DrawSignature: { template: "<div />" },
        },
      },
    });

    await flushPromises();

    expect(wrapper.find("[data-test='modal-opened']").exists()).toBe(false);

    wrapper.vm.openModal();
    await flushPromises();

    expect(wrapper.find("[data-test='modal-opened']").exists()).toBe(true);

    await wrapper.find("[data-test='modal-opened'] [data-test='close']").trigger("click");
    await flushPromises();

    expect(wrapper.find("[data-test='modal-opened']").exists()).toBe(false);
  });
});
