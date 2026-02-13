export async function installWompiStubs(
  page,
  {
    sessionId = "e2e-session",
    tokenId = "e2e-card-token",
    tokenStatus = 200,
    tokenError = "wompi_token_error",
  } = {}
) {
  await page.route("**://checkout.wompi.co/widget.js", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        (function(){
          window.WidgetCheckout = function(){
            this.open = function(cb){
              if (cb) {
                cb({ transaction: { status: 'APPROVED', sessionId: '${sessionId}' } });
              }
            };
          };
        })();
      `,
    });
  });

  await page.route("**://wompijs.wompi.com/libs/js/v1.js", async (route) => {
    return route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `
        (function(){
          window.$wompi = {
            initialize: function(cb){
              if (cb) {
                cb({ sessionId: '${sessionId}' }, null);
              }
            }
          };
        })();
      `,
    });
  });

  await page.route("**://sandbox.wompi.co/v1/tokens/cards", async (route) => {
    if (tokenStatus !== 200) {
      return route.fulfill({
        status: tokenStatus,
        contentType: "application/json",
        body: JSON.stringify({ error: tokenError }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "CREATED",
        data: { id: tokenId },
      }),
    });
  });
}
