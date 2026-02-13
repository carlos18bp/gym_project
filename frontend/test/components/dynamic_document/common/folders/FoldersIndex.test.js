import {
  CreateEditFolderModal,
  FolderDetailsModal,
  FolderDetailsModalTable,
  AddDocumentsModal,
  FoldersGrid,
  FoldersTable,
  FolderManagement,
} from "@/components/dynamic_document/common/folders";

describe("dynamic_document/common/folders/index.js", () => {
  test("exports folder components", () => {
    expect(CreateEditFolderModal).toBeTruthy();
    expect(FolderDetailsModal).toBeTruthy();
    expect(FolderDetailsModalTable).toBeTruthy();
    expect(AddDocumentsModal).toBeTruthy();
    expect(FoldersGrid).toBeTruthy();
    expect(FoldersTable).toBeTruthy();
    expect(FolderManagement).toBeTruthy();
  });
});
