import { mount } from "@vue/test-utils";

import OrganizationsSection from "@/components/organizations/client/sections/OrganizationsSection.vue";

jest.mock("@heroicons/vue/24/outline", () => {
  const IconStub = { name: "IconStub", template: "<span />" };
  return {
    __esModule: true,
    BuildingOfficeIcon: IconStub,
    InformationCircleIcon: IconStub,
    CheckCircleIcon: IconStub,
  };
});

const OrganizationCardStub = {
  name: "OrganizationCard",
  props: ["organization"],
  template: `
    <div data-test="org-card">
      <button type="button" data-test="left" @click="$emit('left', organization.id)">left</button>
      <button type="button" data-test="create-request" @click="$emit('create-request', organization.id)">create</button>
      <button type="button" data-test="view-details" @click="$emit('view-details', organization.id)">view</button>
    </div>
  `,
};

describe("OrganizationsSection.vue", () => {
  test("passes through OrganizationCard events", async () => {
    const wrapper = mount(OrganizationsSection, {
      props: {
        organizations: [{ id: 1 }, { id: 2 }],
        isLoading: false,
      },
      global: {
        stubs: {
          OrganizationCard: OrganizationCardStub,
        },
      },
    });

    await wrapper.findAll("[data-test='left']")[0].trigger("click");
    expect(wrapper.emitted("organization-left")[0]).toEqual([1]);

    await wrapper.findAll("[data-test='create-request']")[1].trigger("click");
    expect(wrapper.emitted("create-request")[0]).toEqual([2]);

    await wrapper.findAll("[data-test='view-details']")[0].trigger("click");
    expect(wrapper.emitted("view-details")[0]).toEqual([1]);
  });
});
