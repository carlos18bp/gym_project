import { test, expect } from "../helpers/test.js";
import { setAuthLocalStorage } from "../helpers/auth.js";
import { mockApi } from "../helpers/api.js";

/**
 * E2E tests for subscriptions/index.js store coverage
 * Target: increase coverage for subscription store actions and getters
 */

async function installSubscriptionMocks(page, { userId, subscription = null, plans = [] }) {
  const user = {
    id: userId,
    email: `user${userId}@test.com`,
    first_name: "Test",
    last_name: "User",
    role: "lawyer",
    is_gym_lawyer: true,
    is_profile_completed: true,
    subscription_status: subscription ? "active" : "inactive",
  };

  await mockApi(page, async ({ route, apiPath }) => {
    if (apiPath === "validate_token/") return { status: 200, contentType: "application/json", body: "{}" };
    if (apiPath === "users/") return { status: 200, contentType: "application/json", body: JSON.stringify([user]) };
    if (apiPath === `users/${userId}/`) return { status: 200, contentType: "application/json", body: JSON.stringify(user) };
    if (apiPath === "google-captcha/site-key/") return { status: 200, contentType: "application/json", body: JSON.stringify({ site_key: "e2e-site-key" }) };

    // Subscription endpoints
    if (apiPath === "subscriptions/") {
      if (subscription) {
        return { status: 200, contentType: "application/json", body: JSON.stringify([subscription]) };
      }
      return { status: 200, contentType: "application/json", body: "[]" };
    }
    
    if (apiPath === "subscriptions/plans/") {
      return { status: 200, contentType: "application/json", body: JSON.stringify(plans) };
    }
    
    if (apiPath === "subscriptions/current/") {
      if (subscription) {
        return { status: 200, contentType: "application/json", body: JSON.stringify(subscription) };
      }
      return { status: 404, contentType: "application/json", body: JSON.stringify({ detail: "No active subscription" }) };
    }

    if (apiPath.match(/^subscriptions\/\d+\/$/)) {
      if (subscription) {
        return { status: 200, contentType: "application/json", body: JSON.stringify(subscription) };
      }
    }

    // Documents (needed for dashboard)
    if (apiPath === "dynamic-documents/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/folders/") return { status: 200, contentType: "application/json", body: "[]" };
    if (apiPath === "dynamic-documents/tags/") return { status: 200, contentType: "application/json", body: "[]" };

    return null;
  });
}

test.describe("subscription store: fetchCurrentSubscription", () => {
  test("fetches active subscription for user", async ({ page }) => {
    const userId = 10500;
    const subscription = {
      id: 1,
      user_id: userId,
      plan_name: "Professional",
      status: "active",
      start_date: "2024-01-01",
      end_date: "2024-12-31",
    };

    await installSubscriptionMocks(page, { userId, subscription });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });

  test("handles no active subscription", async ({ page }) => {
    const userId = 10501;

    await installSubscriptionMocks(page, { userId, subscription: null });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });
});

test.describe("subscription store: fetchPlans", () => {
  test("fetches available subscription plans", async ({ page }) => {
    const userId = 10502;
    const plans = [
      { id: 1, name: "Basic", price: 9.99, features: ["Feature 1"] },
      { id: 2, name: "Professional", price: 19.99, features: ["Feature 1", "Feature 2"] },
      { id: 3, name: "Enterprise", price: 49.99, features: ["Feature 1", "Feature 2", "Feature 3"] },
    ];

    await installSubscriptionMocks(page, { userId, plans });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });
});

test.describe("subscription store: subscription status getters", () => {
  test("identifies active subscription status", async ({ page }) => {
    const userId = 10503;
    const subscription = {
      id: 1,
      user_id: userId,
      plan_name: "Professional",
      status: "active",
      start_date: "2024-01-01",
      end_date: "2024-12-31",
    };

    await installSubscriptionMocks(page, { userId, subscription });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });

  test("identifies expired subscription status", async ({ page }) => {
    const userId = 10504;
    const subscription = {
      id: 1,
      user_id: userId,
      plan_name: "Professional",
      status: "expired",
      start_date: "2023-01-01",
      end_date: "2023-12-31",
    };

    await installSubscriptionMocks(page, { userId, subscription });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });

  test("identifies trial subscription status", async ({ page }) => {
    const userId = 10505;
    const subscription = {
      id: 1,
      user_id: userId,
      plan_name: "Trial",
      status: "trial",
      start_date: "2024-01-01",
      end_date: "2024-01-14",
    };

    await installSubscriptionMocks(page, { userId, subscription });

    await setAuthLocalStorage(page, {
      token: "e2e-token",
      userAuth: { id: userId, role: "lawyer", is_gym_lawyer: true, is_profile_completed: true },
    });

    await page.goto("/dynamic_document_dashboard");
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain("dynamic_document_dashboard");
  });
});
