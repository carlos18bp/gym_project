import { mount } from "@vue/test-utils";

import InvitationsSection from "@/components/organizations/client/sections/InvitationsSection.vue";

jest.mock("@heroicons/vue/24/outline", () => {
  const IconStub = { name: "IconStub", template: "<span />" };
  return {
    __esModule: true,
    EnvelopeIcon: IconStub,
    InformationCircleIcon: IconStub,
  };
});

const InvitationCardStub = {
  name: "InvitationCard",
  props: ["invitation"],
  template: `
    <div data-test="inv-card">
      <button type="button" data-test="responded" @click="$emit('responded', { invitationId: invitation.id, status: 'ACCEPTED' })">respond</button>
    </div>
  `,
};

describe("InvitationsSection.vue", () => {
  test("passes through invitation-responded event", async () => {
    const wrapper = mount(InvitationsSection, {
      props: {
        invitations: [{ id: 11 }],
        isLoading: false,
      },
      global: {
        stubs: {
          InvitationCard: InvitationCardStub,
        },
      },
    });

    await wrapper.find("[data-test='responded']").trigger("click");

    expect(wrapper.emitted("invitation-responded")).toBeTruthy();
    expect(wrapper.emitted("invitation-responded")[0]).toEqual([
      { invitationId: 11, status: "ACCEPTED" },
    ]);
  });
});
