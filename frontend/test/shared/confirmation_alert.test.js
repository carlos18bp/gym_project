const mockFire = jest.fn();

jest.mock("sweetalert2", () => ({
  __esModule: true,
  default: {
    fire: (...args) => mockFire(...args),
  },
}));

import { showConfirmationAlert } from "@/shared/confirmation_alert";

describe("confirmation_alert.js", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("showConfirmationAlert calls Swal.fire with expected options and resolves to isConfirmed", async () => {
    mockFire.mockResolvedValueOnce({ isConfirmed: true });

    const result = await showConfirmationAlert("Are you sure?");

    expect(mockFire).toHaveBeenCalledWith({
      title: "Are you sure?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Aceptar",
      cancelButtonText: "Cancelar",
      buttonsStyling: false,
    });
    expect(result).toBe(true);
  });

  test("showConfirmationAlert resolves to false when not confirmed", async () => {
    mockFire.mockResolvedValueOnce({ isConfirmed: false });

    const result = await showConfirmationAlert("Are you sure?");

    expect(result).toBe(false);
  });
});
