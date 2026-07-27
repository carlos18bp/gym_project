import { test, expect } from "@playwright/test";

/**
 * Regression guard for the global app zoom (src/style.css).
 *
 * CSS `zoom` scales the used value of lengths, but viewport units resolve
 * against the UNZOOMED viewport — so a bare `100vh` paints at only 80% of the
 * screen and leaves a white band under the split-screen illustration. The
 * `*-screen` utilities compensate for this in tailwind.config.js.
 *
 * Pixel assertions are normally discouraged here (see lessons-learned.md), but
 * the geometry IS the behaviour under test, and it is asserted against the
 * viewport rather than a magic number.
 */

const VIEWPORT = { width: 1440, height: 900 };

const SPLIT_SCREEN_PAGES = [
  { name: "sign_in", path: "/sign_in" },
  { name: "sign_on", path: "/sign_on" },
  { name: "forget_password", path: "/forget_password" },
];

for (const authPage of SPLIT_SCREEN_PAGES) {
  test(`${authPage.name} illustration spans the full viewport height`, async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT);

    await page.goto(authPage.path);
    const box = await page.getByTestId("auth-illustration").boundingBox();

    expect(Math.abs(box.height - VIEWPORT.height)).toBeLessThanOrEqual(2);
  });

  test(`${authPage.name} illustration reaches the bottom of the viewport`, async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT);

    await page.goto(authPage.path);
    const box = await page.getByTestId("auth-illustration").boundingBox();

    expect(Math.abs(box.y + box.height - VIEWPORT.height)).toBeLessThanOrEqual(2);
  });
}
