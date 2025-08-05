// Menu organization helpers - no icons needed for consistency

/**
 * Transform flat menu options into hierarchical groups
 * @param {Array} flatOptions - Array of flat menu options
 * @param {Object} document - Document object to determine context
 * @returns {Array} Hierarchical menu structure
 */
export function organizeMenuIntoGroups(flatOptions, document) {
  if (!flatOptions || flatOptions.length === 0) {
    return [];
  }

  // Define group categories
  const groups = {
    editing: {
      id: 'editing',
      label: 'Edición y gestión',
      children: [],
      priority: 1
    },
    downloads: {
      id: 'downloads', 
      label: 'Descargas',
      children: [],
      priority: 2
    },
    communication: {
      id: 'communication',
      label: 'Comunicación',
      children: [],
      priority: 3
    },
    states: {
      id: 'states',
      label: 'Estados del documento',
      children: [],
      priority: 4
    },
    signatures: {
      id: 'signatures',
      label: 'Firmas',
      children: [],
      priority: 5
    },
    actions: {
      id: 'actions',
      label: 'Acciones',
      children: [],
      priority: 6
    }
  };

  // Map each option to its appropriate group
  flatOptions.forEach(option => {
    const enrichedOption = {
      ...option
    };

    switch (option.action) {
      // Editing and management
      case 'edit':
        groups.editing.children.push(enrichedOption);
        break;
      case 'permissions':
        groups.editing.children.push(enrichedOption);
        break;
      case 'copy':
        groups.editing.children.push(enrichedOption);
        break;

      // Downloads
      case 'downloadPDF':
      case 'downloadWord':
      case 'downloadSignedDocument':
        groups.downloads.children.push(enrichedOption);
        break;

      // Communication
      case 'email':
        groups.communication.children.push(enrichedOption);
        break;

      // Document states
      case 'publish':
      case 'draft':
      case 'formalize':
        groups.states.children.push(enrichedOption);
        break;

      // Signatures
      case 'viewSignatures':
      case 'sign':
        groups.signatures.children.push(enrichedOption);
        break;

      // Actions (preview, delete, etc.)
      case 'preview':
      case 'delete':
      case 'removeFromFolder':
      case 'useDocument':
        groups.actions.children.push(enrichedOption);
        break;

      default:
        // Fallback to actions group
        groups.actions.children.push(enrichedOption);
    }
  });

  // Convert groups to array and filter out empty groups
  const result = Object.values(groups)
    .filter(group => group.children.length > 0)
    .sort((a, b) => a.priority - b.priority);

  // If a group has only one item, don't make it a group - just return the item directly
  const finalResult = [];
  
  result.forEach((group, index) => {
    if (group.children.length === 1) {
      // Single item - add directly to menu
      finalResult.push(group.children[0]);
    } else {
      // Multiple items - keep as group
      finalResult.push(group);
    }

    // Add divider between groups (except for last group)
    if (index < result.length - 1) {
      finalResult.push({ divider: true });
    }
  });

  return finalResult;
}



/**
 * Check if options should be grouped based on their count
 * @param {Array} options - Menu options
 * @returns {boolean} Whether to use hierarchical grouping
 */
export function shouldUseHierarchicalMenu(options) {
  // Use hierarchical menu if there are more than 6 options
  return options && options.length > 6;
}