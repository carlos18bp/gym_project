import { useCorporateRequestsStore } from "@/stores/organizations/corporate_requests";
import { useCorporateRequestsStore as canonicalStore } from "@/stores/corporate_requests/index.js";

describe("stores/organizations/corporate_requests re-export", () => {
  test("re-exports the canonical corporate requests store", () => {
    expect(useCorporateRequestsStore).toBe(canonicalStore);
  });

  test("exposes a callable store definition", () => {
    expect(typeof useCorporateRequestsStore).toBe("function");
  });
});
