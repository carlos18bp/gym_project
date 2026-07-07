import {
  getMenuOptionsForCardType,
  canPublishDocument,
  canSignDocument,
} from "@/components/dynamic_document/cards/menuOptionsHelper";

describe("menuOptionsHelper.js", () => {
  test("returns [] for unknown cardType", () => {
    expect(getMenuOptionsForCardType("unknown", { id: 1 }, "list", null)).toEqual([]);
  });

  describe("helpers", () => {
    test("canPublishDocument handles missing/empty variables and valid names", () => {
      expect(canPublishDocument({})).toBe(true);
      expect(canPublishDocument({ variables: [] })).toBe(true);
      expect(canPublishDocument({ variables: [{ name_es: "Contrato" }] })).toBe(true);
      expect(canPublishDocument({ variables: [{ name_es: "" }] })).toBe(false);
    });

    test("canSignDocument guards when user cannot sign", () => {
      const userStore = { currentUser: { email: "a@a.com" } };

      expect(canSignDocument({ requires_signature: false }, userStore)).toBe(false);
      expect(
        canSignDocument({ requires_signature: true, state: "Draft" }, userStore)
      ).toBe(false);
      expect(
        canSignDocument(
          { requires_signature: true, state: "PendingSignatures", signatures: [] },
          userStore
        )
      ).toBe(false);
      expect(
        canSignDocument(
          {
            requires_signature: true,
            state: "PendingSignatures",
            signatures: [{ signer_email: "b@b.com", signed: false }],
          },
          userStore
        )
      ).toBe(false);
      expect(
        canSignDocument(
          {
            requires_signature: true,
            state: "PendingSignatures",
            signatures: [{ signer_email: "a@a.com", signed: true }],
          },
          userStore
        )
      ).toBe(false);
      expect(
        canSignDocument(
          {
            requires_signature: true,
            state: "PendingSignatures",
            signatures: [{ signer_email: "a@a.com", signed: false }],
          },
          userStore
        )
      ).toBe(true);
    });
  });

  describe("lawyer", () => {
    test("use-template context as lawyer returns only preview and useTemplate", () => {
      const options = getMenuOptionsForCardType(
        "lawyer",
        { id: 1, state: "Published" },
        "use-template",
        { currentUser: { email: "x@x.com" } }
      );

      expect(options).toEqual([
        { label: "Previsualización", action: "preview" },
        { label: "Usar plantilla", action: "useTemplate" },
      ]);
    });

    test("legal-documents Draft uses edit submenu and does not include relationships", () => {
      const options = getMenuOptionsForCardType(
        "lawyer",
        { id: 1, state: "Draft", created_by: 7 },
        "legal-documents",
        { currentUser: { id: 7, email: "x@x.com" } }
      );

      const edit = options.find((o) => o.action === "edit-submenu");
      expect(edit).toBeTruthy();
      expect(edit.children.map((c) => c.action)).toEqual(
        expect.arrayContaining(["edit", "editDocument", "editForm"])
      );

      expect(options.some((o) => o.action === "relationships")).toBe(false);
    });

    test("legal-documents Published uses edit submenu and omits relationships", () => {
      const options = getMenuOptionsForCardType(
        "lawyer",
        { id: 1, state: "Published", created_by: 7 },
        "legal-documents",
        { currentUser: { id: 7, email: "x@x.com" } }
      );

      expect(options.some((o) => o.action === "edit-submenu")).toBe(true);
      expect(options.some((o) => o.action === "relationships")).toBe(false);
      expect(options.some((o) => o.action === "draft")).toBe(true);
    });

    test("legal-documents owner menu includes the share-edit toggle", () => {
      const notShared = getMenuOptionsForCardType(
        "lawyer",
        { id: 1, state: "Draft", created_by: 7, allow_shared_edit: false },
        "legal-documents",
        { currentUser: { id: 7 } }
      );
      const shared = getMenuOptionsForCardType(
        "lawyer",
        { id: 1, state: "Draft", created_by: 7, allow_shared_edit: true },
        "legal-documents",
        { currentUser: { id: 7 } }
      );

      expect(notShared.find((o) => o.action === "toggleSharedEdit").label).toBe("Compartir edición");
      expect(shared.find((o) => o.action === "toggleSharedEdit").label).toBe("Dejar de compartir");
    });

    test("legal-documents non-owner without shared flag gets only use actions", () => {
      const options = getMenuOptionsForCardType(
        "lawyer",
        { id: 1, state: "Draft", created_by: 7, allow_shared_edit: false },
        "legal-documents",
        { currentUser: { id: 8 } }
      );

      const actions = options.map((o) => o.action);
      expect(actions).toEqual(expect.arrayContaining(["preview", "copy", "addToFolder"]));
      ["edit-submenu", "permissions", "delete", "letterhead", "toggleSharedEdit", "publish", "draft"].forEach((a) => {
        expect(actions).not.toContain(a);
      });
    });

    test("legal-documents non-owner with shared flag can edit but not delete or change state", () => {
      const options = getMenuOptionsForCardType(
        "lawyer",
        { id: 1, state: "Published", created_by: 7, allow_shared_edit: true },
        "legal-documents",
        { currentUser: { id: 8 } }
      );

      const actions = options.map((o) => o.action);
      expect(actions).toContain("edit-submenu");
      ["permissions", "delete", "letterhead", "toggleSharedEdit", "draft"].forEach((a) => {
        expect(actions).not.toContain(a);
      });
    });

    test("legal-documents non-owner Published keeps read-only download actions", () => {
      const options = getMenuOptionsForCardType(
        "lawyer",
        { id: 1, state: "Published", created_by: 7, allow_shared_edit: false },
        "legal-documents",
        { currentUser: { id: 8 } }
      );

      const actions = options.map((o) => o.action);
      expect(actions).toEqual(
        expect.arrayContaining(["preview", "copy", "downloadPDF", "downloadWord"])
      );
    });

    test("non Draft/Published adds relationships option", () => {
      const options = getMenuOptionsForCardType(
        "lawyer",
        { id: 1, state: "Completed" },
        "list",
        { currentUser: { email: "x@x.com" } }
      );

      expect(options.some((o) => o.action === "relationships")).toBe(true);
    });

    test("Draft adds publish option disabled when variables missing name_es", () => {
      const options = getMenuOptionsForCardType(
        "lawyer",
        {
          id: 1,
          state: "Draft",
          variables: [{ name_es: "" }],
        },
        "list",
        null
      );

      const publish = options.find((o) => o.action === "publish");
      expect(publish).toBeTruthy();
      expect(publish.disabled).toBe(true);
    });

    test("Published adds draft (move to draft) option", () => {
      const options = getMenuOptionsForCardType("lawyer", { id: 1, state: "Published" }, "list", null);

      expect(options.some((o) => o.action === "draft")).toBe(true);
    });

    test("requires_signature PendingSignatures adds viewSignatures and sign when user can sign", () => {
      const options = getMenuOptionsForCardType(
        "lawyer",
        {
          id: 1,
          state: "PendingSignatures",
          requires_signature: true,
          signatures: [
            { signer_email: "a@a.com", signed: false },
            { signer_email: "b@b.com", signed: false },
          ],
        },
        "list",
        { currentUser: { email: "a@a.com" } }
      );

      expect(options.some((o) => o.action === "viewSignatures")).toBe(true);
      expect(options.some((o) => o.action === "sign")).toBe(true);
    });

    test("requires_signature FullySigned adds viewSignatures but not sign", () => {
      const options = getMenuOptionsForCardType(
        "lawyer",
        {
          id: 1,
          state: "FullySigned",
          requires_signature: true,
          signatures: [{ signer_email: "a@a.com", signed: true }],
        },
        "list",
        { currentUser: { email: "a@a.com" } }
      );

      expect(options.some((o) => o.action === "viewSignatures")).toBe(true);
      expect(options.some((o) => o.action === "sign")).toBe(false);
    });

    test("Completed in list uses base edit option, adds relationships, and includes download/email actions", () => {
      const options = getMenuOptionsForCardType(
        "lawyer",
        { id: 1, state: "Completed", variables: [] },
        "list",
        null
      );

      expect(options.some((o) => o.action === "edit")).toBe(true);
      expect(options.some((o) => o.action === "edit-submenu")).toBe(false);
      expect(options.some((o) => o.action === "relationships")).toBe(true);
      expect(options.some((o) => o.action === "downloadPDF")).toBe(true);
      expect(options.some((o) => o.action === "downloadWord")).toBe(true);
      expect(options.some((o) => o.action === "email")).toBe(true);
    });

    test("Completed informative document excludes edit-submenu and formalize in client card", () => {
      const options = getMenuOptionsForCardType(
        "client",
        { id: 1, state: "Completed", signature_type: "informative" },
        "list",
        { currentUser: { email: "x@x.com", role: "client" } }
      );

      expect(options.some((o) => o.action === "edit-submenu")).toBe(false);
      expect(options.some((o) => o.action === "formalize")).toBe(false);
    });

    test("Completed issuer_only document retains edit-submenu and formalize in client card", () => {
      const options = getMenuOptionsForCardType(
        "client",
        { id: 1, state: "Completed", signature_type: "issuer_only" },
        "list",
        { currentUser: { email: "x@x.com", role: "client" } }
      );

      expect(options.some((o) => o.action === "edit-submenu")).toBe(true);
      expect(options.some((o) => o.action === "formalize")).toBe(true);
    });
  });

  describe("signatures", () => {
    test("does not add signature state options when requires_signature is false", () => {
      const options = getMenuOptionsForCardType(
        "signatures",
        { id: 1, state: "PendingSignatures", relationships_count: 1, requires_signature: false },
        "list",
        { currentUser: { email: "a@a.com" } }
      );

      expect(options.some((o) => o.action === "viewSignatures")).toBe(false);
      expect(options.some((o) => o.action === "sign")).toBe(false);
    });

    test("does not add viewSignatures when signature state is not tracked", () => {
      const options = getMenuOptionsForCardType(
        "signatures",
        { id: 1, state: "Draft", relationships_count: 1, requires_signature: true },
        "list",
        { currentUser: { email: "a@a.com" } }
      );

      expect(options.some((o) => o.action === "viewSignatures")).toBe(false);
    });
    test("relationships option is disabled when relationships_count is 0", () => {
      const options = getMenuOptionsForCardType(
        "signatures",
        { id: 1, state: "PendingSignatures", relationships_count: 0, requires_signature: true, signatures: [] },
        "list",
        null
      );

      const rel = options.find((o) => o.action === "relationships");
      expect(rel).toBeTruthy();
      expect(rel.disabled).toBe(true);
    });

    test("adds reject option when user can sign and document is PendingSignatures", () => {
      const options = getMenuOptionsForCardType(
        "signatures",
        {
          id: 1,
          state: "PendingSignatures",
          requires_signature: true,
          signatures: [{ signer_email: "a@a.com", signed: false }],
        },
        "list",
        { currentUser: { email: "a@a.com" } }
      );

      expect(options.some((o) => o.action === "sign")).toBe(true);
      expect(options.some((o) => o.action === "reject")).toBe(true);
    });

    test("PendingSignatures enables relationships when count > 0 and adds downloadPDF", () => {
      const options = getMenuOptionsForCardType(
        "signatures",
        {
          id: 1,
          state: "PendingSignatures",
          relationships_count: 2,
          requires_signature: true,
          signatures: [{ signer_email: "a@a.com", signed: false }],
        },
        "list",
        { currentUser: { email: "a@a.com" } }
      );

      const relationships = options.find((o) => o.action === "relationships");
      expect(relationships).toBeTruthy();
      expect(relationships.disabled).toBe(false);
      expect(options.some((o) => o.action === "downloadPDF")).toBe(true);
    });

    test("FullySigned adds downloadSignedDocument", () => {
      const options = getMenuOptionsForCardType(
        "signatures",
        { id: 1, state: "FullySigned", requires_signature: true, signatures: [] },
        "list",
        null
      );

      expect(options.some((o) => o.action === "downloadSignedDocument")).toBe(true);
    });

    test("my-documents Expired keeps locked preview/download flow", () => {
      const options = getMenuOptionsForCardType(
        "client",
        {
          id: 1,
          state: "Expired",
          requires_signature: true,
        },
        "my-documents",
        { currentUser: { role: "basic" } }
      );

      expect(options.some((o) => o.action === "preview")).toBe(true);
      expect(options.some((o) => o.action === "downloadPDF")).toBe(true);
      const downloadWord = options.find((o) => o.action === "downloadWord");
      expect(downloadWord).toBeTruthy();
      expect(downloadWord.disabled).toBe(true);
      expect(options.some((o) => o.action === "delete")).toBe(false);
    });

    test("my-documents Rejected does not lock actions", () => {
      const options = getMenuOptionsForCardType(
        "client",
        {
          id: 1,
          state: "Rejected",
          requires_signature: true,
        },
        "my-documents",
        { currentUser: { role: "client" } }
      );

      expect(options.some((o) => o.action === "editForm")).toBe(true);
      expect(options.some((o) => o.action === "delete")).toBe(true);
    });

    test("Rejected adds viewRejectionReason when any signature has rejection_comment", () => {
      const options = getMenuOptionsForCardType(
        "signatures",
        {
          id: 1,
          state: "Rejected",
          requires_signature: true,
          signatures: [{ rejection_comment: "no" }],
        },
        "list",
        { currentUser: { id: 99, role: "client" } }
      );

      expect(options.some((o) => o.action === "viewRejectionReason")).toBe(true);
    });

    test("Rejected adds editAndResend when user is creator", () => {
      const options = getMenuOptionsForCardType(
        "signatures",
        {
          id: 1,
          state: "Rejected",
          requires_signature: true,
          created_by: 7,
          signatures: [],
        },
        "list",
        { currentUser: { id: 7, role: "client" } }
      );

      expect(options.some((o) => o.action === "editAndResend")).toBe(true);
    });

    test("Rejected adds editAndResend when user is lawyer", () => {
      const options = getMenuOptionsForCardType(
        "signatures",
        {
          id: 1,
          state: "Rejected",
          requires_signature: true,
          created_by: 99,
          signatures: [],
        },
        "list",
        { currentUser: { id: 7, role: "lawyer" }, isLawyerLike: true }
      );

      expect(options.some((o) => o.action === "editAndResend")).toBe(true);
    });

    test("Expired adds editAndResend when user is creator", () => {
      const options = getMenuOptionsForCardType(
        "signatures",
        {
          id: 1,
          state: "Expired",
          requires_signature: true,
          created_by: 7,
          signatures: [],
        },
        "list",
        { currentUser: { id: 7, role: "client" } }
      );

      expect(options.some((o) => o.action === "editAndResend")).toBe(true);
    });

    test("Expired adds editAndResend when user is lawyer", () => {
      const options = getMenuOptionsForCardType(
        "signatures",
        {
          id: 1,
          state: "Expired",
          requires_signature: true,
          created_by: 99,
          signatures: [],
        },
        "list",
        { currentUser: { id: 7, role: "lawyer" }, isLawyerLike: true }
      );

      expect(options.some((o) => o.action === "editAndResend")).toBe(true);
    });

    test("Expired does not add editAndResend for unrelated non-lawyer user", () => {
      const options = getMenuOptionsForCardType(
        "signatures",
        {
          id: 1,
          state: "Expired",
          requires_signature: true,
          created_by: 99,
          signatures: [],
        },
        "list",
        { currentUser: { id: 7, role: "client" } }
      );

      expect(options.some((o) => o.action === "editAndResend")).toBe(false);
    });
  });

  describe("client", () => {
    test("use-template context as client returns only preview and useTemplate", () => {
      const options = getMenuOptionsForCardType(
        "client",
        { id: 1, state: "Published" },
        "use-template",
        { currentUser: { role: "client" } }
      );

      expect(options).toEqual([
        { label: "Previsualización", action: "preview" },
        { label: "Usar plantilla", action: "useTemplate" },
      ]);
    });

    test("Completed with non-standard role omits formalize", () => {
      const options = getMenuOptionsForCardType(
        "client",
        {
          id: 1,
          state: "Completed",
          requires_signature: false,
        },
        "list",
        { currentUser: { role: "guest" } }
      );

      expect(options.some((o) => o.action === "formalize")).toBe(false);
    });

    test("Progress with non-standard role omits formalize", () => {
      const options = getMenuOptionsForCardType(
        "client",
        {
          id: 1,
          state: "Progress",
          requires_signature: false,
        },
        "list",
        { currentUser: { role: "guest" } }
      );

      expect(options.some((o) => o.action === "formalize")).toBe(false);
    });
    test("my-documents signature state PendingSignatures is locked to preview + download only", () => {
      const options = getMenuOptionsForCardType(
        "client",
        {
          id: 1,
          state: "PendingSignatures",
          requires_signature: true,
        },
        "my-documents",
        { currentUser: { role: "client" } }
      );

      expect(options.map((o) => o.action)).toEqual(
        expect.arrayContaining(["preview", "downloadPDF", "downloadWord"])
      );
      expect(options.some((o) => o.action === "delete")).toBe(false);
      expect(options.some((o) => o.action === "editForm")).toBe(false);
    });

    test("basic user Completed does not include editDocument and disables formalize/letterhead/relationships/downloads", () => {
      const options = getMenuOptionsForCardType(
        "client",
        {
          id: 1,
          state: "Completed",
          requires_signature: false,
        },
        "list",
        { currentUser: { role: "basic" } }
      );

      const edit = options.find((o) => o.action === "edit-submenu");
      expect(edit).toBeTruthy();
      expect(edit.children.some((c) => c.action === "editDocument")).toBe(false);

      const disabledActions = [
        "formalize",
        "letterhead",
        "relationships",
        "downloadWord",
        "email",
      ].map((action) => options.find((o) => o.action === action));

      expect(disabledActions.every(Boolean)).toBe(true);
      expect(disabledActions.every((option) => option.disabled)).toBe(true);
    });

    test("Progress includes preview and disables relationships and downloads", () => {
      const options = getMenuOptionsForCardType(
        "client",
        {
          id: 1,
          state: "Progress",
          requires_signature: false,
        },
        "list",
        { currentUser: { role: "client" } }
      );

      expect(options.some((o) => o.action === "preview")).toBe(true);

      const relationships = options.find((o) => o.action === "relationships");
      expect(relationships).toBeTruthy();
      expect(relationships.disabled).toBe(true);

      const formalize = options.find((o) => o.action === "formalize");
      expect(formalize).toBeTruthy();
      expect(formalize.disabled).toBe(true);

      const downloadPdf = options.find((o) => o.action === "downloadPDF");
      expect(downloadPdf).toBeTruthy();
      expect(downloadPdf.disabled).toBe(true);
    });

    test("my-documents PendingSignatures basic user disables downloadWord", () => {
      const options = getMenuOptionsForCardType(
        "client",
        {
          id: 1,
          state: "PendingSignatures",
          requires_signature: true,
        },
        "my-documents",
        { currentUser: { role: "basic" } }
      );

      const downloadWord = options.find((o) => o.action === "downloadWord");
      expect(downloadWord).toBeTruthy();
      expect(downloadWord.disabled).toBe(true);
    });

    test("my-documents FullySigned includes downloadSignedDocument", () => {
      const options = getMenuOptionsForCardType(
        "client",
        {
          id: 1,
          state: "FullySigned",
          requires_signature: true,
        },
        "my-documents",
        { currentUser: { role: "client" } }
      );

      expect(options.some((o) => o.action === "downloadSignedDocument")).toBe(true);
    });

    test("Completed non-basic user includes editDocument", () => {
      const options = getMenuOptionsForCardType(
        "client",
        {
          id: 1,
          state: "Completed",
          requires_signature: false,
        },
        "list",
        { currentUser: { role: "client" } }
      );

      const edit = options.find((o) => o.action === "edit-submenu");
      expect(edit).toBeTruthy();
      expect(edit.children.some((c) => c.action === "editDocument")).toBe(true);
    });

    test("Completed corporate user enables formalize, letterhead, relationships, and downloads", () => {
      const options = getMenuOptionsForCardType(
        "client",
        {
          id: 1,
          state: "Completed",
          requires_signature: false,
        },
        "list",
        { currentUser: { role: "corporate_client" } }
      );

      const enabledActions = [
        "formalize",
        "letterhead",
        "relationships",
        "downloadPDF",
        "downloadWord",
        "email",
      ].map((action) => options.find((o) => o.action === action));

      expect(enabledActions.every(Boolean)).toBe(true);
      expect(enabledActions.every((option) => option.disabled !== true)).toBe(true);
    });

    test("Draft includes Completar and omits preview", () => {
      const options = getMenuOptionsForCardType(
        "client",
        {
          id: 1,
          state: "Draft",
          requires_signature: false,
        },
        "list",
        { currentUser: { role: "client" } }
      );

      expect(options.some((o) => o.action === "editForm")).toBe(true);
      expect(options.some((o) => o.action === "preview")).toBe(false);
    });

    test("list signature state includes viewSignatures and sign", () => {
      const options = getMenuOptionsForCardType(
        "client",
        {
          id: 1,
          state: "PendingSignatures",
          requires_signature: true,
          signatures: [{ signer_email: "a@a.com", signed: false }],
        },
        "list",
        { currentUser: { role: "client", email: "a@a.com" } }
      );

      expect(options.some((o) => o.action === "viewSignatures")).toBe(true);
      expect(options.some((o) => o.action === "sign")).toBe(true);
    });

    test("list signature state includes viewSignatures but not sign when user cannot sign", () => {
      const options = getMenuOptionsForCardType(
        "client",
        {
          id: 1,
          state: "PendingSignatures",
          requires_signature: true,
          signatures: [{ signer_email: "b@b.com", signed: false }],
        },
        "list",
        { currentUser: { role: "client", email: "a@a.com" } }
      );

      expect(options.some((o) => o.action === "viewSignatures")).toBe(true);
      expect(options.some((o) => o.action === "sign")).toBe(false);
    });
  });

  test("getMenuOptionsForCardType uses default args", () => {
    const options = getMenuOptionsForCardType("lawyer", { id: 1, state: "Draft" });

    expect(Array.isArray(options)).toBe(true);
    expect(options.some((o) => o.action === "edit")).toBe(true);
  });

  describe("contract execution (cuentas de cobro) menu options", () => {
    const creatorStore = { currentUser: { id: 10, role: "lawyer" }, isLawyerLike: true };
    const clientStore = { currentUser: { id: 20, role: "client" } };
    const strangerStore = { currentUser: { id: 99, role: "client" } };

    const buildSignedDoc = (overrides = {}) => ({
      id: 1,
      state: "FullySigned",
      created_by: 10,
      assigned_to: 20,
      summary_payment_installments: 3,
      payments_summary: {
        accepted_count: 0,
        in_review: false,
        next_uploadable: 1,
        total_amount_accepted: null,
      },
      ...overrides,
    });

    test("creator lawyer sees both payment actions on signed docs with plan", () => {
      const options = getMenuOptionsForCardType(
        "signatures", buildSignedDoc(), "table", creatorStore
      );

      expect(options.some((o) => o.action === "uploadPaymentRecord")).toBe(true);
      expect(options.some((o) => o.action === "viewPaymentRecords")).toBe(true);
    });

    test("assigned client with no uploadable slot only sees the detail action", () => {
      const doc = buildSignedDoc({
        payments_summary: {
          accepted_count: 0,
          in_review: true,
          next_uploadable: null,
          total_amount_accepted: null,
        },
      });
      const options = getMenuOptionsForCardType("signatures", doc, "table", clientStore);

      expect(options.some((o) => o.action === "uploadPaymentRecord")).toBe(false);
      expect(options.some((o) => o.action === "viewPaymentRecords")).toBe(true);
    });

    test("third parties never see payment actions", () => {
      const options = getMenuOptionsForCardType(
        "signatures", buildSignedDoc(), "table", strangerStore
      );

      expect(options.some((o) => o.action === "uploadPaymentRecord")).toBe(false);
      expect(options.some((o) => o.action === "viewPaymentRecords")).toBe(false);
    });

    test("documents without a payment plan expose no payment actions", () => {
      const doc = buildSignedDoc({
        summary_payment_installments: null,
        payments_summary: null,
      });
      const options = getMenuOptionsForCardType("signatures", doc, "table", creatorStore);

      expect(options.some((o) => o.action === "viewPaymentRecords")).toBe(false);
    });

    test("non-signed documents expose no payment actions", () => {
      const doc = buildSignedDoc({ state: "PendingSignatures" });
      const options = getMenuOptionsForCardType("signatures", doc, "table", creatorStore);

      expect(options.some((o) => o.action === "viewPaymentRecords")).toBe(false);
    });

    test("lawyer card locked menu includes payment actions for signed docs", () => {
      const options = getMenuOptionsForCardType(
        "lawyer", buildSignedDoc(), "list", creatorStore
      );

      expect(options.some((o) => o.action === "uploadPaymentRecord")).toBe(true);
      expect(options.some((o) => o.action === "viewPaymentRecords")).toBe(true);
    });

    test("client my-documents locked menu includes payment actions for signed docs", () => {
      const doc = buildSignedDoc({ requires_signature: true });
      const options = getMenuOptionsForCardType(
        "client", doc, "my-documents", clientStore
      );

      expect(options.some((o) => o.action === "uploadPaymentRecord")).toBe(true);
      expect(options.some((o) => o.action === "viewPaymentRecords")).toBe(true);
    });
  });
});
