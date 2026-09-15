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
 * viewport rather than a magic number. This is a pure layout/geometry guard,
 * not a user flow: every test below carries `allow-no-interaction` (no
 * click/fill applies to a CSS regression check) and `allow-render-only` (the
 * assertion pins computed pixel geometry against the viewport, which is the
 * real check here, not a text/count matcher).
 *
 * Unrolled from a `for` loop over an array (previously produced template-
 * literal test names Playwright cannot resolve statically, and carried no
 * `tag` option at all) into static test() calls with literal names and
 * @flow/@outcome tags, so the flow-coverage audit can attribute these
 * geometry checks to their auth flows instead of treating them as invisible.
 */

const VIEWPORT = { width: 1440, height: 900 };

test("sign_in illustration spans the full viewport height", {
  tag: ["@flow:auth-login-email", "@module:auth", "@priority:P1", "@outcome:display"],
}, async ({ page }) => {
  // quality: allow-no-interaction (CSS-zoom/viewport regression guard — geometry is the behavior under test, not a click/fill)
  // quality: allow-render-only (asserts computed pixel geometry against the viewport, not a text/count matcher — see file header)
  await page.setViewportSize(VIEWPORT);

  await page.goto("/sign_in");
  const box = await page.getByTestId("auth-illustration").boundingBox();

  expect(Math.abs(box.height - VIEWPORT.height)).toBeLessThanOrEqual(2);
});

test("sign_in illustration reaches the bottom of the viewport", {
  tag: ["@flow:auth-login-email", "@module:auth", "@priority:P1", "@outcome:display"],
}, async ({ page }) => {
  // quality: allow-no-interaction (CSS-zoom/viewport regression guard — geometry is the behavior under test, not a click/fill)
  // quality: allow-render-only (asserts computed pixel geometry against the viewport, not a text/count matcher — see file header)
  await page.setViewportSize(VIEWPORT);

  await page.goto("/sign_in");
  const box = await page.getByTestId("auth-illustration").boundingBox();

  expect(Math.abs(box.y + box.height - VIEWPORT.height)).toBeLessThanOrEqual(2);
});

test("sign_on illustration spans the full viewport height", {
  tag: ["@flow:auth-register", "@module:auth", "@priority:P1", "@outcome:display"],
}, async ({ page }) => {
  // quality: allow-no-interaction (CSS-zoom/viewport regression guard — geometry is the behavior under test, not a click/fill)
  // quality: allow-render-only (asserts computed pixel geometry against the viewport, not a text/count matcher — see file header)
  await page.setViewportSize(VIEWPORT);

  await page.goto("/sign_on");
  const box = await page.getByTestId("auth-illustration").boundingBox();

  expect(Math.abs(box.height - VIEWPORT.height)).toBeLessThanOrEqual(2);
});

test("sign_on illustration reaches the bottom of the viewport", {
  tag: ["@flow:auth-register", "@module:auth", "@priority:P1", "@outcome:display"],
}, async ({ page }) => {
  // quality: allow-no-interaction (CSS-zoom/viewport regression guard — geometry is the behavior under test, not a click/fill)
  // quality: allow-render-only (asserts computed pixel geometry against the viewport, not a text/count matcher — see file header)
  await page.setViewportSize(VIEWPORT);

  await page.goto("/sign_on");
  const box = await page.getByTestId("auth-illustration").boundingBox();

  expect(Math.abs(box.y + box.height - VIEWPORT.height)).toBeLessThanOrEqual(2);
});

test("forget_password illustration spans the full viewport height", {
  tag: ["@flow:auth-forgot-password", "@module:auth", "@priority:P2", "@outcome:display"],
}, async ({ page }) => {
  // quality: allow-no-interaction (CSS-zoom/viewport regression guard — geometry is the behavior under test, not a click/fill)
  // quality: allow-render-only (asserts computed pixel geometry against the viewport, not a text/count matcher — see file header)
  await page.setViewportSize(VIEWPORT);

  await page.goto("/forget_password");
  const box = await page.getByTestId("auth-illustration").boundingBox();

  expect(Math.abs(box.height - VIEWPORT.height)).toBeLessThanOrEqual(2);
});

test("forget_password illustration reaches the bottom of the viewport", {
  tag: ["@flow:auth-forgot-password", "@module:auth", "@priority:P2", "@outcome:display"],
}, async ({ page }) => {
  // quality: allow-no-interaction (CSS-zoom/viewport regression guard — geometry is the behavior under test, not a click/fill)
  // quality: allow-render-only (asserts computed pixel geometry against the viewport, not a text/count matcher — see file header)
  await page.setViewportSize(VIEWPORT);

  await page.goto("/forget_password");
  const box = await page.getByTestId("auth-illustration").boundingBox();

  expect(Math.abs(box.y + box.height - VIEWPORT.height)).toBeLessThanOrEqual(2);
});
