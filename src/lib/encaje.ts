/**
 * Encaje de un desafío con la intención de innovar de su organización.
 *
 * Lo evalúa el equipo, no la IA: es la conversación que el mentor pidió
 * («¿este reto está enmarcado en lo que nos agrega valor?»). Aquí solo se
 * resume lo que el equipo marcó.
 */

export type Encaje = {
  /** Tipos de innovación de la organización que toca el desafío. */
  tipos: string[];
  /** Por cada restricción de la organización: ¿el desafío la respeta? */
  restricciones: Record<string, boolean>;
  /** ¿Aporta a la brecha de crecimiento declarada? */
  brecha: boolean | null;
  /** ¿Cabe en el horizonte y la inversión del perfil? */
  perfil: boolean | null;
  nota: string;
};

export const ENCAJE_VACIO: Encaje = { tipos: [], restricciones: {}, brecha: null, perfil: null, nota: "" };

export type ResumenEncaje = {
  evaluado: boolean;
  /** 0..100 */
  puntaje: number;
  /** Una restricción incumplida descarta, aunque lo demás encaje. */
  rompeRestriccion: boolean;
  veredicto: "ENCAJA" | "PARCIAL" | "NO_ENCAJA" | "SIN_EVALUAR";
};

export function resumirEncaje(e: Encaje, restriccionesOrg: string[]): ResumenEncaje {
  const evaluado =
    e.tipos.length > 0 || e.brecha !== null || e.perfil !== null || Object.keys(e.restricciones).length > 0;
  if (!evaluado) return { evaluado, puntaje: 0, rompeRestriccion: false, veredicto: "SIN_EVALUAR" };

  const rompeRestriccion = restriccionesOrg.some((r) => e.restricciones[r] === false);
  const partes = [e.tipos.length > 0, e.brecha === true, e.perfil === true];
  const restOk = restriccionesOrg.length === 0 || restriccionesOrg.every((r) => e.restricciones[r] === true);
  partes.push(restOk);
  const puntaje = Math.round((partes.filter(Boolean).length / partes.length) * 100);

  const veredicto = rompeRestriccion ? "NO_ENCAJA" : puntaje === 100 ? "ENCAJA" : puntaje >= 50 ? "PARCIAL" : "NO_ENCAJA";
  return { evaluado, puntaje, rompeRestriccion, veredicto };
}

export const VEREDICTO_META: Record<ResumenEncaje["veredicto"], { label: string; color: string }> = {
  ENCAJA: { label: "Encaja con la estrategia", color: "#6FBFB2" },
  PARCIAL: { label: "Encaje parcial", color: "#C9A227" },
  NO_ENCAJA: { label: "No encaja", color: "#B23A3A" },
  SIN_EVALUAR: { label: "Sin evaluar", color: "#5e7370" },
};
