import { useAuthStore } from "@/stores/auth";
import { createRouter, createWebHistory } from "vue-router";
import SlideBar from '@/components/layouts/SlideBar.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
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
          path: '',
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
          path: '',
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
          path: '',
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
          path: '',
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
          path: '',
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
          path: '',
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
          path: '',
          name: "schedule_appointment",
          component: () => import("@/views/schedule_appointment/ScheduleAppointment.vue"),
          meta: { requiresAuth: true },
        },
      ],
    },
    {
      path: "/dynamic_document_dashboard",
      component: SlideBar,
      children: [
        {
          path: '',
          name: "dynamic_document_dashboard",
          component: () => import("@/views/dynamic_document/Dashboard.vue"),
          meta: { requiresAuth: true },
        },
        {
          path: 'contract/new/:name',
          component: () => import('@/views/dynamic_document/ContractEditor.vue'),
          props: true,
          meta: { requiresAuth: true },
        },
        {
          path: 'contract/new/:name/variables-config',
          name: 'contract_variables_config',
          component: () => import('@/views/dynamic_document/ContractVariablesConfig.vue'),
          props: true,
          meta: { requiresAuth: true },
        },
      ],
    }
    
  ],
  scrollBehavior() {
    return { top: 0 };
  },
});

// Navigation guard to check for authentication
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  // Check if the route requires authentication
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    next({ name: "sign_in" });
  } else {
    next();
  }
});

export default router;
export const routes = router.options.routes;
