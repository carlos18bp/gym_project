/**
 * Shared helpers for service request views.
 */

const STATUS_CLASSES = {
  OPEN: "bg-blue-100 text-blue-800",
  IN_STUDY: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-indigo-100 text-indigo-800",
  ANSWERED: "bg-emerald-100 text-emerald-800",
  FINALIZED: "bg-gray-100 text-gray-700",
};

export function statusClass(status) {
  return STATUS_CLASSES[status] || "bg-gray-100 text-gray-700";
}

export function formatDate(dateString) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString();
}
