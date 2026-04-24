import { DocumentTextIcon } from '@heroicons/vue/24/outline';
import { allModules } from './modules.js';

export const guideGetters = {
  /**
   * Get modules available for a specific role
   */
  getModulesForRole: () => (role) => {
    return allModules.filter(module => module.roles.includes(role));
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
      contentCopy.sections = contentCopy.sections.filter(section => {
        if (!section.roles) return true;
        return section.roles.includes(role);
      });
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
