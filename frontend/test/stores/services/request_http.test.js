const mockAxiosGet = jest.fn();
const mockAxiosPost = jest.fn();
const mockAxiosPut = jest.fn();
const mockAxiosPatch = jest.fn();
const mockAxiosDelete = jest.fn();

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: (...args) => mockAxiosGet(...args),
    post: (...args) => mockAxiosPost(...args),
    put: (...args) => mockAxiosPut(...args),
    patch: (...args) => mockAxiosPatch(...args),
    delete: (...args) => mockAxiosDelete(...args),
  },
}));

import {
  get_request,
  __makeRequest,
  create_request,
  update_request,
  patch_request,
  delete_request,
  upload_file_request,
} from "@/stores/services/request_http";

describe("request_http", () => {
  const setCookieValue = (value) => {
    let cookieValue = value;
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => cookieValue,
      set: (nextValue) => {
        cookieValue = nextValue;
      },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    setCookieValue("csrftoken=abc");
  });

  const runUploadRequest = async () => {
    localStorage.setItem("token", "tkn");

    const formData = new FormData();
    formData.append("file", new File(["x"], "x.txt"));

    mockAxiosPost.mockResolvedValueOnce({ status: 200, data: { ok: true } });

    const res = await upload_file_request("uploads/", formData);

    const [url, body, config] = mockAxiosPost.mock.calls[0];

    return { res, url, body, config, formData };
  };

  test("get_request calls axios.get with /api prefix, csrf header, bearer token, and responseType", async () => {
    localStorage.setItem("token", "tkn");

    mockAxiosGet.mockResolvedValueOnce({ status: 200, data: { ok: true } });

    const res = await get_request("some/endpoint/", "blob");

    expect(res.status).toBe(200);

    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    expect(mockAxiosGet).toHaveBeenCalledWith(
      "/api/some/endpoint/",
      expect.objectContaining({
        responseType: "blob",
        headers: {
          "X-CSRFToken": "abc",
          Authorization: "Bearer tkn",
        },
      })
    );
  });

  test("get_request omits Authorization header when token is missing", async () => {
    mockAxiosGet.mockResolvedValueOnce({ status: 200, data: { ok: true } });

    await get_request("no/token/");

    expect(mockAxiosGet).toHaveBeenCalledWith(
      "/api/no/token/",
      expect.objectContaining({
        headers: {
          "X-CSRFToken": "abc",
        },
      })
    );

    expect(mockAxiosGet.mock.calls[0][1].headers).not.toHaveProperty("Authorization");
  });

  test("get_request parses csrftoken when cookie is not first entry", async () => {
    setCookieValue("foo=bar; csrftoken=xyz");

    mockAxiosGet.mockResolvedValueOnce({ status: 200, data: { ok: true } });

    await get_request("other/endpoint/");

    expect(mockAxiosGet).toHaveBeenCalledWith(
      "/api/other/endpoint/",
      expect.objectContaining({
        headers: {
          "X-CSRFToken": "xyz",
        },
      })
    );
  });

  test("get_request parses csrftoken using cookie getter", async () => {
    setCookieValue("alpha=1; csrftoken=via-getter; beta=2");

    mockAxiosGet.mockResolvedValueOnce({ status: 200, data: { ok: true } });

    await get_request("getter/endpoint/");

    expect(mockAxiosGet).toHaveBeenCalledWith(
      "/api/getter/endpoint/",
      expect.objectContaining({
        headers: {
          "X-CSRFToken": "via-getter",
        },
      })
    );
  });

  test("get_request sets X-CSRFToken null when cookie is empty", async () => {
    setCookieValue("");

    mockAxiosGet.mockResolvedValueOnce({ status: 200, data: { ok: true } });

    await get_request("empty/cookie/");

    expect(mockAxiosGet).toHaveBeenCalledWith(
      "/api/empty/cookie/",
      expect.objectContaining({
        headers: {
          "X-CSRFToken": null,
        },
      })
    );
  });

  test("get_request sets X-CSRFToken null when csrftoken is missing", async () => {
    setCookieValue("foo=bar");

    mockAxiosGet.mockResolvedValueOnce({ status: 200, data: { ok: true } });

    await get_request("missing/csrf/");

    expect(mockAxiosGet).toHaveBeenCalledWith(
      "/api/missing/csrf/",
      expect.objectContaining({
        headers: {
          "X-CSRFToken": null,
        },
      })
    );
  });

  test("__makeRequest throws for unsupported HTTP methods", async () => {
    localStorage.setItem("token", "tkn");

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(__makeRequest("INVALID", "some/endpoint/")).rejects.toThrow(
      "Unsupported method: INVALID"
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      "Error during request:",
      expect.any(Error)
    );
    expect(consoleSpy).toHaveBeenCalledWith("Request failed without response.");

    consoleSpy.mockRestore();
  });

  test("create_request omits Authorization header when token is missing", async () => {
    mockAxiosPost.mockResolvedValueOnce({ status: 201, data: { ok: true } });

    const res = await create_request("some/endpoint/", { a: 1 });

    expect(res.status).toBe(201);

    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
    const [url, body, config] = mockAxiosPost.mock.calls[0];
    expect(url).toBe("/api/some/endpoint/");
    expect(body).toEqual({ a: 1 });
    expect(config.headers).toEqual({ "X-CSRFToken": "abc" });
    expect(config.headers).not.toHaveProperty("Authorization");
  });

  test("create_request includes Authorization header when token is present", async () => {
    localStorage.setItem("token", "tkn");

    mockAxiosPost.mockResolvedValueOnce({ status: 201, data: { ok: true } });

    await create_request("some/endpoint/", { a: 1 });

    const config = mockAxiosPost.mock.calls[0][2];
    expect(config.headers).toEqual({
      "X-CSRFToken": "abc",
      Authorization: "Bearer tkn",
    });
  });

  test("update_request, patch_request, and delete_request use correct axios methods", async () => {
    localStorage.setItem("token", "tkn");

    mockAxiosPut.mockResolvedValueOnce({ status: 200, data: { ok: true } });
    mockAxiosPatch.mockResolvedValueOnce({ status: 200, data: { ok: true } });
    mockAxiosDelete.mockResolvedValueOnce({ status: 204, data: {} });

    await update_request("endpoint/1/", { x: 1 });
    await patch_request("endpoint/1/", { y: 2 });
    await delete_request("endpoint/1/");

    expect(mockAxiosPut).toHaveBeenCalledWith(
      "/api/endpoint/1/",
      { x: 1 },
      expect.objectContaining({
        headers: {
          "X-CSRFToken": "abc",
          Authorization: "Bearer tkn",
        },
      })
    );

    expect(mockAxiosPatch).toHaveBeenCalledWith(
      "/api/endpoint/1/",
      { y: 2 },
      expect.objectContaining({
        headers: {
          "X-CSRFToken": "abc",
          Authorization: "Bearer tkn",
        },
      })
    );

    expect(mockAxiosDelete).toHaveBeenCalledWith(
      "/api/endpoint/1/",
      expect.objectContaining({
        headers: {
          "X-CSRFToken": "abc",
          Authorization: "Bearer tkn",
        },
      })
    );
  });

  test("__makeRequest supports PATCH requests", async () => {
    mockAxiosPatch.mockResolvedValueOnce({ status: 200, data: { ok: true } });

    await __makeRequest("PATCH", "endpoint/patch/", { x: 1 });

    expect(mockAxiosPatch).toHaveBeenCalledWith(
      "/api/endpoint/patch/",
      { x: 1 },
      expect.objectContaining({
        headers: {
          "X-CSRFToken": "abc",
        },
      })
    );
  });

  test("get_request logs error details for non-silent 404 and rethrows", async () => {
    const err = {
      response: {
        status: 404,
        data: { detail: "not found" },
      },
    };

    mockAxiosGet.mockRejectedValueOnce(err);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(get_request("some/not-silent/")).rejects.toBe(err);

    expect(consoleSpy).toHaveBeenCalledWith("Error during request:", err);
    expect(consoleSpy).toHaveBeenCalledWith("Response data:", { detail: "not found" });
    expect(consoleSpy).toHaveBeenCalledWith("Status code:", 404);

    consoleSpy.mockRestore();
  });

  test("get_request logs error details for non-404 response errors and rethrows", async () => {
    const err = {
      response: {
        status: 500,
        data: { detail: "boom" },
      },
    };

    mockAxiosGet.mockRejectedValueOnce(err);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(get_request("some/endpoint/")).rejects.toBe(err);

    expect(consoleSpy).toHaveBeenCalledWith("Error during request:", err);
    expect(consoleSpy).toHaveBeenCalledWith("Response data:", { detail: "boom" });
    expect(consoleSpy).toHaveBeenCalledWith("Status code:", 500);

    consoleSpy.mockRestore();
  });

  test("get_request silences expected 404s for configured endpoints and rethrows", async () => {
    const err = {
      response: {
        status: 404,
        data: { detail: "not found" },
      },
    };

    mockAxiosGet.mockRejectedValueOnce(err);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(get_request("user/signature/")).rejects.toBe(err);

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("get_request silences 404s for letterhead endpoints", async () => {
    const err = {
      response: {
        status: 404,
        data: { detail: "not found" },
      },
    };

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mockAxiosGet.mockRejectedValueOnce(err);
    await expect(get_request("user/letterhead/")).rejects.toBe(err);
    expect(consoleSpy).not.toHaveBeenCalled();

    mockAxiosGet.mockRejectedValueOnce(err);
    await expect(get_request("user/letterhead/word-template/")).rejects.toBe(err);
    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  test("get_request logs generic message when request fails without response and rethrows", async () => {
    const err = new Error("fail");

    mockAxiosGet.mockRejectedValueOnce(err);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(get_request("some/endpoint/")).rejects.toBe(err);

    expect(consoleSpy).toHaveBeenCalledWith("Error during request:", err);
    expect(consoleSpy).toHaveBeenCalledWith("Request failed without response.");

    consoleSpy.mockRestore();
  });

  test("upload_file_request posts FormData and returns response", async () => {
    const { res, url, body, formData } = await runUploadRequest();

    expect([res.status, url, body]).toEqual([200, "/api/uploads/", formData]);
  });

  test("upload_file_request sets headers and transformRequest", async () => {
    const { config, formData } = await runUploadRequest();

    expect([
      config.headers["X-CSRFToken"],
      config.headers.Authorization,
      config.headers["Content-Type"],
    ]).toEqual(["abc", "Bearer tkn", undefined]);
    expect(Array.isArray(config.transformRequest)).toBe(true);
    expect([config.transformRequest.length, config.transformRequest[0](formData)]).toEqual([
      1,
      formData,
    ]);
  });

  test("create_request logs error details for non-silent 404 and rethrows", async () => {
    const err = {
      response: {
        status: 404,
        data: { detail: "not found" },
      },
    };

    mockAxiosPost.mockRejectedValueOnce(err);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(create_request("some/endpoint/", { a: 1 })).rejects.toBe(err);

    expect(consoleSpy).toHaveBeenCalledWith("Error during request:", err);
    expect(consoleSpy).toHaveBeenCalledWith("Response data:", { detail: "not found" });
    expect(consoleSpy).toHaveBeenCalledWith("Status code:", 404);

    consoleSpy.mockRestore();
  });

  test("upload_file_request sets empty Authorization when token is missing", async () => {
    const formData = new FormData();

    mockAxiosPost.mockResolvedValueOnce({ status: 200, data: { ok: true } });

    await upload_file_request("uploads/", formData);

    const config = mockAxiosPost.mock.calls[0][2];
    expect(config.headers.Authorization).toBe("");
  });

  test("upload_file_request logs error details and rethrows", async () => {
    const err = {
      response: {
        status: 500,
        data: { detail: "fail" },
      },
    };

    mockAxiosPost.mockRejectedValueOnce(err);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(upload_file_request("uploads/", new FormData())).rejects.toBe(err);

    expect(consoleSpy).toHaveBeenCalledWith("Error during file upload:", err);
    expect(consoleSpy).toHaveBeenCalledWith("Response data:", { detail: "fail" });
    expect(consoleSpy).toHaveBeenCalledWith("Status code:", 500);

    consoleSpy.mockRestore();
  });

  test("upload_file_request logs generic message when upload fails without response and rethrows", async () => {
    const err = new Error("fail");

    mockAxiosPost.mockRejectedValueOnce(err);

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(upload_file_request("uploads/", new FormData())).rejects.toBe(err);

    expect(consoleSpy).toHaveBeenCalledWith("Error during file upload:", err);
    expect(consoleSpy).toHaveBeenCalledWith("Upload request failed without response.");

    consoleSpy.mockRestore();
  });

  test("upload_file_request logs generic message when axios throws synchronously", async () => {
    const err = new Error("sync fail");

    mockAxiosPost.mockImplementationOnce(() => {
      throw err;
    });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(upload_file_request("uploads/", new FormData())).rejects.toBe(err);

    expect(consoleSpy).toHaveBeenCalledWith("Error during file upload:", err);
    expect(consoleSpy).toHaveBeenCalledWith("Upload request failed without response.");

    consoleSpy.mockRestore();
  });
});
