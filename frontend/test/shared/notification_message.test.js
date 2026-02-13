const mockFire = jest.fn();

jest.mock("sweetalert2", () => ({
  __esModule: true,
  default: {
    fire: (...args) => mockFire(...args),
  },
}));

import { showNotification } from "@/shared/notification_message";

describe("notification_message.js", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("showNotification calls Swal.fire with message and icon", async () => {
    mockFire.mockResolvedValueOnce();

    await showNotification("Ok", "success");

    expect(mockFire).toHaveBeenCalledWith({
      title: "Ok",
      icon: "success",
      buttonsStyling: false,
    });
  });
});
