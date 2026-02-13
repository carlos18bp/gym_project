import {
  organizeMenuIntoGroups,
  shouldUseHierarchicalMenu,
} from "@/components/dynamic_document/cards/menuGroupHelpers";

describe("menuGroupHelpers.js", () => {
  test("organizeMenuIntoGroups returns [] when options is empty", () => {
    expect(organizeMenuIntoGroups([], {})).toEqual([]);
    expect(organizeMenuIntoGroups(null, {})).toEqual([]);
    expect(organizeMenuIntoGroups(undefined, {})).toEqual([]);
  });

  test("organizeMenuIntoGroups groups options by action, sorts by priority, and adds dividers", () => {
    const flatOptions = [
      { action: "downloadPDF", label: "PDF" },
      { action: "edit", label: "Editar" },
      { action: "email", label: "Email" },
      { action: "publish", label: "Publicar" },
      { action: "viewSignatures", label: "Firmas" },
      { action: "preview", label: "Preview" },
      { action: "unknownAction", label: "Unknown" },
      { action: "downloadWord", label: "Word" },
      { action: "copy", label: "Copiar" },
    ];

    const result = organizeMenuIntoGroups(flatOptions, { id: 1 });

    // Expect group order: editing (multiple items), downloads (multiple items), communication (single -> item),
    // states (single -> item), signatures (single -> item), actions (multiple items)

    // editing group
    expect(result[0]).toMatchObject({
      id: "editing",
      label: "Edición y gestión",
    });
    expect(result[0].children.map((c) => c.action)).toEqual(
      expect.arrayContaining(["edit", "copy"])
    );

    // divider after editing group
    expect(result[1]).toEqual({ divider: true });

    // downloads group
    expect(result[2]).toMatchObject({
      id: "downloads",
      label: "Descargas",
    });
    expect(result[2].children.map((c) => c.action)).toEqual(
      expect.arrayContaining(["downloadPDF", "downloadWord"])
    );

    // divider after downloads group
    expect(result[3]).toEqual({ divider: true });

    // communication is single -> should be direct option
    expect(result[4]).toMatchObject({ action: "email", label: "Email" });

    // divider after communication
    expect(result[5]).toEqual({ divider: true });

    // states is single -> direct option
    expect(result[6]).toMatchObject({ action: "publish", label: "Publicar" });

    // divider after states
    expect(result[7]).toEqual({ divider: true });

    // signatures is single -> direct option
    expect(result[8]).toMatchObject({ action: "viewSignatures", label: "Firmas" });

    // divider after signatures
    expect(result[9]).toEqual({ divider: true });

    // actions group (preview + unknown fallback)
    expect(result[10]).toMatchObject({
      id: "actions",
      label: "Acciones",
    });
    expect(result[10].children.map((c) => c.action)).toEqual(
      expect.arrayContaining(["preview", "unknownAction"])
    );
  });

  test("organizeMenuIntoGroups returns a flat option when only one group has one item", () => {
    const result = organizeMenuIntoGroups([{ action: "preview", label: "Preview" }], {
      id: 1,
    });

    expect(result).toEqual([{ action: "preview", label: "Preview" }]);
  });

  test("shouldUseHierarchicalMenu returns true only when options length > 6", () => {
    expect(shouldUseHierarchicalMenu(null)).toBe(null);
    expect(shouldUseHierarchicalMenu([])).toBe(false);
    expect(shouldUseHierarchicalMenu(new Array(6).fill({}))).toBe(false);
    expect(shouldUseHierarchicalMenu(new Array(7).fill({}))).toBe(true);
  });
});
