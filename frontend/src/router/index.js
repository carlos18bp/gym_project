import { useAuthStore } from "@/stores/auth/auth";
import { createRouter, createWebHistory } from "vue-router";
import SlideBar from "@/components/layouts/SlideBar.vue";

// Import useRecentViews lazily to avoid premature initialization
let recentViewsModule = null;
const getRecentViews = async () => {
  if (!recentViewsModule) {
    recentViewsModule = await import("@/composables/useRecentViews");
  }
  return recentViewsModule.useRecentViews();
};

// Create the router without circular dependencies
const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Root path that redirects to login or dashboard based on authentication
    {
      path: "/",
      redirect: to => {
        // This redirection will be handled in the global guard
        return { name: "sign_in" };
      }
    },
    {
      path: "/sign_in",
      name: "sign_in",
      component: () => import(/* webpackChunkName: "auth" */ "@/views/auth/SignIn.vue"),
      meta: { requiresAuth: false, title: "Iniciar Sesión" },
    },
    // Special route for Google OAuth callback
    {
      path: "/auth/google/callback",
      name: "google_oauth_callback",
      component: () => import(/* webpackChunkName: "auth" */ "@/views/auth/SignIn.vue"),
      meta: { requiresAuth: false, title: "Autenticación con Google", isCallback: true },
    },
    {
      path: "/home",
      name: "home",
      component: () => import(/* webpackChunkName: "policies" */ "@/views/policies/Home.vue"),
      meta: { requiresAuth: false, title: "Políticas de Privacidad" },
    },
    {
      path: "/sign_on",
      name: "sign_on",
      component: () => import(/* webpackChunkName: "auth" */ "@/views/auth/SignOn.vue"),
      meta: { requiresAuth: false, title: "Registrarse" },
    },
    {
      path: "/forget_password",
      name: "forget_password",
      component: () => import(/* webpackChunkName: "auth" */ "@/views/auth/ForgetPassword.vue"),
      meta: { requiresAuth: false, title: "Recuperar Contraseña" },
    },
    {
      path: "/policies/privacy_policy",
      name: "privacy_policy",
      component: () => import(/* webpackChunkName: "policies" */ "@/views/policies/PrivacyPolicy.vue"),
      meta: { requiresAuth: false, title: "Política de Privacidad" },
    },
    {
      path: "/policies/terms_of_use",
      name: "terms_of_use",
      component: () => import(/* webpackChunkName: "policies" */ "@/views/policies/TermsOfUse.vue"),
      meta: { requiresAuth: false, title: "Términos de Uso" },
    },
    {
      path: "/no_connection",
      name: "no_connection",
      component: () => import(/* webpackChunkName: "offline" */ "@/views/offline/NoConnection.vue"),
      meta: { requiresAuth: false, title: "Sin Conexión" },
    },
    {
      path: "/dashboard",
      component: SlideBar,
      children: [
        {
          path: "",
          name: "dashboard",
          component: () => import(/* webpackChunkName: "dashboard" */ "@/views/dashboard/dashboard.vue"),
          meta: { 
            requiresAuth: true, 
            title: "Panel Principal",
            prefetch: true
          },
        },
      ],
    },
    {
      path: "/process_list/:user_id?/:display?",
      component: SlideBar,
      children: [
        {
          path: "",
          name: "process_list",
          component: () => import(/* webpackChunkName: "process-list" */ "@/views/process/ProcessList.vue"),
          meta: { requiresAuth: true, title: "Lista de Procesos" },
        },
      ],
    },
    {
      path: "/process_detail/:process_id/:display?",
      component: SlideBar,
      children: [
        {
          path: "",
          name: "process_detail",
          component: () => import(/* webpackChunkName: "process-detail" */ "@/views/process/ProcessDetail.vue"),
          meta: { requiresAuth: true, title: "Detalle de Proceso" },
        },
      ],
    },
    {
      path: "/process_form/:action/:process_id?",
      component: SlideBar,
      children: [
        {
          path: "",
          name: "process_form",
          component: () => import(/* webpackChunkName: "process-form" */ "@/views/process/ProcessForm.vue"),
          meta: { 
            requiresAuth: true, 
            title: "Formulario de Proceso",
            requiresLawyer: true
          },
        },
      ],
    },
    {
      path: "/directory_list",
      component: SlideBar,
      children: [
        {
          path: "",
          name: "directory_list",
          component: () => import(/* webpackChunkName: "directory" */ "@/views/directory/DirectoryList.vue"),
          meta: { 
            requiresAuth: true, 
            title: "Directorio",
            requiresLawyer: true
          },
        },
      ],
    },
    {
      path: "/legal_request",
      component: SlideBar,
      children: [
        {
          path: "",
          name: "legal_request",
          component: () => import(/* webpackChunkName: "legal-request" */ "@/views/legal_request/LegalRequest.vue"),
          meta: { requiresAuth: true, title: "Solicitud Legal" },
        },
      ],
    },
    {
      path: "/legal_requests",
      component: SlideBar,
      children: [
        {
          path: "",
          name: "legal_requests_list",
          component: () => import(/* webpackChunkName: "legal-requests-list" */ "@/views/legal_request/LegalRequestsList.vue"),
          meta: { requiresAuth: true, title: "Lista de Solicitudes" },
        },
      ],
    },
    {
      path: "/legal_request_create",
      component: SlideBar,
      children: [
        {
          path: "",
          name: "legal_request_create",
          component: () => import(/* webpackChunkName: "legal-request-create" */ "@/views/legal_request/LegalRequest.vue"),
          meta: { requiresAuth: true, title: "Nueva Solicitud" },
        },
      ],
    },
    {
      path: "/legal_request_detail/:id",
      component: SlideBar,
      children: [
        {
          path: "",
          name: "legal_request_detail",
          component: () => import(/* webpackChunkName: "legal-request-detail" */ "@/views/legal_request/LegalRequestDetail.vue"),
          meta: { requiresAuth: true, title: "Detalle de Solicitud" },
        },
      ],
    },
    {
      path: "/intranet_g_y_m",
      component: SlideBar,
      children: [
        {
          path: "",
          name: "intranet_g_y_m",
          component: () => import(/* webpackChunkName: "intranet" */ "@/views/intranet_g_y_m/IntranetGyM.vue"),
          meta: { 
            requiresAuth: true, 
            title: "Intranet G y M",
            requiresLawyer: true
          },
        },
      ],
    },
    {
      path: "/schedule_appointment",
      component: SlideBar,
      children: [
        {
          path: "",
          name: "schedule_appointment",
          component: () => import(/* webpackChunkName: "appointment" */ "@/views/schedule_appointment/ScheduleAppointment.vue"),
          meta: { requiresAuth: true, title: "Agendar Cita" },
        },
      ],
    },
    {
      path: "/organizations_dashboard",
      component: SlideBar,
      children: [
        {
          path: "",
          name: "organizations_dashboard",
          component: () => import(/* webpackChunkName: "organizations" */ "@/views/organizations/Dashboard.vue"),
          meta: { requiresAuth: true, title: "Organizaciones" },
        },
      ],
    },
    {
      path: "/dynamic_document_dashboard",
      component: SlideBar,
      children: [
        {
          path: "",
          name: "dynamic_document_dashboard",
          component: () => import(/* webpackChunkName: "dynamic-document" */ "@/views/dynamic_document/Dashboard.vue"),
          meta: { requiresAuth: true, title: "Documentos Dinámicos" },
        },
        {
          path: "signed-documents",
          name: "signed-documents",
          component: () => import(/* webpackChunkName: "dynamic-document" */ "@/components/dynamic_document/common/SignaturesList.vue"),
          props: {
            state: 'FullySigned'
          },
          meta: { requiresAuth: true, title: "Documentos Firmados" },
        },
        {
          path: "lawyer/editor/create/:title",
          component: () => import(/* webpackChunkName: "dynamic-document-editor" */ "@/views/dynamic_document/DocumentEditor.vue"),
          props: true,
          meta: { 
            requiresAuth: true, 
            title: "Crear Documento",
            requiresLawyer: true
          },
        },
        {
          path: "lawyer/editor/edit/:id",
          component: () => import(/* webpackChunkName: "dynamic-document-editor" */ "@/views/dynamic_document/DocumentEditor.vue"),
          props: true,
          meta: { 
            requiresAuth: true, 
            title: "Editar Documento", 
            requiresLawyer: true 
          },
        },
        {
          path: "client/editor/edit/:id",
          component: () => import(/* webpackChunkName: "dynamic-document-editor" */ "@/views/dynamic_document/DocumentEditor.vue"),
          props: true,
          meta: { 
            requiresAuth: true, 
            title: "Editar Documento"
          },
        },
        {
          path: "document/use/:mode/:id/:title",
          component: () => import(/* webpackChunkName: "dynamic-document-form" */ "@/views/dynamic_document/DocumentForm.vue"),
          props: true,
          meta: { requiresAuth: true, title: "Completar Documento" },
        },
        {
          path: "lawyer/variables-config",
          component: () => import(/* webpackChunkName: "dynamic-document-config" */ "@/views/dynamic_document/DocumentVariablesConfig.vue"),
          meta: { 
            requiresAuth: true, 
            title: "Configurar Variables",
            requiresLawyer: true
          },
        },
      ],
    },
    // Catch-all route to handle not found routes
    { 
      path: '/:pathMatch(.*)*', 
      redirect: to => {
        // This redirect will be handled in the global guard
        return { name: 'sign_in' };
      }
    }
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

// Set a flag to control if guards are already installed
let guardsInstalled = false;

// Function to install router guards when auth store is ready
export function installRouterGuards(authStore) {
  if (guardsInstalled) return;
  guardsInstalled = true;

  router.beforeEach(async (to, from, next) => {
    try {
      // Check authentication
      const isAuthenticated = await authStore.isAuthenticated();
      
      // Check if it's the root path '/' or a not found route
      if (to.name === null || to.path === '/') {
        if (isAuthenticated) {
          return next({ name: 'dashboard' });
        } else {
          return next({ name: 'sign_in' });
        }
      }
      
      // Check if route requires authentication
      if (to.meta.requiresAuth && !isAuthenticated) {
        console.warn("User is not authenticated. Redirecting to sign_in.");
        return next({ name: "sign_in" });
      }
      
      // If user is authenticated, check role restrictions
      if (isAuthenticated && to.meta.requiresLawyer) {
        // Load user data if not loaded
        const userStore = await import('@/stores/auth/user').then(m => m.useUserStore());
        await userStore.init();
        
        // Check if the user is a client, basic user, or corporate_client trying to access a lawyer-only route
        if (userStore.currentUser?.role === 'client' || 
            userStore.currentUser?.role === 'basic' || 
            userStore.currentUser?.role === 'corporate_client') {
          console.warn("Non-lawyer user attempting to access lawyer-only route. Redirecting to dashboard.");
          return next({ name: 'dashboard' });
        }
      }
      
      // Proceed to the requested route
      return next();
    } catch (error) {
      console.error("Error in router guard:", error);
      return next({ name: 'sign_in' });
    }
  });

  // Register views after each successful navigation
  router.afterEach(async (to) => {
    try {
      // Update page title
      if (to.meta.title) {
        document.title = `${to.meta.title} | G&M Abogados`;
      } else {
        document.title = 'G&M Abogados';
      }

      // Only try to register views if there's an ID to register
      if (to.name === 'process_detail' || 
          to.path.includes('/dynamic_document_dashboard/') ||
          (to.query && to.query.documentId)) {
        
        // Get recent views module lazily
        try {
          const { registerView } = await getRecentViews();
          
          // Register process view
          if (to.name === 'process_detail' && to.params.process_id) {
            registerView('process', to.params.process_id);
          }

          // Register document view for lawyer editor
          if (to.path.includes('/dynamic_document_dashboard/lawyer/editor/edit/') && to.params.id) {
            registerView('document', to.params.id);
          }

          // Register document view for client
          if (to.path.includes('/dynamic_document_dashboard/document/use/') && to.params.id) {
            registerView('document', to.params.id);
          }

          // Register document view for variables configuration
          if (to.path.includes('/dynamic_document_dashboard/lawyer/variables-config') && to.query.documentId) {
            registerView('document', to.query.documentId);
          }
        } catch (e) {
          console.error("Error registering view:", e);
          // We don't block navigation because of an error registering views
        }
      }
    } catch (error) {
      console.error("Error in afterEach guard:", error);
      // We don't do anything, allow navigation to continue
    }
  });
}

export default router;
export const routes = router.options.routes;
