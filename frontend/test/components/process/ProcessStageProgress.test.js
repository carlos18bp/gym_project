import { mount } from "@vue/test-utils";

import ProcessStageProgress from "@/components/process/ProcessStageProgress.vue";

describe("ProcessStageProgress.vue", () => {
  test("renders current stage and emits openHistory", async () => {
    const wrapper = mount(ProcessStageProgress, {
      props: {
        stages: [{ status: "Admisión" }, { status: "Fallo" }],
      },
    });

    expect(wrapper.text()).toContain("Fallo");

    await wrapper.find("button").trigger("click");

    expect(wrapper.emitted("openHistory")).toBeTruthy();
  });

  test("derives progress from stages and fills segments", () => {
    const wrapper = mount(ProcessStageProgress, {
      props: {
        stages: [{ status: "Inicio" }, { status: "Etapa 2" }],
        totalStagesExpected: 4,
      },
    });

    expect(wrapper.vm.progressPercentage).toBe(50);

    const segments = wrapper.vm.progressSegments;
    expect(segments).toHaveLength(4);
    expect(segments.filter((segment) => segment.filled)).toHaveLength(2);
  });

  test("clamps explicit progress and uses last chevron clip path", () => {
    const wrapper = mount(ProcessStageProgress, {
      props: {
        stages: [],
        totalStagesExpected: 3,
        progress: 120,
      },
    });

    expect(wrapper.vm.progressPercentage).toBe(100);

    const firstClip = wrapper.vm.getChevronClipPath(0);
    const lastClip = wrapper.vm.getChevronClipPath(2);

    expect(firstClip).not.toBe(lastClip);
    expect(lastClip).toContain("calc(100% - 8px)");
  });
});
