import { useAuthStore } from "@/stores/auth";
import { createRouter, createWebHistory } from "vue-router";
import SlideBar from "@/components/layouts/SlideBar.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/sign_in",
      name: "sign_in",
      component: () => import("@/views/auth/SignIn.vue"),
      meta: { requiresAuth: false },
    },
    {
      path: "/home",
      name: "home",
      component: () => import("@/views/policies/Home.vue"),
      meta: { requiresAuth: false },
    },
    {
      path: "/sign_on",
      name: "sign_on",
      component: () => import("@/views/auth/SignOn.vue"),
      meta: { requiresAuth: false },
    },
    {
      path: "/forget_password",
      name: "forget_password",
      component: () => import("@/views/auth/ForgetPassword.vue"),
      meta: { requiresAuth: false },
    },
    {
      path: "/policies/privacy_policy",
      name: "privacy_policy",
      component: () => import("@/views/policies/PrivacyPolicy.vue"),
      meta: { requiresAuth: false },
    },
    {
      path: "/policies/terms_of_use",
      name: "terms_of_use",
      component: () => import("@/views/policies/TermsOfUse.vue"),
      meta: { requiresAuth: false },
    },
    {
      path: "/no_connection",
      name: "no_connection",
      component: () => import("@/views/offline/NoConnection.vue"),
      meta: { requiresAuth: false },
    },
    {
      path: "/process_list/:user_id?/:display?",
      component: SlideBar,
      children: [
        {
          path: "",
          name: "process_list",
          component: () => import("@/views/process/ProcessList.vue"),
          meta: { requiresAuth: true },
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
          component: () => import("@/views/process/ProcessDetail.vue"),
          meta: { requiresAuth: true },
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
          component: () => import("@/views/process/ProcessForm.vue"),
          meta: { requiresAuth: true },
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
          component: () => import("@/views/directory/DirectoryList.vue"),
          meta: { requiresAuth: true },
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
          component: () => import("@/views/legal_request/LegalRequest.vue"),
          meta: { requiresAuth: true },
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
          component: () => import("@/views/intranet_g_y_m/IntranetGyM.vue"),
          meta: { requiresAuth: true },
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
          component: () =>
            import("@/views/schedule_appointment/ScheduleAppointment.vue"),
          meta: { requiresAuth: true },
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
          component: () => import("@/views/dynamic_document/Dashboard.vue"),
          meta: { requiresAuth: true },
        },
        {
          path: "lawyer/editor/create/:title",
          component: () =>
            import("@/views/dynamic_document/DocumentEditor.vue"),
          props: true,
          meta: { requiresAuth: true },
        },
        {
          path: "lawyer/editor/edit/:id",
          component: () =>
            import("@/views/dynamic_document/DocumentEditor.vue"),
          props: true,
          meta: { requiresAuth: true },
        },
        {
          path: "document/use/:mode/:id/:title",
          component: () =>
            import("@/views/dynamic_document/client/DocumentForm.vue"),
          props: true,
          meta: { requiresAuth: true },
        },
        {
          path: "lawyer/variables-config",
          component: () =>
            import("@/views/dynamic_document/DocumentVariablesConfig.vue"),
          meta: { requiresAuth: true },
        },
      ],
    },
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Check if the route requires authentication
  if (to.meta.requiresAuth && !(await authStore.isAuthenticated())) {
    console.warn("User is not authenticated. Redirecting to sign_in.");
    next({ name: "sign_in" }); // Redirect to sign_in if not authenticated
  }
  // Use router.resolve to check if the route exists, accounting for dynamic paths
  else {
    const resolvedRoute = router.resolve(to);

    // If the resolved route does not match any defined route, handle it as undefined
    if (!resolvedRoute.matched.length) {
      console.warn("Route not found. Redirecting...");
      if (await authStore.isAuthenticated()) {
        next({ name: "process_list" }); // Redirect to process_list if authenticated
      } else {
        next({ name: "sign_in" }); // Redirect to sign_in if not authenticated
      }
    } else {
      next(); // Proceed to the defined route
    }
  }
});

export default router;
export const routes = router.options.routes;
