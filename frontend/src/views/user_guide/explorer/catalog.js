// Descriptive, public-to-authenticated-users content only. Never load business records here.
import { legalSpace, attentionSpace, collaborationSpace, accountSpace } from './spaces.js';

export const ecosystem = {
  id: 'ecosystem', kind: 'root', label: 'G&M Consultores Jurídicos', icon: 'ecosystem',
  summary: 'Conoce cómo se conectan las herramientas de tu plataforma jurídica.',
  value: 'Encuentra el módulo adecuado y comprende el recorrido de tu trabajo.',
  audience: 'Todos los usuarios',
  children: [legalSpace, attentionSpace, collaborationSpace, accountSpace],
  relations: [
    { from: 'legal', to: 'collaboration', label: 'Procesos y firmas generan notificaciones' },
    { from: 'attention', to: 'collaboration', label: 'Las solicitudes generan seguimiento y avisos' },
  ],
};

export function flattenNodes(node = ecosystem) {
  return [node, ...(node.children || []).flatMap(flattenNodes)];
}

const nodes = flattenNodes();
const nodeIndex = new Map(nodes.map(node => [node.id, node]));
export const findNode = id => nodeIndex.get(id) || null;

export function nodePath(id, node = ecosystem) {
  if (node.id === id) return [node];
  for (const child of node.children || []) {
    const path = nodePath(id, child);
    if (path.length) return [node, ...path];
  }
  return [];
}

export function tourSteps(id) {
  const space = findNode(id);
  return space?.kind === 'space' ? flattenNodes(space).slice(1) : [];
}

const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

export function searchNodes(query) {
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return nodes.filter(node => node.kind !== 'root' && terms.every(term =>
    normalize([node.label, node.summary, node.value, node.audience].filter(Boolean).join(' ')).includes(term)
  )).slice(0, 12);
}

// Visibility of documentation is independent of permission to open the real module.
// isLawyerLike is supplied by the existing user-store getter, not redefined here.
export function nodeAccess(node, user, isLawyerLike) {
  if (!user) return { allowed: false, reason: 'Cargando tus permisos…' };
  const admin = user.role === 'admin' || user.is_staff || user.is_superuser;
  const rules = {
    all: true,
    lawyer: isLawyerLike,
    admin,
    intranet: admin || (user.role === 'lawyer' && user.is_gym_lawyer),
    organization: !admin && ['client', 'corporate_client', 'basic'].includes(user.role),
    corporate: !admin && user.role === 'corporate_client',
    paid: user.role !== 'basic',
    appointment: !admin,
  };
  const allowed = Boolean(rules[node.access || 'all']);
  return { allowed, reason: allowed ? 'Disponible para tu cuenta' : `Requiere: ${node.audience}` };
}

export function guideTarget(node, guideStore, role) {
  if (!node.guide) return null;
  const [moduleId, sectionId] = node.guide;
  if (!guideStore.getModulesForRole(role).some(module => module.id === moduleId)) return null;
  const content = guideStore.getModuleContent(moduleId, role);
  if (!content || (sectionId && !content.sections?.some(section => section.id === sectionId))) return null;
  return { moduleId, sectionId: sectionId || null };
}
