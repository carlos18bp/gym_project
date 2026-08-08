import {
  CreateEditFolderModal,
  FolderDetailsModalTable,
  AddDocumentsModal,
  FoldersTable,
  FolderManagement,
} from "@/components/dynamic_document/common/folders";

describe("dynamic_document/common/folders/index.js", () => {
  test("exports folder components", () => {
    expect(CreateEditFolderModal).toBeTruthy();
    expect(FolderDetailsModalTable).toBeTruthy();
    expect(AddDocumentsModal).toBeTruthy();
    expect(FoldersTable).toBeTruthy();
    expect(FolderManagement).toBeTruthy();
  });
});
