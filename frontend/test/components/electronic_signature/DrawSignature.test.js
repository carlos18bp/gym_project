import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { Blob as NodeBlob } from "buffer";

import { useUserStore } from "@/stores/auth/user";
import DrawSignature from "@/components/electronic_signature/DrawSignature.vue";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const findButtonByText = (wrapper, text) => {
  const btn = wrapper
    .findAll("button")
    .find((b) => (b.text() || "").trim().includes(text));
  if (!btn) throw new Error(`Button not found: ${text}`);
  return btn;
};

const setupDrawSignature = async () => {
  const pinia = createPinia();
  setActivePinia(pinia);

  const userStore = useUserStore();
  userStore.$patch({ userSignature: null });

  const wrapper = mount(DrawSignature, {
    global: { plugins: [pinia] },
  });

  const canvas = wrapper.find("canvas");
  await canvas.trigger("mousedown", { offsetX: 10, offsetY: 10 });
  await canvas.trigger("mousemove", { offsetX: 20, offsetY: 20 });
  await canvas.trigger("mouseup");
  await flushPromises();

  return { wrapper, userStore };
};

describe("DrawSignature.vue", () => {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
  const originalGetBoundingClientRect = HTMLCanvasElement.prototype.getBoundingClientRect;

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

    HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
      width: 300,
      height: 150,
      top: 0,
      left: 0,
      right: 300,
      bottom: 150,
    });

    HTMLCanvasElement.prototype.getContext = () => ({
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fillRect: jest.fn(),
      set fillStyle(_v) {},
      set strokeStyle(_v) {},
      set lineWidth(_v) {},
      set lineCap(_v) {},
      set lineJoin(_v) {},
    });

    HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,QQ==";
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
    HTMLCanvasElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  test("emits cancel when clicking 'Volver'", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(DrawSignature, {
      global: { plugins: [pinia] },
    });

    await findButtonByText(wrapper, "Volver").trigger("click");

    expect(wrapper.emitted("cancel")).toBeTruthy();
  });

  test("save button is disabled until user draws", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(DrawSignature, {
      global: { plugins: [pinia] },
    });

    const saveBtn = findButtonByText(wrapper, "Guardar");
    expect(saveBtn.attributes("disabled")).toBeDefined();
  });

  test("draw returns early when not drawing and does not call lineTo", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const lineTo = jest.fn();
    const fillRect = jest.fn();

    HTMLCanvasElement.prototype.getContext = () => ({
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo,
      stroke: jest.fn(),
      fillRect,
    });

    const wrapper = mount(DrawSignature, {
      global: { plugins: [pinia] },
    });

    await flushPromises();

    wrapper.vm.$.setupState.draw({ offsetX: 10, offsetY: 20 });

    expect(lineTo).not.toHaveBeenCalled();
  });

  test("handleTouchMove returns early when not drawing", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const lineTo = jest.fn();

    HTMLCanvasElement.prototype.getContext = () => ({
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo,
      stroke: jest.fn(),
      fillRect: jest.fn(),
    });

    const wrapper = mount(DrawSignature, {
      global: { plugins: [pinia] },
    });

    const preventDefault = jest.fn();

    wrapper.vm.$.setupState.handleTouchMove({ preventDefault, touches: [] });

    expect(preventDefault).toHaveBeenCalled();
    expect(lineTo).not.toHaveBeenCalled();
  });

  test("clearCanvas fills canvas when context exists", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const fillRect = jest.fn();

    HTMLCanvasElement.prototype.getContext = () => ({
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fillRect,
    });

    const wrapper = mount(DrawSignature, {
      global: { plugins: [pinia] },
    });

    wrapper.vm.$.setupState.hasDrawn = true;
    wrapper.vm.$.setupState.clearCanvas();

    expect(fillRect).toHaveBeenCalled();
    expect(wrapper.vm.$.setupState.hasDrawn).toBe(false);
  });

  test("draw ignores mouse moves when not drawing", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(DrawSignature, {
      global: { plugins: [pinia] },
    });

    const canvas = wrapper.find("canvas");
    await canvas.trigger("mousemove", { offsetX: 20, offsetY: 20 });

    expect(wrapper.vm.$.setupState.hasDrawn).toBe(false);
    const saveBtn = findButtonByText(wrapper, "Guardar");
    expect(saveBtn.attributes("disabled")).toBeDefined();
  });

  test("after drawing enables save and updates store", async () => {
    const { wrapper, userStore } = await setupDrawSignature();

    const saveBtn = findButtonByText(wrapper, "Guardar");
    expect(saveBtn.attributes("disabled")).toBeUndefined();

    await saveBtn.trigger("click");

    expect(userStore.userSignature.has_signature).toBe(true);
    expect(userStore.userSignature.signature.method).toBe("draw");
  });

  test("after drawing emits save payload", async () => {
    const { wrapper } = await setupDrawSignature();

    await findButtonByText(wrapper, "Guardar").trigger("click");

    const emitted = wrapper.emitted("save");
    expect(emitted).toBeTruthy();

    const payload = emitted[0][0];
    expect(payload.signatureImage).toBe("data:image/png;base64,QQ==");
    expect(payload.traceabilityData.method).toBe("draw");
  });

  test("touch drawing: handleTouchStart and handleTouchMove enable drawing on mobile", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(DrawSignature, {
      global: { plugins: [pinia] },
    });

    const canvas = wrapper.find("canvas");

    const touchStart = new Event("touchstart", { cancelable: true });
    Object.defineProperty(touchStart, "touches", {
      value: [{ clientX: 15, clientY: 15 }],
    });

    const touchMove = new Event("touchmove", { cancelable: true });
    Object.defineProperty(touchMove, "touches", {
      value: [{ clientX: 25, clientY: 25 }],
    });

    canvas.element.dispatchEvent(touchStart);
    canvas.element.dispatchEvent(touchMove);
    await canvas.trigger("touchend");

    await flushPromises();

    const saveBtn = findButtonByText(wrapper, "Guardar");
    expect(saveBtn.attributes("disabled")).toBeUndefined();
  });

  test("touch move without drawing keeps save disabled", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(DrawSignature, {
      global: { plugins: [pinia] },
    });

    const canvas = wrapper.find("canvas");
    const touchMove = new Event("touchmove", { cancelable: true });
    Object.defineProperty(touchMove, "touches", {
      value: [{ clientX: 25, clientY: 25 }],
    });

    canvas.element.dispatchEvent(touchMove);
    await flushPromises();

    expect(wrapper.vm.$.setupState.hasDrawn).toBe(false);
    const saveBtn = findButtonByText(wrapper, "Guardar");
    expect(saveBtn.attributes("disabled")).toBeDefined();
  });

  test("clearCanvas returns early when context is falsy", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const props = ["strokeStyle", "lineWidth", "lineCap", "lineJoin"];
    const originalDescriptors = Object.fromEntries(
      props.map((prop) => [prop, Object.getOwnPropertyDescriptor(Number.prototype, prop)])
    );

    props.forEach((prop) => {
      Object.defineProperty(Number.prototype, prop, {
        configurable: true,
        set() {},
      });
    });

    HTMLCanvasElement.prototype.getContext = () => 0;

    const wrapper = mount(DrawSignature, {
      global: { plugins: [pinia] },
    });

    wrapper.vm.$.setupState.hasDrawn = true;
    wrapper.vm.$.setupState.clearCanvas();

    expect(wrapper.vm.$.setupState.hasDrawn).toBe(true);

    props.forEach((prop) => {
      const descriptor = originalDescriptors[prop];
      if (descriptor) {
        Object.defineProperty(Number.prototype, prop, descriptor);
      } else {
        delete Number.prototype[prop];
      }
    });
  });

  test("saveSignature returns early when nothing was drawn", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(DrawSignature, {
      global: { plugins: [pinia] },
    });

    wrapper.vm.$.setupState.saveSignature();

    expect(wrapper.emitted("save")).toBeFalsy();
  });

  test("saveSignature logs error when image data is missing", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    HTMLCanvasElement.prototype.toDataURL = () => "";

    const wrapper = mount(DrawSignature, {
      global: { plugins: [pinia] },
    });

    wrapper.vm.$.setupState.hasDrawn = true;
    wrapper.vm.$.setupState.saveSignature();

    expect(errorSpy).toHaveBeenCalledWith("No signature image data available");
    expect(wrapper.emitted("save")).toBeFalsy();

    errorSpy.mockRestore();
  });

});
