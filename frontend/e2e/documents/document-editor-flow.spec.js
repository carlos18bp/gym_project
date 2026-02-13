import { test, expect } from "../helpers/test.js";

import { setAuthLocalStorage } from "../helpers/auth.js";
import {
  installDocumentEditorApiMocks,
  installTinyMceCloudStub,
} from "../helpers/documentEditorMocks.js";

test("lawyer can open DocumentEditor and save draft", async ({ page }) => {
  const userId = 1500;
  const documentId = 101;

  await installTinyMceCloudStub(page);
  await installDocumentEditorApiMocks(page, {
    userId,
    role: "lawyer",
    documentId,
  });

  await setAuthLocalStorage(page, {
    token: "e2e-token",
    userAuth: {
      id: userId,
      role: "lawyer",
      is_gym_lawyer: true,
      is_profile_completed: true,
    },
  });

  await page.goto(`/dynamic_document_dashboard/lawyer/editor/edit/${documentId}`);

  // Editor should mount and show its custom toolbar button
  await expect(page.getByRole("button", { name: "Guardar como borrador" })).toBeVisible({ timeout: 15_000 });

  // Make content non-empty via TinyMCE API stub
  await page.evaluate(() => {
    if (!window.tinymce || !window.tinymce.activeEditor) {
      throw new Error("tinymce not available");
    }
    // Our stub doesn't persist content; we just need editorContent ref to not be empty.
    // The v-model is driven by the Vue component, so we update the editorContent via DOM event.
    // Fallback: set content in activeEditor; app uses v-model to read editor content.
    window.tinymce.activeEditor.getContent = () => "<p>Contenido actualizado</p>";
  });

  await page.getByRole("button", { name: "Guardar como borrador" }).click();

  // SweetAlert success
  await expect(page.locator(".swal2-popup")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".swal2-popup")).toContainText("¡Borrador guardado exitosamente!");
  await page.locator(".swal2-confirm").click();

  // Redirect to dashboard
  await expect(page).toHaveURL(/\/dynamic_document_dashboard/);
});
