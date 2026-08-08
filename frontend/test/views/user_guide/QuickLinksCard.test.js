import { mount } from "@vue/test-utils";

import QuickLinksCard from "@/views/user_guide/components/QuickLinksCard.vue";

const mountCard = (role) => mount(QuickLinksCard, { props: { role } });

describe("views/user_guide/components/QuickLinksCard.vue", () => {
  test("renders the six lawyer quick links", () => {
    const wrapper = mountCard("lawyer");

    const labels = wrapper.findAll("button").map((b) => b.text());
    expect(labels).toEqual([
      "Inicio",
      "Directorio",
      "Procesos",
      "Archivos Jurídicos",
      "SECOP",
      "Servicios",
    ]);
  });

  test("renders organization link for corporate clients", () => {
    const wrapper = mountCard("corporate_client");

    expect(wrapper.text()).toContain("Organizaciones");
  });

  test("falls back to the client links for unknown roles", () => {
    const wrapper = mountCard("auditor");

    const labels = wrapper.findAll("button").map((b) => b.text());
    expect(labels).toEqual([
      "Inicio",
      "Mis Procesos",
      "Documentos",
      "Servicios",
      "Solicitudes",
    ]);
  });

  test("emits navigate with the module id when a link is clicked", async () => {
    const wrapper = mountCard("basic");

    await wrapper.findAll("button")[1].trigger("click");

    expect(wrapper.emitted("navigate")).toEqual([["processes"]]);
  });

  test("links to WhatsApp support in a new tab", () => {
    const wrapper = mountCard("client");

    const help = wrapper.get("a");
    expect(help.attributes("href")).toContain("api.whatsapp.com");
    expect(help.attributes("target")).toBe("_blank");
  });
});
