import type { Role } from '@/db/schema';

/**
 * Permissões do CSCX.
 * ADMIN vê e faz tudo. COORDENADOR gerencia a operação e a equipe.
 * ANALISTA opera a carteira. ALUNO só enxerga o próprio portal.
 */
export const PERMISSIONS = {
  'dashboard.executivo': ['ADMIN', 'COORDENADOR'],
  'dashboard.gerencial': ['ADMIN', 'COORDENADOR'],
  'dashboard.operacional': ['ADMIN', 'COORDENADOR', 'ANALISTA'],
  'carteira.view': ['ADMIN', 'COORDENADOR', 'ANALISTA'],
  'carteira.viewAll': ['ADMIN', 'COORDENADOR'],
  'aluno.edit': ['ADMIN', 'COORDENADOR', 'ANALISTA'],
  'aluno.healthScore.update': ['ADMIN', 'COORDENADOR', 'ANALISTA'],
  'interacao.create': ['ADMIN', 'COORDENADOR', 'ANALISTA'],
  'tarefa.create': ['ADMIN', 'COORDENADOR', 'ANALISTA'],
  'onboarding.manage': ['ADMIN', 'COORDENADOR', 'ANALISTA'],
  'pesquisa.send': ['ADMIN', 'COORDENADOR', 'ANALISTA'],
  'planoAcao.manage': ['ADMIN', 'COORDENADOR', 'ANALISTA'],
  'playbook.manage': ['ADMIN', 'COORDENADOR'],
  'automacao.manage': ['ADMIN', 'COORDENADOR'],
  'equipe.view': ['ADMIN', 'COORDENADOR'],
  'equipe.manage': ['ADMIN'],
  'relatorio.export': ['ADMIN', 'COORDENADOR'],
  'integracao.manage': ['ADMIN'],
  'auditoria.view': ['ADMIN'],
  'config.healthScore': ['ADMIN', 'COORDENADOR'],
  'assistente.use': ['ADMIN', 'COORDENADOR', 'ANALISTA'],
  'portal.aluno': ['ALUNO', 'ADMIN'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  if (role === 'ADMIN') return true;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export function assertCan(role: Role | undefined | null, permission: Permission) {
  if (!can(role, permission)) throw new Error('FORBIDDEN');
}

export function isStaff(role: Role | undefined | null) {
  return role === 'ADMIN' || role === 'COORDENADOR' || role === 'ANALISTA';
}
