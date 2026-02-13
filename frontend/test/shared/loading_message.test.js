const mockFire = jest.fn();
const mockClose = jest.fn();
const mockShowLoading = jest.fn();

jest.mock("sweetalert2", () => ({
  __esModule: true,
  default: {
    fire: (...args) => mockFire(...args),
    close: (...args) => mockClose(...args),
    showLoading: (...args) => mockShowLoading(...args),
  },
}));

import { showLoading, hideLoading } from "@/shared/loading_message";

describe("loading_message.js", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("showLoading calls Swal.fire with defaults and triggers Swal.showLoading in didOpen", () => {
    showLoading();

    expect(mockFire).toHaveBeenCalledTimes(1);

    const options = mockFire.mock.calls[0][0];
    expect(options).toMatchObject({
      title: "Procesando...",
      text: "Por favor espere, estamos procesando la solicitud.",
      iconColor: "#FFF",
      allowOutsideClick: false,
      showConfirmButton: false,
    });

    expect(typeof options.didOpen).toBe("function");
    options.didOpen();
    expect(mockShowLoading).toHaveBeenCalledTimes(1);
  });

  test("showLoading uses provided title and text", () => {
    showLoading("T", "X");

    const options = mockFire.mock.calls[0][0];
    expect(options.title).toBe("T");
    expect(options.text).toBe("X");
  });

  test("hideLoading closes Swal", () => {
    hideLoading();
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
