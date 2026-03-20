import { mount } from "@vue/test-utils";

import SyncStatus from "@/components/secop/SyncStatus.vue";

describe("SyncStatus.vue", () => {
  test("renders green dot when last sync less than 24h ago", () => {
    const recentDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const wrapper = mount(SyncStatus, {
      props: {
        syncStatus: {
          last_success: { finished_at: recentDate },
          total_processes: 100,
        },
      },
    });

    const dot = wrapper.find("[data-testid='sync-status-dot']");
    expect(dot.classes()).toContain("bg-green-400");
  });

  test("renders yellow dot when last sync 24-48h ago", () => {
    const oldDate = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString();
    const wrapper = mount(SyncStatus, {
      props: {
        syncStatus: {
          last_success: { finished_at: oldDate },
          total_processes: 50,
        },
      },
    });

    const dot = wrapper.find("[data-testid='sync-status-dot']");
    expect(dot.classes()).toContain("bg-yellow-400");
  });

  test("renders red dot when last sync more than 48h ago", () => {
    const veryOldDate = new Date(
      Date.now() - 72 * 60 * 60 * 1000
    ).toISOString();
    const wrapper = mount(SyncStatus, {
      props: {
        syncStatus: {
          last_success: { finished_at: veryOldDate },
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
});
