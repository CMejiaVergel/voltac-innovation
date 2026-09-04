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
    help: "Hay una fuente identificada que respalda la afirmacion: una URL consultable o un documento concreto.",
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

// ─────────────────────────────────────────────────────────────────────────────
// Etapa Combinar
// ─────────────────────────────────────────────────────────────────────────────

/** Papel que juega un punto dentro del insight que ayuda a sostener. */
export const DOT_ROLES = ["HECHO", "CONTRAPARTE", "APOYO"] as const;
export type DotRole = (typeof DOT_ROLES)[number];

export const DOT_ROLE_META: Record<DotRole, { label: string; help: string; color: string }> = {
  HECHO: {
    label: "Hecho",
    help: "La necesidad o particularidad verificable. La primera punta del intercambio.",
    color: "#2F5D8C",
  },
  CONTRAPARTE: {
    label: "Contraparte",
    help: "La conducta de mercado ya observada que responde a esa necesidad. La segunda punta.",
    color: "#8E5324",
  },
  APOYO: {
    label: "Apoyo",
    help: "Dato que refuerza o matiza, sin ser ninguna de las dos puntas.",
    color: "#5E7370",
  },
};

/**
 * Minimo de puntos para que un insight sea una combinacion y no una glosa.
 *
 * Con uno solo no se combina nada: se esta comentando un fragmento. Por eso
 * DOS es el limite duro que la plataforma rechaza.
 *
 * TRES es la recomendacion del taller —un insight con tres puntos casi siempre
 * es mas rico— pero se queda en aviso: forzarlo llevaria al equipo a inflar
 * conexiones para pasar la validacion, que es justo lo que la metodologia
 * prohibe cuando habla de no rellenar por cuota.
 */
export const DOTS_MINIMO = 2;
export const DOTS_RECOMENDADO = 3;
