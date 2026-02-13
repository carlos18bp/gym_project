export function getApiPath(requestUrl) {
  const url = new URL(requestUrl);
  return url.pathname.replace(/^\/api\//, "");
}

export async function mockApi(page, handler) {
  await page.route("**/api/**", async (route) => {
    const apiPath = getApiPath(route.request().url());
    const result = await handler({ route, apiPath });

    if (result) {
      return route.fulfill(result);
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
}
