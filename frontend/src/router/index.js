import { useAuthStore } from "@/stores/auth";
import { createRouter, createWebHistory } from "vue-router";
import SlideBar from '@/components/layouts/SlideBar.vue';

// Define the routes for the application
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "sign_in",
      component: () => import("@/views/auth/SignIn.vue"),
    },
    {
      path: "/sign_on",
      name: "sign_on",
      component: () => import("@/views/auth/SignOn.vue"),
    },
    {
      path: "/forget_password",
      name: "forget_password",
      component: () => import("@/views/auth/ForgetPassword.vue"),
    },
    {
      path: "/policies/privacy_policy",
      name: "privacy_policy",
      component: () => import("@/views/policies/PrivacyPolicy.vue"),
    },
    {
      path: "/policies/terms_of_use",
      name: "terms_of_use",
      component: () => import("@/views/policies/TermsOfUse.vue"),
    },
    {
      path: "/process_list/:user_id?/:display?",
      component: SlideBar,
      children: [
        {
          path: '',
          name: "process_list",
          component: () => import("@/views/process/ProcessList.vue")
        },
      ],
    },
    {
      path: "/process_detail/:process_id/:display?",
      component: SlideBar,
      children: [
        {
          path: '',
          name: "process_detail",
          component: () => import("@/views/process/ProcessDetail.vue"),
        },
      ],
    },
    {
      path: "/process_form/:action/:process_id?",
      component: SlideBar,
      children: [
        {
          path: '',
          name: "process_form",
          component: () => import("@/views/process/ProcessForm.vue"),
        },
      ],
    },
    {
      path: "/directory_list",  
      component: SlideBar,
      children: [
        {
          path: '',
          name: "directory_list",
          component: () => import("@/views/directory/DirectoryList.vue"),
        },
      ],
    },
  ],
});

// Navigation guard to check for authentication
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next("/"); // Redirect to home if not authenticated
  } else {
    next(); // Proceed to the route
  }
});

export default router; // Export the router instance
export const routes = router.options.routes; // Export the routes array
