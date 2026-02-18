import { setActivePinia, createPinia } from "pinia";
import { DocumentTextIcon } from "@heroicons/vue/24/outline";

import { useUserGuideStore } from "@/stores/user_guide";

describe("User Guide Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.clearAllMocks();
  });

  const seedCustomGuide = (store, sectionContent = "Contenido de ejemplo para buscar") => {
    store.guideContent = {
      custom: {
        name: "Custom Module",
        description: "Custom description",
        sections: [
          {
            id: "sec",
            name: "Sección",
            description: "",
            content: sectionContent,
            features: ["Feature Uno"],
          },
        ],
      },
    };

    return sectionContent;
  };

  test("initializeGuideContent is idempotent and sets initialized", () => {
    const store = useUserGuideStore();

    expect(store.initialized).toBe(false);

    store.initializeGuideContent();
    expect(store.initialized).toBe(true);
    expect(store.guideContent.dashboard).toBeTruthy();

    const prev = store.guideContent;
    store.initializeGuideContent();

    // Should not recreate content if already initialized
    expect(store.guideContent).toBe(prev);
  });

  test("getModulesForRole filters modules by role", () => {
    const store = useUserGuideStore();

    const lawyerModules = store.getModulesForRole("lawyer").map((m) => m.id);
    const clientModules = store.getModulesForRole("client").map((m) => m.id);

    expect(lawyerModules).toContain("directory");
    expect(clientModules).not.toContain("directory");

    expect(clientModules).toContain("dashboard");
    expect(clientModules).toContain("processes");
  });

  test("getModuleContent filters sections by role without mutating state", () => {
    const store = useUserGuideStore();
    store.initializeGuideContent();

    const directoryForClient = store.getModuleContent("directory", "client");
    expect(directoryForClient).toBeTruthy();
    expect(directoryForClient.sections).toEqual([]);

    const directoryForLawyer = store.getModuleContent("directory", "lawyer");
    expect(directoryForLawyer).toBeTruthy();
    expect(Array.isArray(directoryForLawyer.sections)).toBe(true);
    expect(directoryForLawyer.sections.length).toBeGreaterThan(0);
  });

  test("getModuleContent returns null for unknown module", () => {
    const store = useUserGuideStore();

    const result = store.getModuleContent("missing-module", "client");

    expect(result).toBeNull();
  });

  test("getModuleContent returns null when module entry is falsy", () => {
    const store = useUserGuideStore();

    store.guideContent = {
      empty: null,
    };

    expect(store.getModuleContent("empty", "client")).toBeNull();
  });

  test("getModuleContent keeps sections without role restrictions", () => {
    const store = useUserGuideStore();

    store.guideContent = {
      sample: {
        name: "Sample",
        sections: [
          { id: "open", name: "Open", content: "Public" },
          { id: "restricted", name: "Restricted", roles: ["lawyer"], content: "Private" },
        ],
      },
    };

    const result = store.getModuleContent("sample", "client");

    expect(result.sections.map((section) => section.id)).toEqual(["open"]);
  });

  test("getModuleContent returns module even when sections are missing", () => {
    const store = useUserGuideStore();

    store.guideContent = {
      simple: {
        name: "Simple",
        description: "No sections",
      },
    };

    const result = store.getModuleContent("simple", "client");

    expect(result).toEqual({
      name: "Simple",
      description: "No sections",
    });
  });

  test("getModuleContent returns null for missing module and keeps open sections", () => {
    const store = useUserGuideStore();

    store.guideContent = {
      alpha: {
        name: "Alpha",
        sections: [{ id: "open", name: "Open", content: "Public" }],
      },
    };

    expect(store.getModuleContent("missing", "client")).toBeNull();

    const result = store.getModuleContent("alpha", "client");

    expect(result.sections.map((section) => section.id)).toEqual(["open"]);
  });

  test("searchGuideContent returns matches in module metadata and section content", () => {
    const store = useUserGuideStore();
    store.initializeGuideContent();

    const results = store.searchGuideContent("actividad");

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    // Should have at least one match pointing to dashboard module
    expect(results.some((r) => r.moduleId === "dashboard")).toBe(true);
  });

  test("searchGuideContent handles modules without sections", () => {
    const store = useUserGuideStore();

    store.guideContent = {
      solo: {
        name: "Solo Module",
        description: "Descripcion unica",
      },
    };

    const results = store.searchGuideContent("solo");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      module: "Solo Module",
      section: "General",
      title: "Solo Module",
      moduleId: "solo",
    });
  });

  test("searchGuideContent uses icon fallback for module and section results", () => {
    const store = useUserGuideStore();
    const sectionContent = seedCustomGuide(store);

    const moduleMatch = store.searchGuideContent("custom").find((result) => result.section === "General");
    const sectionMatch = store.searchGuideContent("contenido").find((result) => result.section === "Sección");

    expect([
      Boolean(moduleMatch),
      moduleMatch.icon,
      Boolean(sectionMatch),
      sectionMatch.snippet,
      sectionMatch.icon,
    ]).toEqual([true, DocumentTextIcon, true, sectionContent.substring(0, 150), DocumentTextIcon]);
  });

  test("searchGuideContent uses feature snippet fallback", () => {
    const store = useUserGuideStore();
    seedCustomGuide(store);

    const featureMatch = store.searchGuideContent("feature").find((result) => result.title === "Feature Uno");

    expect([Boolean(featureMatch), featureMatch.snippet, featureMatch.icon]).toEqual([
      true,
      "Funcionalidad: Feature Uno",
      DocumentTextIcon,
    ]);
  });

  test("searchGuideContent handles sections without features", () => {
    const store = useUserGuideStore();

    store.guideContent = {
      noFeatures: {
        name: "No Features",
        description: "Modulo sin features",
        sections: [
          {
            id: "sec",
            name: "Seccion Simple",
            description: "Descripcion simple",
            content: "Contenido simple",
          },
        ],
      },
    };

    const results = store.searchGuideContent("descripcion");
    const sectionMatch = results.find((result) => result.section === "Seccion Simple");

    expect(sectionMatch).toBeTruthy();
    expect(sectionMatch.snippet).toBe("Descripcion simple");
  });

  test("searchGuideContent falls back to DocumentTextIcon for module and section results", () => {
    const store = useUserGuideStore();
    const sectionContent = "Contenido fallback";

    store.guideContent = {
      fallback: {
        name: "Fallback Module",
        description: "Descripcion fallback",
        sections: [
          {
            id: "sec",
            name: "Seccion",
            description: "",
            content: sectionContent,
            features: ["Feature Fallback"],
          },
        ],
      },
    };

    const moduleMatch = store.searchGuideContent("fallback").find((result) => result.section === "General");
    expect(moduleMatch).toBeTruthy();
    expect(moduleMatch.icon).toBe(DocumentTextIcon);

    const sectionMatch = store.searchGuideContent("contenido").find((result) => result.section === "Seccion");
    expect(sectionMatch).toBeTruthy();
    expect(sectionMatch.snippet).toBe(sectionContent.substring(0, 150));
    expect(sectionMatch.icon).toBe(DocumentTextIcon);

    const featureMatch = store.searchGuideContent("feature fallback").find((result) => result.title === "Feature Fallback");
    expect(featureMatch).toBeTruthy();
    expect(featureMatch.icon).toBe(DocumentTextIcon);
  });

  test("searchGuideContent honors module icons and section descriptions", () => {
    const store = useUserGuideStore();
    const customIcon = { name: "CustomIcon" };

    store.guideContent = {
      custom: {
        name: "Custom Module",
        description: "Descripcion del modulo",
        icon: customIcon,
        sections: [
          {
            id: "sec",
            name: "Seccion Custom",
            description: "Descripcion de seccion",
            content: "Contenido alterno",
            features: ["Feature Especial"],
          },
        ],
      },
    };

    const moduleMatch = store.searchGuideContent("custom").find((result) => result.section === "General");
    expect(moduleMatch).toBeTruthy();
    expect(moduleMatch.icon).toEqual(customIcon);

    const sectionMatch = store
      .searchGuideContent("descripcion")
      .find((result) => result.section === "Seccion Custom");
    expect(sectionMatch).toBeTruthy();
    expect(sectionMatch.snippet).toBe("Descripcion de seccion");
    expect(sectionMatch.icon).toEqual(customIcon);

    const featureMatch = store
      .searchGuideContent("feature especial")
      .find((result) => result.title === "Feature Especial");
    expect(featureMatch).toBeTruthy();
    expect(featureMatch.icon).toEqual(customIcon);
  });
});
