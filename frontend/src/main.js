// Archivo principal de inicialización de la aplicación
// Cargamos primero solo lo esencial para renderizar la UI inicial

import './style.css'; // Importar estilos globales CSS
import { createApp } from 'vue'; // Importar solo la creación de la aplicación Vue
import App from './App.vue'; // Importar el componente principal App
import { createPinia } from 'pinia'; // Importar createPinia - esto debe cargarse sincrónicamente
import router, { installRouterGuards } from './router';
import axios from 'axios';
import { useAuthStore } from './stores/auth';
import vue3GoogleLogin from 'vue3-google-login';
import { registerSW } from 'virtual:pwa-register';

// Crear la aplicación
const app = createApp(App);

// Aplicar Pinia primero
const pinia = createPinia();
app.use(pinia);

// Aplicar el router
app.use(router);

// Inicializar autenticación 
const authStore = useAuthStore();

// Instalar los guards del router
installRouterGuards(authStore);

// Configurar Axios con el token si está disponible
if (authStore.token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${authStore.token}`;
}

// Registrar Google Login
app.use(vue3GoogleLogin, {
  clientId: '931303546385-777cpce87b2ro3lsgvdua25rfqjfgktg.apps.googleusercontent.com'
});

// Registrar el service worker para PWA
const updateSW = registerSW({
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    console.log('Application ready for offline use');
  },
});

// Montar la aplicación
app.mount('#app');
