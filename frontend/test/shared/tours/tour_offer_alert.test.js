import { showTourOfferAlert } from "@/shared/tours/tour_offer_alert";
import Swal from "sweetalert2";

jest.mock("sweetalert2", () => ({
  __esModule: true,
  default: { fire: jest.fn() },
}));

describe("showTourOfferAlert", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("opens a branded, Tailwind-styled confirmation modal", async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: true });

    await showTourOfferAlert("¿Quieres ver la guía?");

    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "¿Quieres ver la guía?",
        confirmButtonText: "Ver la guía",
        cancelButtonText: "Ahora no",
        buttonsStyling: false,
        customClass: expect.objectContaining({ popup: "gyj-tour-offer" }),
      }),
    );
  });

  test("resolves true when the user accepts", async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: true });

    await expect(showTourOfferAlert("mensaje")).resolves.toBe(true);
  });

  test("resolves false when the user declines", async () => {
    Swal.fire.mockResolvedValue({ isConfirmed: false });

    await expect(showTourOfferAlert("mensaje")).resolves.toBe(false);
  });
});
