import { defineComponent, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { useGuideOrbit } from '@/composables/useGuideOrbit';

let wrapper;
let orbit;
let media;
let tour;
let width;
let resize;
let frames;
let originalObserver;
let originalMatchMedia;

beforeEach(() => {
  frames = new Map();
  width = 1200;
  tour = ref(false);
  originalObserver = window.ResizeObserver;
  originalMatchMedia = window.matchMedia;
  media = { matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() };
  window.matchMedia = jest.fn(() => media);
  window.ResizeObserver = class {
    constructor(callback) { resize = callback; }
    observe() {}
    disconnect() {}
  };
  jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ width }));
  let id = 0;
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++id, callback); return id; });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(frame => frames.delete(frame));
});

afterEach(() => {
  wrapper?.unmount();
  jest.restoreAllMocks();
  window.ResizeObserver = originalObserver;
  window.matchMedia = originalMatchMedia;
});

async function setup() {
  wrapper = mount(defineComponent({
    setup() {
      const container = ref(null);
      orbit = useGuideOrbit(container, tour);
      return { container, ...orbit };
    },
    template: '<div ref="container">{{ angle }}</div>',
  }));
  await nextTick();
}

function frame(timestamp) {
  const [id, callback] = [...frames.entries()][0];
  frames.delete(id);
  callback(timestamp);
}

test('advances the orbit using animation time', async () => {
  await setup();
  frame(0);
  frame(100);
  await nextTick();

  expect(orbit.angle.value).toBeCloseTo(0.24);
  expect(frames.size).toBe(1);
});

test('pauses scheduled movement while a tour is active', async () => {
  await setup();
  tour.value = true;
  await nextTick();

  expect(orbit.moving.value).toBe(false);
  expect(frames.size).toBe(0);
});

test('respects reduced motion before starting animation', async () => {
  media.matches = true;
  await setup();

  expect(orbit.reducedMotion.value).toBe(true);
  expect(frames.size).toBe(0);
});

test('switches to cards when the container becomes narrow', async () => {
  await setup();
  width = 600;
  resize();
  await nextTick();

  expect(orbit.compact.value).toBe(true);
  expect(frames.size).toBe(0);
});

test('releases pending animation when leaving the explorer', async () => {
  await setup();
  expect(frames.size).toBe(1);

  wrapper.unmount();

  expect(frames.size).toBe(0);
  expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
});

test('limits zoom to the visible orbit area', async () => {
  await setup();
  orbit.zoomBy(100);

  expect(orbit.zoom.value).toBe(1.07);
});
