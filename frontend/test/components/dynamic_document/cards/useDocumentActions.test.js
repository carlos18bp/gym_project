const mockRegisterView = jest.fn();
const mockOpenPreviewModal = jest.fn();
const mockShowNotification = jest.fn();
const mockShowConfirmationAlert = jest.fn();
const mockRouterPush = jest.fn();

const mockDownloadFile = jest.fn();
const mockRegisterUserActivity = jest.fn();

jest.mock("@/composables/useRecentViews", () => ({
  __esModule: true,
  useRecentViews: () => ({
    registerView: (...args) => mockRegisterView(...args),
  }),
}));

jest.mock("@/shared/document_utils", () => ({
  __esModule: true,
  openPreviewModal: (...args) => mockOpenPreviewModal(...args),
  downloadFile: (...args) => mockDownloadFile(...args),
  showPreviewModal: { value: false },
  previewDocumentData: { value: { title: "", content: "" } },
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@/shared/confirmation_alert", () => ({
  __esModule: true,
  showConfirmationAlert: (...args) => mockShowConfirmationAlert(...args),
}));

jest.mock("vue-router", () => ({
  __esModule: true,
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  get_request: jest.fn(),
  create_request: jest.fn(),
}));

jest.mock("@/stores/dashboard/activity_feed", () => ({
  __esModule: true,
  ACTION_TYPES: {
    CREATE: "create",
    EDIT: "edit",
    FINISH: "finish",
    DELETE: "delete",
    UPDATE: "update",
    DOWNLOAD: "download",
    OTHER: "other",
  },
  registerUserActivity: (...args) => mockRegisterUserActivity(...args),
}));

import { create_request } from "@/stores/services/request_http";
import { useDocumentActions, useCardModals } from "@/components/dynamic_document/cards";

describe("useDocumentActions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShowNotification.mockResolvedValue();
    mockShowConfirmationAlert.mockResolvedValue(false);
    mockDownloadFile.mockResolvedValue();
    mockRegisterUserActivity.mockResolvedValue();
    create_request.mockResolvedValue({ status: 200, statusText: "OK" });
  });

  test("handlePreviewDocument registers view and opens preview modal", async () => {
    const documentStore = {};
    const userStore = {};
    const emit = jest.fn();

    const { handlePreviewDocument } = useDocumentActions(documentStore, userStore, emit);

    const doc = { id: 10, title: "Doc" };

    await handlePreviewDocument(doc);

    expect(mockRegisterView).toHaveBeenCalledWith("document", 10);
    expect(mockOpenPreviewModal).toHaveBeenCalledWith(doc);
  });

  test("deleteDocument: when confirmed, deletes, notifies success, and emits refresh", async () => {
    const documentStore = {
      deleteDocument: jest.fn().mockResolvedValue(),
    };
    const userStore = {};
    const emit = jest.fn();

    mockShowConfirmationAlert.mockResolvedValue(true);

    const { deleteDocument } = useDocumentActions(documentStore, userStore, emit);

    const doc = { id: 10, title: "Doc" };

    await deleteDocument(doc);

    expect(mockShowConfirmationAlert).toHaveBeenCalledWith(
      '¿Estás seguro de que deseas eliminar el documento "Doc"?'
    );
    expect(documentStore.deleteDocument).toHaveBeenCalledWith(10);
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Documento eliminado exitosamente",
      "success"
    );
    expect(emit).toHaveBeenCalledWith("refresh");
  });

  test("publishDocument: error notifies and rethrows", async () => {
    const documentStore = {
      updateDocument: jest.fn().mockRejectedValue(new Error("fail")),
    };
    const emit = jest.fn();

    const { publishDocument } = useDocumentActions(documentStore, {}, emit);

    await expect(
      publishDocument({ id: 1, title: "Doc", state: "Draft" })
    ).rejects.toBeTruthy();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al publicar el documento",
      "error"
    );
  });

  test("moveToDraft: error notifies and rethrows", async () => {
    const documentStore = {
      updateDocument: jest.fn().mockRejectedValue(new Error("fail")),
    };
    const emit = jest.fn();

    const { moveToDraft } = useDocumentActions(documentStore, {}, emit);

    await expect(
      moveToDraft({ id: 2, title: "Doc2", state: "Published" })
    ).rejects.toBeTruthy();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al mover el documento a borrador",
      "error"
    );
  });

  test("deleteDocument: when not confirmed, does nothing", async () => {
    const documentStore = {
      deleteDocument: jest.fn(),
    };
    const userStore = {};
    const emit = jest.fn();

    mockShowConfirmationAlert.mockResolvedValue(false);

    const { deleteDocument } = useDocumentActions(documentStore, userStore, emit);

    await deleteDocument({ id: 10, title: "Doc" });

    expect(documentStore.deleteDocument).not.toHaveBeenCalled();
    expect(mockShowNotification).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  test("deleteDocument: when delete fails, notifies error and rethrows", async () => {
    const documentStore = {
      deleteDocument: jest.fn().mockRejectedValue(new Error("fail")),
    };
    const userStore = {};
    const emit = jest.fn();

    mockShowConfirmationAlert.mockResolvedValue(true);

    const { deleteDocument } = useDocumentActions(documentStore, userStore, emit);

    await expect(deleteDocument({ id: 10, title: "Doc" })).rejects.toBeTruthy();

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al eliminar el documento",
      "error"
    );
  });

  test("downloadPDFDocument returns early when documentStore is missing", async () => {
    const emit = jest.fn();

    const { downloadPDFDocument } = useDocumentActions(null, {}, emit);

    await downloadPDFDocument({ id: 1, title: "A" });

    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  test("downloadPDFDocument: success and error", async () => {
    const documentStore = {
      downloadPDF: jest.fn().mockResolvedValue(),
    };
    const emit = jest.fn();

    const { downloadPDFDocument } = useDocumentActions(documentStore, {}, emit);

    await downloadPDFDocument({ id: 1, title: "A" });

    expect(documentStore.downloadPDF).toHaveBeenCalledWith(1, "A");
    expect(mockShowNotification).toHaveBeenCalledWith(
      "PDF descargado exitosamente",
      "success"
    );

    documentStore.downloadPDF.mockRejectedValueOnce(new Error("fail"));
    await expect(downloadPDFDocument({ id: 2, title: "B" })).rejects.toBeTruthy();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al descargar el PDF",
      "error"
    );
  });

  test("downloadWordDocument returns early when documentStore is missing", async () => {
    const emit = jest.fn();

    const { downloadWordDocument } = useDocumentActions(null, {}, emit);

    await downloadWordDocument({ id: 1, title: "A" });

    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  test("downloadWordDocument: success and error", async () => {
    const documentStore = {
      downloadWord: jest.fn().mockResolvedValue(),
    };
    const emit = jest.fn();

    const { downloadWordDocument } = useDocumentActions(documentStore, {}, emit);

    await downloadWordDocument({ id: 1, title: "A" });

    expect(documentStore.downloadWord).toHaveBeenCalledWith(1, "A");
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Documento Word descargado exitosamente",
      "success"
    );

    documentStore.downloadWord.mockRejectedValueOnce(new Error("fail"));
    await expect(downloadWordDocument({ id: 2, title: "B" })).rejects.toBeTruthy();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al descargar el documento Word",
      "error"
    );
  });

  test("copyDocument: when store missing, notifies info", async () => {
    const emit = jest.fn();

    const { copyDocument } = useDocumentActions(null, {}, emit);

    await copyDocument({ id: 1, title: "Doc" });

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Funcionalidad de duplicar no implementada aún",
      "info"
    );
  });

  test("copyDocument: when not confirmed, does nothing", async () => {
    const documentStore = {
      createDocument: jest.fn(),
    };
    const emit = jest.fn();

    mockShowConfirmationAlert.mockResolvedValueOnce(false);

    const { copyDocument } = useDocumentActions(documentStore, {}, emit);

    await copyDocument({ id: 1, title: "Doc", content: "", variables: [] });

    expect(documentStore.createDocument).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalledWith("refresh");
  });

  test("copyDocument: missing variables defaults to empty array", async () => {
    const documentStore = {
      createDocument: jest.fn().mockResolvedValue(),
    };
    const emit = jest.fn();

    mockShowConfirmationAlert.mockResolvedValueOnce(true);

    const { copyDocument } = useDocumentActions(documentStore, {}, emit);

    await copyDocument({ id: 1, title: "Doc", content: "C" });

    const copyData = documentStore.createDocument.mock.calls[0][0];
    expect(copyData.variables).toEqual([]);
  });

  test("copyDocument: creates draft copy with date suffix and resets variable values", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 1, 3, 12, 0, 0));

    const documentStore = {
      createDocument: jest.fn().mockResolvedValue(),
    };
    const emit = jest.fn();

    mockShowConfirmationAlert.mockResolvedValueOnce(true);

    const { copyDocument } = useDocumentActions(documentStore, {}, emit);

    await copyDocument({
      id: 1,
      title: "Doc",
      content: "C",
      variables: [
        {
          name_en: "a",
          name_es: "b",
          tooltip: "t",
          field_type: "text",
          select_options: [],
          value: "something",
        },
      ],
      requires_signature: true,
    });

    expect(documentStore.createDocument).toHaveBeenCalledTimes(1);
    const copyData = documentStore.createDocument.mock.calls[0][0];
    expect(copyData).toMatchObject({
      title: "Doc 03022026",
      content: "C",
      state: "Draft",
      requires_signature: false,
    });
    expect(copyData.variables).toEqual([
      {
        name_en: "a",
        name_es: "b",
        tooltip: "t",
        field_type: "text",
        select_options: [],
        value: "",
      },
    ]);

    expect(mockShowNotification).toHaveBeenCalledWith(
      'Copia creada exitosamente: "Doc 03022026"',
      "success"
    );
    expect(emit).toHaveBeenCalledWith("refresh");

    jest.useRealTimers();
  });

  test("signDocument: registers activity failure logs warning", async () => {
    jest.useFakeTimers();

    create_request.mockResolvedValueOnce({ status: 200, statusText: "OK" });

    const documentToSign = {
      id: 3,
      title: "Doc",
      requires_signature: true,
      signatures: [{ signer_email: "a@a.com", signed: false }],
    };

    const documentStore = {
      init: jest.fn().mockResolvedValue(),
      documents: [documentToSign],
    };
    const userStore = { currentUser: { id: 9, email: "a@a.com", has_signature: true } };
    const emit = jest.fn();
    const openModalFn = jest.fn();
    const activityError = new Error("fail");

    mockRegisterUserActivity.mockRejectedValueOnce(activityError);
    mockShowConfirmationAlert.mockResolvedValueOnce(true);

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const { signDocument } = useDocumentActions(documentStore, userStore, emit);

    await signDocument(documentToSign, openModalFn);

    expect(warnSpy).toHaveBeenCalledWith(
      "No se pudo registrar la actividad de firma:",
      activityError
    );

    jest.advanceTimersByTime(1000);

    warnSpy.mockRestore();
    jest.useRealTimers();
  });

  test("signDocument: unexpected response shows error notification", async () => {
    create_request.mockResolvedValueOnce({ status: 500, statusText: "Error" });

    const documentStore = {
      init: jest.fn().mockResolvedValue(),
      documents: [],
    };
    const userStore = { currentUser: { id: 9, email: "a@a.com", has_signature: true } };
    const emit = jest.fn();
    const openModalFn = jest.fn();
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mockShowConfirmationAlert.mockResolvedValueOnce(true);

    const { signDocument } = useDocumentActions(documentStore, userStore, emit);

    await signDocument(
      {
        id: 4,
        title: "Doc",
        requires_signature: true,
        signatures: [{ signer_email: "a@a.com", signed: false }],
      },
      openModalFn
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error in HTTP request:",
      expect.any(Error)
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      "General error signing document:",
      expect.any(Error)
    );
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.stringContaining("Error al firmar el documento: Unexpected server response"),
      "error"
    );

    consoleSpy.mockRestore();
  });

  test("copyDocument: when createDocument fails, shows error notification", async () => {
    const documentStore = {
      createDocument: jest.fn().mockRejectedValue(new Error("fail")),
    };
    const emit = jest.fn();
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mockShowConfirmationAlert.mockResolvedValueOnce(true);

    const { copyDocument } = useDocumentActions(documentStore, {}, emit);

    await copyDocument({ id: 1, title: "Doc", content: "C", variables: [] });

    expect(documentStore.createDocument).toHaveBeenCalled();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al crear la copia del documento",
      "error"
    );

    consoleSpy.mockRestore();
  });

  test("publishDocument and moveToDraft call updateDocument and emit refresh", async () => {
    const documentStore = {
      updateDocument: jest.fn().mockResolvedValue(),
    };
    const emit = jest.fn();

    const { publishDocument, moveToDraft } = useDocumentActions(
      documentStore,
      {},
      emit
    );

    await publishDocument({ id: 1, title: "Doc", state: "Draft" });
    expect(documentStore.updateDocument).toHaveBeenCalledWith(1, {
      id: 1,
      title: "Doc",
      state: "Published",
      is_public: true,
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Documento publicado exitosamente",
      "success"
    );
    expect(emit).toHaveBeenCalledWith("refresh");

    await moveToDraft({ id: 2, title: "Doc2", state: "Published" });
    expect(documentStore.updateDocument).toHaveBeenCalledWith(2, {
      id: 2,
      title: "Doc2",
      state: "Draft",
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Documento movido a borrador exitosamente",
      "success"
    );
    expect(emit).toHaveBeenCalledWith("refresh");
  });

  test("publishDocument and moveToDraft return early when store is missing", async () => {
    const emit = jest.fn();

    const { publishDocument, moveToDraft } = useDocumentActions(null, {}, emit);

    await publishDocument({ id: 1, title: "Doc", state: "Draft" });
    await moveToDraft({ id: 2, title: "Doc2", state: "Published" });

    expect(mockShowNotification).not.toHaveBeenCalled();
  });

  test("formalizeDocument pushes route and handles push error", async () => {
    const emit = jest.fn();
    const { formalizeDocument } = useDocumentActions({}, {}, emit);

    await formalizeDocument({ id: 5, title: "T" });
    expect(mockRouterPush).toHaveBeenCalledWith(
      "/dynamic_document_dashboard/document/use/formalize/5/T"
    );

    mockRouterPush.mockImplementationOnce(() => {
      throw new Error("fail");
    });

    await expect(formalizeDocument({ id: 6, title: "X" })).resolves.toBeUndefined();
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al formalizar el documento",
      "error"
    );
  });

  test("signDocument: guards (no signature required / not authorized / already signed)", async () => {
    const documentStore = { init: jest.fn(), documents: [] };
    const userStore = { currentUser: { id: 1, email: "a@a.com", has_signature: true } };
    const emit = jest.fn();

    const { signDocument } = useDocumentActions(documentStore, userStore, emit);

    await signDocument({ id: 1, title: "D", requires_signature: false }, jest.fn());
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Este documento no requiere firmas",
      "error"
    );

    await signDocument(
      { id: 2, title: "D", requires_signature: true, signatures: [] },
      jest.fn()
    );
    expect(mockShowNotification).toHaveBeenCalledWith(
      "No estás autorizado para firmar este documento",
      "error"
    );

    await signDocument(
      {
        id: 3,
        title: "D",
        requires_signature: true,
        signatures: [{ signer_email: "a@a.com", signed: true }],
      },
      jest.fn()
    );
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Ya has firmado este documento",
      "info"
    );
  });

  test("signDocument: user without signature can open electronic signature modal", async () => {
    const documentStore = { init: jest.fn(), documents: [] };
    const userStore = { currentUser: { id: 1, email: "a@a.com", has_signature: false } };
    const emit = jest.fn();

    const { signDocument } = useDocumentActions(documentStore, userStore, emit);

    mockShowConfirmationAlert.mockResolvedValueOnce(true);

    await signDocument(
      {
        id: 10,
        title: "Doc",
        requires_signature: true,
        signatures: [{ signer_email: "a@a.com", signed: false }],
      },
      jest.fn()
    );

    expect(emit).toHaveBeenCalledWith("open-electronic-signature");
  });

  test("signDocument: user without signature declines creating signature", async () => {
    const documentStore = { init: jest.fn(), documents: [] };
    const userStore = { currentUser: { id: 1, email: "a@a.com", has_signature: false } };
    const emit = jest.fn();

    mockShowConfirmationAlert.mockResolvedValueOnce(false);

    const { signDocument } = useDocumentActions(documentStore, userStore, emit);

    await signDocument(
      {
        id: 10,
        title: "Doc",
        requires_signature: true,
        signatures: [{ signer_email: "a@a.com", signed: false }],
      },
      jest.fn()
    );

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Para firmar documentos necesitas tener una firma registrada.",
      "info"
    );
    expect(mockShowNotification).toHaveBeenCalledWith(
      "Necesitas una firma para poder firmar documentos.",
      "warning"
    );
    expect(emit).not.toHaveBeenCalledWith("open-electronic-signature");
  });

  test("signDocument: confirmation cancelled shows info notification", async () => {
    const documentStore = { init: jest.fn(), documents: [] };
    const userStore = { currentUser: { id: 1, email: "a@a.com", has_signature: true } };
    const emit = jest.fn();

    mockShowConfirmationAlert.mockResolvedValueOnce(false);

    const { signDocument } = useDocumentActions(documentStore, userStore, emit);

    await signDocument(
      {
        id: 3,
        title: "Doc",
        requires_signature: true,
        signatures: [{ signer_email: "a@a.com", signed: false }],
      },
      jest.fn()
    );

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Operación de firma cancelada",
      "info"
    );
  });

  test("signDocument: confirmed signing triggers request, refresh, and opens signatures modal (not fully signed)", async () => {
    jest.useFakeTimers();

    create_request.mockResolvedValueOnce({ status: 201, statusText: "Created" });

    const documentToSign = {
      id: 1,
      title: "Doc",
      requires_signature: true,
      signatures: [
        { signer_email: "a@a.com", signed: false },
        { signer_email: "b@b.com", signed: false },
      ],
    };

    const updatedDocument = {
      id: 1,
      title: "Doc",
      requires_signature: true,
      signatures: [
        { signer_email: "a@a.com", signed: true },
        { signer_email: "b@b.com", signed: false },
      ],
    };

    const documentStore = {
      init: jest.fn().mockResolvedValue(),
      documents: [updatedDocument],
    };
    const userStore = { currentUser: { id: 9, email: "a@a.com", has_signature: true } };
    const emit = jest.fn();
    const openModalFn = jest.fn();

    mockShowConfirmationAlert.mockResolvedValueOnce(true);

    const { signDocument } = useDocumentActions(documentStore, userStore, emit);

    await signDocument(documentToSign, openModalFn);

    expect(create_request).toHaveBeenCalledWith("dynamic-documents/1/sign/9/", {});
    expect(documentStore.init).toHaveBeenCalledWith(true);

    expect(emit).toHaveBeenCalledWith("refresh");

    jest.advanceTimersByTime(1000);
    expect(openModalFn).toHaveBeenCalledWith("signatures", updatedDocument);

    jest.useRealTimers();
  });

  test("signDocument: uses original document when store has no updated documents", async () => {
    jest.useFakeTimers();

    create_request.mockResolvedValueOnce({ status: 200, statusText: "OK" });

    const documentToSign = {
      id: 7,
      title: "Doc",
      requires_signature: true,
      signatures: [{ signer_email: "a@a.com", signed: false }],
    };

    const documentStore = {
      init: jest.fn().mockResolvedValue(),
      documents: undefined,
    };
    const userStore = { currentUser: { id: 9, email: "a@a.com", has_signature: true } };
    const emit = jest.fn();
    const openModalFn = jest.fn();

    mockShowConfirmationAlert.mockResolvedValueOnce(true);

    const { signDocument } = useDocumentActions(documentStore, userStore, emit);

    await signDocument(documentToSign, openModalFn);

    expect(emit).toHaveBeenCalledWith("refresh");

    jest.advanceTimersByTime(1000);
    expect(openModalFn).toHaveBeenCalledWith("signatures", documentToSign);

    jest.useRealTimers();
  });

  test("signDocument: fully signed path emits document-fully-signed and opens modal after delays", async () => {
    jest.useFakeTimers();

    create_request.mockResolvedValueOnce({ status: 200, statusText: "OK" });

    const documentToSign = {
      id: 2,
      title: "Doc2",
      requires_signature: true,
      signatures: [
        { signer_email: "a@a.com", signed: false },
        { signer_email: "b@b.com", signed: true },
      ],
    };

    const updatedDocument = {
      id: 2,
      title: "Doc2",
      requires_signature: true,
      signatures: [
        { signer_email: "a@a.com", signed: true },
        { signer_email: "b@b.com", signed: true },
      ],
    };

    const documentStore = {
      init: jest.fn().mockResolvedValue(),
      documents: [updatedDocument],
    };
    const userStore = { currentUser: { id: 9, email: "a@a.com", has_signature: true } };
    const emit = jest.fn();
    const openModalFn = jest.fn();

    mockShowConfirmationAlert.mockResolvedValueOnce(true);

    const { signDocument } = useDocumentActions(documentStore, userStore, emit);

    await signDocument(documentToSign, openModalFn);

    expect(emit).toHaveBeenCalledWith("document-fully-signed", updatedDocument);

    jest.advanceTimersByTime(500);
    expect(emit).toHaveBeenCalledWith("refresh");

    jest.advanceTimersByTime(1500);
    expect(openModalFn).toHaveBeenCalledWith("signatures", updatedDocument);

    jest.useRealTimers();
  });

  test("downloadSignedDocument: guards and success", async () => {
    const { downloadSignedDocument } = useDocumentActions({}, { currentUser: {} }, jest.fn());

    await downloadSignedDocument({ id: 1, title: "Doc", state: "Draft" });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "El documento debe estar completamente firmado para descargarlo",
      "warning"
    );

    await downloadSignedDocument({ id: 1, title: "Doc", state: "FullySigned", signatures: [] });
    expect(mockShowNotification).toHaveBeenCalledWith(
      "El documento no tiene firmas registradas",
      "warning"
    );

    await downloadSignedDocument({
      id: 5,
      title: "Doc",
      state: "FullySigned",
      signatures: [{ signed: true }],
    });

    expect(mockDownloadFile).toHaveBeenCalledWith(
      "dynamic-documents/5/generate-signatures-pdf/",
      "firmas_Doc.pdf"
    );
  });

  test("downloadSignedDocument: download failure shows error notification", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    mockDownloadFile.mockRejectedValueOnce(new Error("fail"));

    const { downloadSignedDocument } = useDocumentActions({}, { currentUser: {} }, jest.fn());

    await downloadSignedDocument({
      id: 6,
      title: "Doc",
      state: "FullySigned",
      signatures: [{ signed: true }],
    });

    expect(mockShowNotification).toHaveBeenCalledWith(
      "Error al descargar el documento firmado",
      "error"
    );

    consoleSpy.mockRestore();
  });
});

describe("useCardModals", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("openModal closes all and opens requested modal", () => {
    const { activeModals, openModal } = useCardModals({}, { currentUser: { role: "lawyer" } });

    openModal("edit", { id: 1 });
    expect(activeModals.value.edit.isOpen).toBe(true);
    expect(activeModals.value.email.isOpen).toBe(false);

    openModal("email", { id: 2 });
    expect(activeModals.value.edit.isOpen).toBe(false);
    expect(activeModals.value.email.isOpen).toBe(true);
  });

  test("openModal preview uses openPreviewModal and keeps all modals closed", () => {
    const { activeModals, openModal } = useCardModals({}, { currentUser: { role: "lawyer" } });

    openModal("edit", { id: 1 });
    openModal("preview", { id: 9 });

    expect(mockOpenPreviewModal).toHaveBeenCalledWith({ id: 9 });
    expect(activeModals.value.edit.isOpen).toBe(false);
    expect(activeModals.value.email.isOpen).toBe(false);
  });

  test("closeModal and closeAllModals reset state", () => {
    const { activeModals, openModal, closeModal, closeAllModals } = useCardModals(
      {},
      { currentUser: { role: "lawyer" } }
    );

    openModal("email", { id: 2 });
    closeModal("email");
    expect(activeModals.value.email.isOpen).toBe(false);

    openModal("edit", { id: 1 });
    openModal("signatures", { id: 3 });
    closeAllModals();
    Object.values(activeModals.value).forEach((v) => {
      expect(v.isOpen).toBe(false);
      expect(v.document).toBe(null);
    });
  });

  test("closeModal ignores unknown modal types", () => {
    const { activeModals, closeModal } = useCardModals({}, { currentUser: { role: "lawyer" } });

    closeModal("unknown");

    expect(activeModals.value.edit.isOpen).toBe(false);
    expect(activeModals.value.email.isOpen).toBe(false);
  });

  test("getUserRole returns role or defaults to client", () => {
    expect(useCardModals({}, { currentUser: { role: "lawyer" } }).getUserRole()).toBe(
      "lawyer"
    );
    expect(useCardModals({}, null).getUserRole()).toBe("client");
    expect(useCardModals({}, {}).getUserRole()).toBe("client");
  });

  test("openModal handles extra modal types and unknown types", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { activeModals, openModal } = useCardModals({}, { currentUser: { role: "client" } });

    openModal("electronic-signature", { id: 1 });
    expect(activeModals.value.electronicSignature.isOpen).toBe(true);

    openModal("permissions", { id: 2 });
    expect(activeModals.value.permissions.isOpen).toBe(true);

    openModal("letterhead", { id: 3 });
    expect(activeModals.value.letterhead.isOpen).toBe(true);

    openModal("relationships", { id: 4 });
    expect(activeModals.value.relationships.isOpen).toBe(true);

    openModal("unknown-modal", { id: 5 });
    expect(warnSpy).toHaveBeenCalledWith("Unknown modal type: unknown-modal");

    warnSpy.mockRestore();
  });
});
