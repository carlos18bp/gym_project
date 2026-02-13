export async function setAuthLocalStorage(page, { token, userAuth }) {
  await page.addInitScript(
    ({ token: t, userAuth: u }) => {
      localStorage.setItem("token", t);
      localStorage.setItem("userAuth", JSON.stringify(u));
    },
    { token, userAuth }
  );
}
