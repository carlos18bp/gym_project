import {
  organizeMenuIntoGroups,
  shouldUseHierarchicalMenu,
} from "@/components/dynamic_document/cards/menuGroupHelpers";

const buildFlatOptions = () => [
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

describe("menuGroupHelpers.js", () => {
  test("organizeMenuIntoGroups returns [] when options is empty", () => {
    expect(organizeMenuIntoGroups([], {})).toEqual([]);
    expect(organizeMenuIntoGroups(null, {})).toEqual([]);
    expect(organizeMenuIntoGroups(undefined, {})).toEqual([]);
  });

  test("organizeMenuIntoGroups builds editing/download groups", () => {
    const result = organizeMenuIntoGroups(buildFlatOptions(), { id: 1 });

    expect(result[0]).toMatchObject({
      id: "editing",
      label: "Edición y gestión",
    });
    expect(result[0].children.map((c) => c.action)).toEqual(
      expect.arrayContaining(["edit", "copy"])
    );
    expect(result[2]).toMatchObject({
      id: "downloads",
      label: "Descargas",
    });
    expect(result[2].children.map((c) => c.action)).toEqual(
      expect.arrayContaining(["downloadPDF", "downloadWord"])
    );
  });

  test("organizeMenuIntoGroups flattens single-item groups with dividers", () => {
    const result = organizeMenuIntoGroups(buildFlatOptions(), { id: 1 });

    expect(result[1]).toEqual({ divider: true });
    expect(result[3]).toEqual({ divider: true });
    expect(result[4]).toMatchObject({ action: "email", label: "Email" });
    expect(result[5]).toEqual({ divider: true });
    expect(result[6]).toMatchObject({ action: "publish", label: "Publicar" });
    expect(result[7]).toEqual({ divider: true });
    expect(result[8]).toMatchObject({ action: "viewSignatures", label: "Firmas" });
  });

  test("organizeMenuIntoGroups builds the actions group", () => {
    const result = organizeMenuIntoGroups(buildFlatOptions(), { id: 1 });

    expect(result[9]).toEqual({ divider: true });
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
