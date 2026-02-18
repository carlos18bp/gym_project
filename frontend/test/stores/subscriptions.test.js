import { setActivePinia, createPinia } from "pinia";
import AxiosMockAdapter from "axios-mock-adapter";
import axios from "axios";

import { useSubscriptionStore } from "@/stores/subscriptions";

const mock = new AxiosMockAdapter(axios);

describe("Subscription Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mock.reset();
    jest.clearAllMocks();
  });

  const collectLoadingResets = async (store, actions) => {
    const results = [];
    for (const action of actions) {
      let failed = false;
      try {
        await action();
      } catch {
        failed = true;
      }
      results.push({ failed, isLoading: store.isLoading });
    }
    return results;
  };

  test("initializes with empty state", () => {
    const store = useSubscriptionStore();

    expect(store.currentSubscription).toBe(null);
    expect(store.subscriptionHistory).toEqual([]);
    expect(store.isLoading).toBe(false);
    expect(store.wompiPublicKey).toBe(null);
  });

  test("getters: hasActiveSubscription, isFreePlan, isPaidPlan, nextBillingDate", () => {
    const store = useSubscriptionStore();

    store.currentSubscription = {
      status: "active",
      plan_type: "basico",
      next_billing_date: "2026-01-01",
    };

    expect(store.hasActiveSubscription).toBe(true);
    expect(store.isFreePlan).toBe(true);
    expect(store.isPaidPlan).toBe(false);
    expect(store.nextBillingDate).toBe("2026-01-01");

    store.currentSubscription.plan_type = "cliente";
    expect(store.isFreePlan).toBe(false);
    expect(store.isPaidPlan).toBe(true);

    store.currentSubscription.status = "cancelled";
    expect(store.hasActiveSubscription).toBe(false);
  });

  test("fetchCurrentSubscription sets currentSubscription", async () => {
    const store = useSubscriptionStore();

    mock.onGet("/api/subscriptions/current/").reply(200, { status: "active" });

    const result = await store.fetchCurrentSubscription();

    expect(result).toEqual({ status: "active" });
    expect(store.currentSubscription).toEqual({ status: "active" });
    expect(store.isLoading).toBe(false);
  });

  test("fetchCurrentSubscription sets currentSubscription=null on 404 without throwing", async () => {
    const store = useSubscriptionStore();
    store.currentSubscription = { status: "active" };

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/subscriptions/current/").reply(404, { detail: "not found" });

    const result = await store.fetchCurrentSubscription();

    expect(result).toBeUndefined();
    expect(store.currentSubscription).toBe(null);
    expect(store.isLoading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("fetchCurrentSubscription throws on non-404 errors", async () => {
    const store = useSubscriptionStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/subscriptions/current/").reply(500, { detail: "err" });

    await expect(store.fetchCurrentSubscription()).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("fetchSubscriptionHistory sets subscriptionHistory", async () => {
    const store = useSubscriptionStore();

    mock.onGet("/api/subscriptions/history/").reply(200, [{ id: 1 }]);

    const result = await store.fetchSubscriptionHistory();

    expect(result).toEqual([{ id: 1 }]);
    expect(store.subscriptionHistory).toEqual([{ id: 1 }]);
    expect(store.isLoading).toBe(false);
  });

  test("fetchSubscriptionHistory throws on error", async () => {
    const store = useSubscriptionStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/subscriptions/history/").reply(500, { detail: "err" });

    await expect(store.fetchSubscriptionHistory()).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("generateWompiSignature returns signature", async () => {
    const store = useSubscriptionStore();

    mock.onPost("/api/subscriptions/generate-signature/").reply(200, { signature: "sig" });

    const result = await store.generateWompiSignature({ amount_in_cents: 1000, currency: "COP", reference: "x" });

    expect(result).toBe("sig");
  });

  test("generateWompiSignature throws on error", async () => {
    const store = useSubscriptionStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/subscriptions/generate-signature/").reply(500, { detail: "err" });

    await expect(store.generateWompiSignature({ amount_in_cents: 1000, currency: "COP", reference: "x" })).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("fetchWompiPublicKey sets wompiPublicKey", async () => {
    const store = useSubscriptionStore();

    mock.onGet("/api/subscriptions/wompi-config/").reply(200, { public_key: "pk" });

    const result = await store.fetchWompiPublicKey();

    expect(result).toBe("pk");
    expect(store.wompiPublicKey).toBe("pk");
  });

  test("fetchWompiPublicKey throws on error", async () => {
    const store = useSubscriptionStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/subscriptions/wompi-config/").reply(500, { detail: "err" });

    await expect(store.fetchWompiPublicKey()).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("createSubscription sets currentSubscription", async () => {
    const store = useSubscriptionStore();

    mock.onPost("/api/subscriptions/create/").reply(201, { id: 1, status: "active" });

    const result = await store.createSubscription({ plan_type: "cliente", payment_source_id: "ps" });

    expect(result).toEqual({ id: 1, status: "active" });
    expect(store.currentSubscription).toEqual({ id: 1, status: "active" });
    expect(store.isLoading).toBe(false);
  });

  test("createSubscription throws on error", async () => {
    const store = useSubscriptionStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPost("/api/subscriptions/create/").reply(500, { detail: "err" });

    await expect(store.createSubscription({ plan_type: "cliente", payment_source_id: "ps" })).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("cancelSubscription updates currentSubscription", async () => {
    const store = useSubscriptionStore();

    mock.onPatch("/api/subscriptions/cancel/").reply(200, { id: 1, status: "cancelled" });

    const result = await store.cancelSubscription();

    expect(result.status).toBe("cancelled");
    expect(store.currentSubscription.status).toBe("cancelled");
    expect(store.isLoading).toBe(false);
  });

  test("cancelSubscription throws on error", async () => {
    const store = useSubscriptionStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPatch("/api/subscriptions/cancel/").reply(500, { detail: "err" });

    await expect(store.cancelSubscription()).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("reactivateSubscription updates currentSubscription", async () => {
    const store = useSubscriptionStore();

    mock.onPatch("/api/subscriptions/reactivate/").reply(200, { id: 1, status: "active" });

    const result = await store.reactivateSubscription();

    expect(result.status).toBe("active");
    expect(store.currentSubscription.status).toBe("active");
    expect(store.isLoading).toBe(false);
  });

  test("reactivateSubscription throws on error", async () => {
    const store = useSubscriptionStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPatch("/api/subscriptions/reactivate/").reply(500, { detail: "err" });

    await expect(store.reactivateSubscription()).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("updatePaymentMethod patches payment_source_id and updates currentSubscription", async () => {
    const store = useSubscriptionStore();

    mock.onPatch("/api/subscriptions/update-payment-method/").reply(200, { id: 1, payment_source_id: "new" });

    const result = await store.updatePaymentMethod("new");

    expect(result.payment_source_id).toBe("new");
    expect(store.currentSubscription.payment_source_id).toBe("new");

    expect(mock.history.patch).toHaveLength(1);
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ payment_source_id: "new" });
  });

  test("updatePaymentMethod throws on error", async () => {
    const store = useSubscriptionStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onPatch("/api/subscriptions/update-payment-method/").reply(500, { detail: "err" });

    await expect(store.updatePaymentMethod("new")).rejects.toBeTruthy();
    expect(store.isLoading).toBe(false);

    consoleSpy.mockRestore();
  });

  test("resets isLoading on subscription action network errors", async () => {
    const store = useSubscriptionStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/subscriptions/history/").networkError();
    mock.onPost("/api/subscriptions/create/").networkError();
    mock.onPatch("/api/subscriptions/cancel/").networkError();
    mock.onPatch("/api/subscriptions/reactivate/").networkError();
    mock.onPatch("/api/subscriptions/update-payment-method/").networkError();

    const results = await collectLoadingResets(store, [
      () => store.fetchSubscriptionHistory(),
      () => store.createSubscription({ plan_type: "cliente", payment_source_id: "ps" }),
      () => store.cancelSubscription(),
      () => store.reactivateSubscription(),
      () => store.updatePaymentMethod("new"),
    ]);

    expect(results).toEqual([
      { failed: true, isLoading: false },
      { failed: true, isLoading: false },
      { failed: true, isLoading: false },
      { failed: true, isLoading: false },
      { failed: true, isLoading: false },
    ]);

    consoleSpy.mockRestore();
  });

  test("fetchPaymentHistory returns data", async () => {
    const store = useSubscriptionStore();

    mock.onGet("/api/subscriptions/payments/").reply(200, [{ id: 1 }]);

    const result = await store.fetchPaymentHistory();

    expect(result).toEqual([{ id: 1 }]);
  });

  test("fetchPaymentHistory throws on error", async () => {
    const store = useSubscriptionStore();

    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    mock.onGet("/api/subscriptions/payments/").reply(500, { detail: "err" });

    await expect(store.fetchPaymentHistory()).rejects.toBeTruthy();

    consoleSpy.mockRestore();
  });

  test("resetState resets store fields", () => {
    const store = useSubscriptionStore();

    store.$patch({
      currentSubscription: { id: 1 },
      subscriptionHistory: [{ id: 2 }],
      isLoading: true,
      wompiPublicKey: "pk",
    });

    store.resetState();

    expect(store.currentSubscription).toBe(null);
    expect(store.subscriptionHistory).toEqual([]);
    expect(store.isLoading).toBe(false);
    expect(store.wompiPublicKey).toBe(null);
  });
});
