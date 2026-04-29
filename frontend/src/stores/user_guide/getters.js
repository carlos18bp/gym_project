import { DocumentTextIcon } from '@heroicons/vue/24/outline';
import { allModules } from './modules.js';

// "admin" inherits everything a lawyer sees plus admin-only modules/sections.
// Mirrors the lawyer-like predicate centralized in stores/auth/user.js so the
// router guard, the editor, and this manual stay in lock-step.
const roleMatches = (allowedRoles, role) => {
  if (!allowedRoles) return true;
  if (allowedRoles.includes(role)) return true;
  if (role === 'admin' && allowedRoles.includes('lawyer')) return true;
  return false;
};

export const guideGetters = {
  /**
   * Get modules available for a specific role
   */
  getModulesForRole: () => (role) => {
    return allModules.filter(module => roleMatches(module.roles, role));
  },

  /**
   * Get content for a specific module and role
   */
  getModuleContent: (state) => (moduleId, role) => {
    if (!state.guideContent[moduleId]) return null;

    const content = state.guideContent[moduleId];

    // Create a copy to avoid mutating the state
    const contentCopy = { ...content };

    // Filter sections based on role if needed
    if (contentCopy.sections) {
      contentCopy.sections = contentCopy.sections.filter(section => roleMatches(section.roles, role));
    }

    return contentCopy;
  },

  /**
   * Search through guide content
   */
  searchGuideContent: (state) => (query) => {
    const results = [];
    const lowerQuery = query.toLowerCase();

    Object.entries(state.guideContent).forEach(([moduleId, module]) => {
      // Search in module name and description
      if (module.name?.toLowerCase().includes(lowerQuery) ||
          module.description?.toLowerCase().includes(lowerQuery)) {
        results.push({
          module: module.name,
          section: 'General',
          title: module.name,
          snippet: module.description,
          moduleId: moduleId,
          sectionId: null,
          icon: module.icon || DocumentTextIcon
        });
      }

      // Search in sections
      if (module.sections) {
        module.sections.forEach(section => {
          if (section.name?.toLowerCase().includes(lowerQuery) ||
              section.description?.toLowerCase().includes(lowerQuery) ||
              section.content?.toLowerCase().includes(lowerQuery)) {
            results.push({
              module: module.name,
              section: section.name,
              title: section.name,
              snippet: section.description || section.content?.substring(0, 150),
              moduleId: moduleId,
              sectionId: section.id,
              icon: module.icon || DocumentTextIcon
            });
          }

          // Search in features
          if (section.features) {
            section.features.forEach(feature => {
              if (feature.toLowerCase().includes(lowerQuery)) {
                results.push({
                  module: module.name,
                  section: section.name,
                  title: feature,
                  snippet: `Funcionalidad: ${feature}`,
                  moduleId: moduleId,
                  sectionId: section.id,
                  icon: module.icon || DocumentTextIcon
                });
              }
            });
          }
        });
      }
    });

    return results;
  }
};
