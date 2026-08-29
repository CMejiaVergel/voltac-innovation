/**
 * Unica fuente de verdad de los estados del dominio.
 *
 * SQLite no tiene enums nativos, asi que Prisma los guarda como String. Estos
 * objetos son lo que valida y etiqueta esos strings en toda la aplicacion.
 */

export const USER_ROLES = ["ADMIN", "MEMBER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROJECT_ROLES = ["OWNER", "EDITOR", "VIEWER"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

export const PROJECT_ROLE_LABEL: Record<ProjectRole, string> = {
  OWNER: "Responsable",
  EDITOR: "Editor",
  VIEWER: "Lector",
};

/** Puede modificar fragmentos, brief y correr el agente. */
export function canEdit(role: ProjectRole | null | undefined): boolean {
  return role === "OWNER" || role === "EDITOR";
}

/** Puede invitar miembros, borrar el proyecto y cambiar la plantilla. */
export function canAdminProject(role: ProjectRole | null | undefined): boolean {
  return role === "OWNER";
}

// ── Estado de verificacion de un fragmento ───────────────────────────────────
// Esto es lo que impide que una estimacion se lea despues como un hecho.

export const VERIFICATIONS = ["VERIFIED", "TO_CONFIRM", "ASSUMPTION"] as const;
export type Verification = (typeof VERIFICATIONS)[number];

export const VERIFICATION_META: Record<
  Verification,
  { label: string; short: string; help: string; color: string; dot: string }
> = {
  VERIFIED: {
    label: "Verificado",
    short: "VER",
    help: "Existe una fuente publica consultable que respalda la afirmacion.",
    color: "#2F7D5F",
    dot: "●",
  },
  TO_CONFIRM: {
    label: "Por confirmar",
    short: "P/C",
    help: "El dato existe pero falta confirmarlo con la empresa o con la fuente primaria.",
    color: "#B8791F",
    dot: "◐",
  },
  ASSUMPTION: {
    label: "Supuesto",
    short: "SUP",
    help: "Inferencia del equipo o del agente. No hay fuente. Nunca se cita como hecho.",
    color: "#8E3324",
    dot: "○",
  },
};

// ── Estado de revision (cola humana sobre lo que propone el agente) ──────────

export const REVIEW_STATES = ["ACCEPTED", "PROPOSED", "REJECTED"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  ACCEPTED: "En el mapa",
  PROPOSED: "Propuesto por el agente",
  REJECTED: "Descartado",
};

export const ORIGINS = ["HUMAN", "AGENT"] as const;
export type Origin = (typeof ORIGINS)[number];

export const RUN_STATUSES = ["PENDING", "RUNNING", "DONE", "ERROR"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  PENDING: "En cola",
  RUNNING: "Investigando",
  DONE: "Completada",
  ERROR: "Con error",
};

export const REVISION_ACTIONS = [
  "CREATE",
  "EDIT",
  "MOVE",
  "VERIFY",
  "ACCEPT",
  "REJECT",
  "DELETE",
] as const;
export type RevisionAction = (typeof REVISION_ACTIONS)[number];

export const REVISION_ACTION_LABEL: Record<RevisionAction, string> = {
  CREATE: "Creado",
  EDIT: "Texto editado",
  MOVE: "Movido de celda",
  VERIFY: "Cambio de verificacion",
  ACCEPT: "Aceptado en el mapa",
  REJECT: "Descartado",
  DELETE: "Eliminado",
};

export const QUESTION_STATUSES = ["OPEN", "ANSWERED", "DISCARDED"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  OPEN: "Sin responder",
  ANSWERED: "Respondida",
  DISCARDED: "Descartada",
};

/** Narrow de un string de base de datos a un valor del union, con fallback. */
export function asEnum<T extends readonly string[]>(
  values: T,
  value: string | null | undefined,
  fallback: T[number],
): T[number] {
  return values.includes(value as T[number]) ? (value as T[number]) : fallback;
}
