import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

import SyncStatus from "@/components/secop/SyncStatus.vue";

const FROZEN_NOW = new Date("2026-03-15T12:00:00Z");
const TWO_HOURS_AGO = new Date(FROZEN_NOW.getTime() - 2 * 60 * 60 * 1000).toISOString();
const THIRTY_HOURS_AGO = new Date(FROZEN_NOW.getTime() - 30 * 60 * 60 * 1000).toISOString();
const SEVENTY_TWO_HOURS_AGO = new Date(FROZEN_NOW.getTime() - 72 * 60 * 60 * 1000).toISOString();

describe("SyncStatus.vue", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("renders green dot when last sync less than 24h ago", () => {
    const wrapper = mount(SyncStatus, {
      props: {
        syncStatus: {
          last_success: { finished_at: TWO_HOURS_AGO },
          total_processes: 100,
        },
      },
    });

    const dot = wrapper.find("[data-testid='sync-status-dot']");
    expect(dot.classes()).toContain("bg-green-400");
  });

  test("renders yellow dot when last sync 24-48h ago", () => {
    const wrapper = mount(SyncStatus, {
      props: {
        syncStatus: {
          last_success: { finished_at: THIRTY_HOURS_AGO },
          total_processes: 50,
        },
      },
    });

    const dot = wrapper.find("[data-testid='sync-status-dot']");
    expect(dot.classes()).toContain("bg-yellow-400");
  });

  test("renders red dot when last sync more than 48h ago", () => {
    const wrapper = mount(SyncStatus, {
      props: {
        syncStatus: {
          last_success: { finished_at: SEVENTY_TWO_HOURS_AGO },
          total_processes: 30,
        },
      },
    });

    const dot = wrapper.find("[data-testid='sync-status-dot']");
    expect(dot.classes()).toContain("bg-red-400");
  });

  test("renders Sin sincronización when syncStatus is null", () => {
    const wrapper = mount(SyncStatus, {
      props: {
        syncStatus: null,
      },
    });

    expect(wrapper.text()).toContain("Sin sincronización");
  });

  test("renders sync trigger button", () => {
    const wrapper = mount(SyncStatus, {
      props: {
        syncStatus: {
          last_success: { finished_at: TWO_HOURS_AGO },
          total_processes: 100,
        },
      },
    });

    const btn = wrapper.find("[data-testid='sync-trigger-btn']");
    expect(btn.exists()).toBe(true);
    expect(btn.attributes("disabled")).toBeUndefined();
  });

  test("emits trigger-sync event when button clicked", async () => {
    const wrapper = mount(SyncStatus, {
      props: {
        syncStatus: {
          last_success: { finished_at: TWO_HOURS_AGO },
          total_processes: 100,
        },
      },
    });

    const btn = wrapper.find("[data-testid='sync-trigger-btn']");
    await btn.trigger("click");

    expect(wrapper.emitted("trigger-sync")).toHaveLength(1);
  });

  test("disables button after click to prevent double-trigger", async () => {
    const wrapper = mount(SyncStatus, {
      props: {
        syncStatus: {
          last_success: { finished_at: TWO_HOURS_AGO },
          total_processes: 100,
        },
      },
    });

    const btn = wrapper.find("[data-testid='sync-trigger-btn']");
    await btn.trigger("click");
    await nextTick();

    expect(btn.attributes("disabled")).toBeDefined();
  });
});
