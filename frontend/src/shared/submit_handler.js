import Swal from "sweetalert2";
import { useProcessStore } from "@/stores/process";

/**
 * Handles the submission process for creating or editing a record.
 * Displays a loading alert during the process and shows success or error alerts based on the result.
 *
 * @param {object} formData - The form data to create or edit a record.
 * @param {string} text_response - The success message to display.
 * @param {boolean} isEditing - Flag to determine if it's an edit operation.
 * @returns {boolean} - True if the process was successful, false otherwise.
 */
export async function submitHandler(formData, text_response, isEditing) {
  const processStore = useProcessStore();

  // Show loading alert
  Swal.fire({
    title: "Processing...",
    text: "Please wait while we process your request.",
    allowOutsideClick: false,
    showConfirmButton: false,
    didOpen: () => {
      Swal.showLoading(); // Show a loading spinner
    },
  });

  // Perform the create or update process
  const responseStatus = await (isEditing
    ? processStore.updateProcess(formData)
    : processStore.createProcess(formData));

  // Close the loading alert
  Swal.close();

  // Show success or error alert based on the result
  if (responseStatus == 201 || (isEditing && responseStatus == 200)) {
    Swal.fire({
      icon: "success",
      title: "Success",
      text: text_response,
      confirmButtonText: "OK!",
    }).then((result) => {
      if (result.isConfirmed) return true;
    });
  } else {
    Swal.fire({
      icon: "error",
      title: "Oops...",
      text: "Something went wrong!",
      footer: "<a>Try again or later.</a>",
    });
    return false;
  }
}
