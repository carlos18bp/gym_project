// Main application initialization file
// Load only essential components for initial UI rendering

import './style.css'; // Import global CSS styles
import { createApp } from 'vue'; // Import only Vue app creation
import App from './App.vue'; // Import main App component
import { createPinia } from 'pinia'; // Import createPinia - this must be loaded synchronously
import router, { installRouterGuards } from './router';
import axios from 'axios';
import { useAuthStore } from './stores/auth/auth';
import vue3GoogleLogin from 'vue3-google-login';
import { registerSW } from 'virtual:pwa-register';

const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args) => {
  const message = args[0];
  if (
    typeof message === 'string' &&
    message.includes('Blocked aria-hidden on an element because its descendant retained focus')
  ) {
    return;
  }
  originalConsoleWarn(...args);
};

// Create the application
const app = createApp(App);

// Apply Pinia first
const pinia = createPinia();
app.use(pinia);

// Apply the router
app.use(router);

// Initialize authentication
const authStore = useAuthStore();

// Install router guards
installRouterGuards(authStore);

// Configure Axios with token if available
if (authStore.token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${authStore.token}`;
}

// Get the current domain for Google Login redirect
const isDevelopment = process.env.NODE_ENV === 'development';
const domain = isDevelopment 
  ? 'http://localhost:3000' 
  : 'https://www.gmconsultoresjuridicos.com';

// Register Google Login with explicit redirect configuration
app.use(vue3GoogleLogin, {
  clientId: '911084961992-qosfj4blhr31olteguo4enmkfgs8tfo7.apps.googleusercontent.com',
  prompt: 'select_account',
  redirect_uri: `${domain}/auth/google/callback`
});

// Register service worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    console.log('Application ready for offline use');
  },
});

// Mount the application
app.mount('#app');
