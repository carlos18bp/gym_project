import {
  get_request,
  create_request,
  upload_file_request,
} from "../services/request_http";
import { downloadFile } from "@/shared/document_utils";

const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * Contract-execution (cuentas de cobro) actions.
 *
 * Every mutation returns the same payload shape as the list endpoint,
 * so callers refresh their local view directly from the response — the
 * backend is the single source of truth for the sequential rules.
 */
export const paymentRecordActions = {
  /**
   * Fetch every installment slot of a document.
   * @param {number|string} documentId
   * @returns {Promise<Object>} payments payload (configured, slots, ...)
   */
  async fetchPaymentRecords(documentId) {
    try {
      const response = await get_request(
        `dynamic-documents/${documentId}/payment-records/`
      );
      return response.data;
    } catch (error) {
      console.error(
        `Error fetching payment records for document ${documentId}:`,
        error
      );
      throw error;
    }
  },

  /**
   * Upload (or re-upload) the cuenta de cobro of an installment.
   * @param {number|string} documentId
   * @param {Object} payload
   * @param {File} payload.file
   * @param {number} payload.installmentNumber
   * @param {string|number|null} [payload.amount]
   * @param {string|null} [payload.notes]
   * @returns {Promise<Object>} refreshed payments payload
   */
  async uploadPaymentRecord(documentId, { file, installmentNumber, amount, notes }) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("installment_number", installmentNumber);
    if (amount !== null && amount !== undefined && amount !== "") {
      formData.append("amount", amount);
    }
    if (notes) {
      formData.append("notes", notes);
    }

    const response = await upload_file_request(
      `dynamic-documents/${documentId}/payment-records/upload/`,
      formData
    );
    return response.data;
  },

  /**
   * Accept a cuenta de cobro (creator lawyer only).
   * @returns {Promise<Object>} refreshed payments payload
   */
  async acceptPaymentRecord(documentId, recordId) {
    const response = await create_request(
      `dynamic-documents/${documentId}/payment-records/${recordId}/accept/`,
      {}
    );
    return response.data;
  },

  /**
   * Reject a cuenta de cobro with a mandatory reason (creator lawyer only).
   * @returns {Promise<Object>} refreshed payments payload
   */
  async rejectPaymentRecord(documentId, recordId, reason) {
    const response = await create_request(
      `dynamic-documents/${documentId}/payment-records/${recordId}/reject/`,
      { rejection_reason: reason }
    );
    return response.data;
  },

  /**
   * Download the file of a payment record.
   * @param {number|string} documentId
   * @param {number|string} recordId
   * @param {string} filename - original filename to save as
   */
  async downloadPaymentRecordFile(documentId, recordId, filename) {
    const extension = (filename || "").split(".").pop().toLowerCase();
    const mimeType = MIME_BY_EXTENSION[extension] || "application/octet-stream";
    try {
      await downloadFile(
        `dynamic-documents/${documentId}/payment-records/${recordId}/download/`,
        filename || "cuenta_de_cobro",
        mimeType
      );
    } catch (error) {
      console.error(
        `Error downloading payment record ${recordId} of document ${documentId}:`,
        error
      );
      throw error;
    }
  },
};
