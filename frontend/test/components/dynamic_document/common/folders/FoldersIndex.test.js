import {
  CreateEditFolderModal,
  FolderDetailsModalTable,
  AddDocumentsModal,
  FoldersTable,
  FolderManagement,
} from "@/components/dynamic_document/common/folders";

describe("dynamic_document/common/folders/index.js", () => {
  test("exports folder components", () => {
    // Each barrel export must resolve to its matching SFC (Vue sets __name from the filename).
    expect(CreateEditFolderModal.__name).toBe("CreateEditFolderModal");
    expect(FolderDetailsModalTable.__name).toBe("FolderDetailsModalTable");
    expect(AddDocumentsModal.__name).toBe("AddDocumentsModal");
    expect(FoldersTable.__name).toBe("FoldersTable");
    expect(FolderManagement.__name).toBe("FolderManagement");
  });
});
