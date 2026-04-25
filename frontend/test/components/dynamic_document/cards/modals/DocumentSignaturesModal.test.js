import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";

import DocumentSignaturesModal from "@/components/dynamic_document/cards/modals/DocumentSignaturesModal.vue";

const mockShowNotification = jest.fn().mockResolvedValue();
const mockShowConfirmationAlert = jest.fn();
const mockCreateRequest = jest.fn();
const mockGetRequest = jest.fn();
const mockRegisterUserActivity = jest.fn().mockResolvedValue();

let mockUserStore;
let mockDocumentStore;

jest.mock("@/stores/auth/user", () => ({
  __esModule: true,
  useUserStore: () => mockUserStore,
}));

jest.mock("@/stores/dynamic_document", () => ({
  __esModule: true,
  useDynamicDocumentStore: () => mockDocumentStore,
}));

jest.mock("@/stores/services/request_http", () => ({
  __esModule: true,
  get_request: (...args) => mockGetRequest(...args),
  create_request: (...args) => mockCreateRequest(...args),
}));

jest.mock("@/shared/notification_message", () => ({
  __esModule: true,
  showNotification: (...args) => mockShowNotification(...args),
}));

jest.mock("@/shared/confirmation_alert", () => ({
  __esModule: true,
  showConfirmationAlert: (...args) => mockShowConfirmationAlert(...args),
}));

jest.mock("@/stores/dashboard/activity_feed", () => ({
  __esModule: true,
  registerUserActivity: (...args) => mockRegisterUserActivity(...args),
  ACTION_TYPES: { FINISH: "finish" },
}));

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const ISSUER_ID = 100;
const RECIPIENT_ID = 200;

function buildIssuerOnlyDocument({ creatorSigned = false, currentUserId = ISSUER_ID, state = "PendingSignatures" } = {}) {
  return {
    id: 7,
    title: "Issuer-only doc",
    state,
    requires_signature: true,
    signature_type: "issuer_only",
    created_by: ISSUER_ID,
    completed_signatures: creatorSigned ? 2 : 1,
    total_signatures: 2,
    signers: [
      {
        signature_id: 901,
        signer_id: ISSUER_ID,
        signer_email: "issuer@example.com",
        signer_name: "Issuer",
        signed: creatorSigned,
        signed_at: creatorSigned ? "2026-04-25T10:00:00Z" : null,
        rejected: false,
        rejected_at: null,
        rejection_comment: null,
        is_current_user: currentUserId === ISSUER_ID,
        is_creator: true,
      },
      {
        signature_id: 902,
        signer_id: RECIPIENT_ID,
        signer_email: "recipient@example.com",
        signer_name: "Recipient",
        signed: true,
        signed_at: "2026-04-25T09:00:00Z",
        rejected: false,
        rejected_at: null,
        rejection_comment: null,
        is_current_user: currentUserId === RECIPIENT_ID,
        is_creator: false,
      },
    ],
  };
}

function mountModal(pinia) {
  return mount(DocumentSignaturesModal, {
    props: { documentId: 7 },
    global: { plugins: [pinia] },
  });
}

describe("DocumentSignaturesModal.vue — issuer_only labels and buttons", () => {
  let pinia;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    jest.clearAllMocks();
    mockDocumentStore = { documents: [] };
  });

  test("issuer_only emisor without signing renders 'Pendiente de Firma'", async () => {
    mockUserStore = { currentUser: { id: ISSUER_ID, email: "issuer@example.com", has_signature: true } };
    mockGetRequest.mockResolvedValue({ status: 200, data: [buildIssuerOnlyDocument({ creatorSigned: false })] });

    const wrapper = mountModal(pinia);
    await flushPromises();

    const issuerRow = wrapper.findAll("tbody tr").find((r) => r.text().includes("Issuer"));
    expect(issuerRow.text()).toContain("Pendiente de Firma");
  });

  test("issuer_only emisor after signing renders 'Firmado'", async () => {
    mockUserStore = { currentUser: { id: ISSUER_ID, email: "issuer@example.com", has_signature: true } };
    mockGetRequest.mockResolvedValue({ status: 200, data: [buildIssuerOnlyDocument({ creatorSigned: true })] });

    const wrapper = mountModal(pinia);
    await flushPromises();

    const issuerRow = wrapper.findAll("tbody tr").find((r) => r.text().includes("Issuer"));
    expect(issuerRow.text()).toContain("Firmado");
    expect(issuerRow.text()).not.toContain("Pendiente de Firma");
  });

  test("issuer_only recipient renders 'Informado' regardless of signed state", async () => {
    mockUserStore = { currentUser: { id: RECIPIENT_ID, email: "recipient@example.com", has_signature: true } };
    mockGetRequest.mockResolvedValue({ status: 200, data: [buildIssuerOnlyDocument({ currentUserId: RECIPIENT_ID })] });

    const wrapper = mountModal(pinia);
    await flushPromises();

    const recipientRow = wrapper.findAll("tbody tr").find((r) => r.text().includes("Recipient"));
    expect(recipientRow.text()).toContain("Informado");
  });

  test("issuer_only recipient does not see Firmar/Rechazar buttons", async () => {
    mockUserStore = { currentUser: { id: RECIPIENT_ID, email: "recipient@example.com", has_signature: true } };
    mockGetRequest.mockResolvedValue({ status: 200, data: [buildIssuerOnlyDocument({ currentUserId: RECIPIENT_ID })] });

    const wrapper = mountModal(pinia);
    await flushPromises();

    const buttonsText = wrapper.findAll("button").map((b) => b.text());
    expect(buttonsText).not.toContain("Firmar documento");
    expect(buttonsText).not.toContain("Rechazar documento");
  });

  test("issuer_only emisor pending sees Firmar/Rechazar buttons", async () => {
    mockUserStore = { currentUser: { id: ISSUER_ID, email: "issuer@example.com", has_signature: true } };
    mockGetRequest.mockResolvedValue({ status: 200, data: [buildIssuerOnlyDocument({ creatorSigned: false })] });

    const wrapper = mountModal(pinia);
    await flushPromises();

    const buttonsText = wrapper.findAll("button").map((b) => b.text());
    expect(buttonsText).toContain("Firmar documento");
    expect(buttonsText).toContain("Rechazar documento");
  });

  test("informative documents hide Firmar/Rechazar buttons for everyone", async () => {
    mockUserStore = { currentUser: { id: ISSUER_ID, email: "issuer@example.com", has_signature: true } };
    const informativeDoc = {
      ...buildIssuerOnlyDocument({ creatorSigned: false }),
      signature_type: "informative",
    };
    mockGetRequest.mockResolvedValue({ status: 200, data: [informativeDoc] });

    const wrapper = mountModal(pinia);
    await flushPromises();

    const buttonsText = wrapper.findAll("button").map((b) => b.text());
    expect(buttonsText).not.toContain("Firmar documento");
    expect(buttonsText).not.toContain("Rechazar documento");
  });
});
