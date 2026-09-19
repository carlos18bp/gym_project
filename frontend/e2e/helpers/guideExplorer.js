import { setAuthLocalStorage } from './auth.js';
import { mockApi } from './api.js';

export async function openExplorerGuide(page, { role = 'client', ...flags } = {}) {
  const user = { id: 9100, role, first_name: 'Usuario', last_name: 'Explorador',
    email: 'explorer@example.com', is_profile_completed: true, ...flags };
  await mockApi(page, async ({ apiPath }) => {
    const responses = {
      'validate_token/': {}, 'users/': [user], 'users/9100/': user,
      'users/9100/signature/': { has_signature: false },
      'google-captcha/site-key/': { site_key: 'e2e-site-key' },
      'dynamic-documents/pending-signatures-count/': { count: 0 },
      'notifications/': { results: [], count: 0 },
    };
    return { status: 200, contentType: 'application/json', body: JSON.stringify(responses[apiPath] ?? {}) };
  });
  await setAuthLocalStorage(page, { token: 'e2e-token', userAuth: user });
  await page.goto('/user_guide');
  await page.getByTestId('open-guide-explorer').click();
}
