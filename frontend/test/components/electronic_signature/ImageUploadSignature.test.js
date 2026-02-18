import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { Blob as NodeBlob } from "buffer";

import { useUserStore } from "@/stores/auth/user";
import ImageUploadSignature from "@/components/electronic_signature/ImageUploadSignature.vue";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const findButtonByText = (wrapper, text) => {
  const btn = wrapper
    .findAll("button")
    .find((b) => (b.text() || "").trim().includes(text));
  if (!btn) throw new Error(`Button not found: ${text}`);
  return btn;
};

describe("ImageUploadSignature.vue", () => {
  const originalFileReader = global.FileReader;

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

    global.FileReader = class FileReader {
      onload = null;
      readAsDataURL() {
        if (this.onload) {
          this.onload({ target: { result: "data:image/png;base64,QQ==" } });
        }
      }
    };

    if (typeof globalThis.alert !== "function") {
      globalThis.alert = () => {};
    }
  });

  afterEach(() => {
    global.FileReader = originalFileReader;
  });

  test("emits cancel when clicking 'Volver'", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(ImageUploadSignature, {
      global: { plugins: [pinia] },
    });

    await findButtonByText(wrapper, "Volver").trigger("click");

    expect(wrapper.emitted("cancel")).toBeTruthy();
  });

  test("validates file size and shows alert when too large", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const alertSpy = jest.spyOn(globalThis, "alert").mockImplementation(() => {});

    const wrapper = mount(ImageUploadSignature, {
      global: { plugins: [pinia] },
    });

    const bigFile = new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.png", { type: "image/png" });

    const input = wrapper.find("input[type='file']");
    Object.defineProperty(input.element, "files", {
      value: [bigFile],
      configurable: true,
    });
    await input.trigger("change");

    expect(alertSpy).toHaveBeenCalled();
    expect(wrapper.find("img[alt='Firma']").exists()).toBe(false);

    alertSpy.mockRestore();
  });

  test("handleFileChange returns early when no file selected", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(ImageUploadSignature, {
      global: { plugins: [pinia] },
    });

    const input = wrapper.find("input[type='file']");
    Object.defineProperty(input.element, "files", {
      value: [],
      configurable: true,
    });
    await input.trigger("change");

    expect(wrapper.find("img[alt='Firma']").exists()).toBe(false);
  });

  test("validates file type and shows alert when invalid", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const alertSpy = jest.spyOn(globalThis, "alert").mockImplementation(() => {});

    const wrapper = mount(ImageUploadSignature, {
      global: { plugins: [pinia] },
    });

    const badType = new File([new Uint8Array(100)], "bad.gif", { type: "image/gif" });

    const input = wrapper.find("input[type='file']");
    Object.defineProperty(input.element, "files", {
      value: [badType],
      configurable: true,
    });
    await input.trigger("change");

    expect(alertSpy).toHaveBeenCalled();
    expect(wrapper.find("img[alt='Firma']").exists()).toBe(false);

    alertSpy.mockRestore();
  });

  const setupValidUpload = async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const userStore = useUserStore();
    userStore.$patch({ userSignature: null });

    const wrapper = mount(ImageUploadSignature, {
      global: { plugins: [pinia] },
    });

    const okFile = new File([new Uint8Array(100)], "sig.png", { type: "image/png" });

    const input = wrapper.find("input[type='file']");
    Object.defineProperty(input.element, "files", {
      value: [okFile],
      configurable: true,
    });
    await input.trigger("change");

    await flushPromises();

    return { wrapper, userStore, okFile };
  };

  test("on valid file shows preview and updates store", async () => {
    const { wrapper, userStore } = await setupValidUpload();

    const img = wrapper.find("img[alt='Firma']");
    expect(img.exists()).toBe(true);

    await findButtonByText(wrapper, "Guardar").trigger("click");

    expect(userStore.userSignature.has_signature).toBe(true);
    expect(userStore.userSignature.signature.method).toBe("upload");
  });

  test("on valid file emits save payload", async () => {
    const { wrapper } = await setupValidUpload();

    await findButtonByText(wrapper, "Guardar").trigger("click");

    const emitted = wrapper.emitted("save");
    const payload = emitted[0][0];

    expect(emitted).toBeTruthy();
    expect([payload.signatureImage, payload.originalFile?.name, payload.traceabilityData.method]).toEqual([
      "data:image/png;base64,QQ==",
      "sig.png",
      "upload",
    ]);
  });

  test("triggerFileInput calls click on file input element when clicking upload area", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(ImageUploadSignature, {
      global: { plugins: [pinia] },
    });

    const input = wrapper.find("input[type='file']");
    const clickSpy = jest.spyOn(input.element, "click");

    const uploadArea = wrapper.find(".border-dashed");
    await uploadArea.trigger("click");

    expect(clickSpy).toHaveBeenCalled();
  });

  test("clearImage resets preview and file input when clicking X button", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(ImageUploadSignature, {
      global: { plugins: [pinia] },
    });

    const okFile = new File([new Uint8Array(100)], "sig.png", { type: "image/png" });

    const input = wrapper.find("input[type='file']");
    Object.defineProperty(input.element, "files", {
      value: [okFile],
      configurable: true,
    });
    await input.trigger("change");
    await flushPromises();

    expect(wrapper.find("img[alt='Firma']").exists()).toBe(true);

    const clearBtn = wrapper.find(".bg-red-100");
    await clearBtn.trigger("click");
    await flushPromises();

    expect(wrapper.find("img[alt='Firma']").exists()).toBe(false);
    expect(input.element.value).toBe("");
  });

  test("saveSignature logs error when preview is missing", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    const wrapper = mount(ImageUploadSignature, {
      global: { plugins: [pinia] },
    });

    wrapper.vm.$.setupState.saveSignature();

    expect(errorSpy).toHaveBeenCalledWith("No preview URL available");
    expect(wrapper.emitted("save")).toBeFalsy();

    errorSpy.mockRestore();
  });
});
