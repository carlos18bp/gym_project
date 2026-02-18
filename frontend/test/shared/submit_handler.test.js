const mockCreateProcess = jest.fn();
const mockUpdateProcess = jest.fn();

jest.mock("@/stores/process", () => ({
  __esModule: true,
  useProcessStore: () => ({
    createProcess: (...args) => mockCreateProcess(...args),
    updateProcess: (...args) => mockUpdateProcess(...args),
  }),
}));

jest.mock("sweetalert2", () => ({
  __esModule: true,
  default: {
    fire: jest.fn(),
    close: jest.fn(),
    showLoading: jest.fn(),
  },
}));

import Swal from "sweetalert2";
import { submitHandler } from "@/shared/submit_handler";

describe("submitHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Swal.fire.mockResolvedValue({ isConfirmed: true });
  });

  const runCreateSuccess = async () => {
    mockCreateProcess.mockResolvedValue(201);

    const formData = { plaintiff: "Ana" };
    const result = await submitHandler(formData, "Proceso creado", false);

    return {
      formData,
      result,
      loadingConfig: Swal.fire.mock.calls[0][0],
      successConfig: Swal.fire.mock.calls[1][0],
    };
  };

  test("creates process and shows loading alert", async () => {
    const { formData, loadingConfig } = await runCreateSuccess();

    expect(mockCreateProcess).toHaveBeenCalledWith(formData);
    expect(mockUpdateProcess).not.toHaveBeenCalled();
    expect(loadingConfig).toEqual(
      expect.objectContaining({
        title: "Procesando...",
        showConfirmButton: false,
        allowOutsideClick: false,
      })
    );

    loadingConfig.didOpen();
    expect(Swal.showLoading).toHaveBeenCalled();
  });

  test("shows success alert after creating process", async () => {
    const { result, successConfig } = await runCreateSuccess();

    expect(Swal.close).toHaveBeenCalled();
    expect(successConfig).toEqual(
      expect.objectContaining({
        icon: "success",
        text: "Proceso creado",
      })
    );
    expect(result).toBeUndefined();
  });

  test("success alert handles unconfirmed result", async () => {
    mockCreateProcess.mockResolvedValue(201);

    Swal.fire
      .mockResolvedValueOnce({ isConfirmed: true })
      .mockResolvedValueOnce({ isConfirmed: false });

    await submitHandler({ plaintiff: "Ana" }, "Proceso creado", false);
    await Promise.resolve();

    expect(Swal.fire).toHaveBeenCalledTimes(2);
    expect(Swal.fire.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        icon: "success",
        text: "Proceso creado",
      })
    );
  });

  test("updates process when editing and treats 200 as success", async () => {
    mockUpdateProcess.mockResolvedValue(200);

    const formData = { processIdParam: 10, plaintiff: "Luis" };

    const result = await submitHandler(formData, "Proceso actualizado", true);

    expect(mockUpdateProcess).toHaveBeenCalledWith(formData);
    expect(mockCreateProcess).not.toHaveBeenCalled();
    expect(Swal.close).toHaveBeenCalled();
    expect(Swal.fire.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        icon: "success",
        text: "Proceso actualizado",
      })
    );
    expect(result).toBeUndefined();
  });

  test("shows error alert and returns false on non-success status", async () => {
    mockCreateProcess.mockResolvedValue(400);

    const result = await submitHandler({ plaintiff: "Ana" }, "", false);

    expect(Swal.close).toHaveBeenCalled();
    expect(Swal.fire.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        icon: "error",
        title: "Oops...",
      })
    );
    expect(result).toBe(false);
  });
});
