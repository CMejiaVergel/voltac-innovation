/**
 * Encaje de un desafío con la intención de innovar de su organización.
 *
 * Lo decide el equipo, no un cálculo: la intención de innovar existe para
 * «definir las razones y los límites de la innovación» (IMBOK p. 28) y el
 * equipo la usa para aceptar o descartar retos (mentor, 15-oct-2026). La lista
 * de preguntas solo ordena la conversación; el veredicto lo pone el equipo.
 * No hay porcentaje: el GIMI no puntúa el encaje de un reto, y una cifra
 * daría una precisión que no existe.
 */

export type Veredicto = "ENCAJA" | "PARCIAL" | "NO_ENCAJA";

export type Encaje = {
  /** Partes de la cadena de valor de la intención que toca el desafío. */
  tipos: string[];
  /** Por cada límite de la organización: ¿el desafío lo respeta? */
  restricciones: Record<string, boolean>;
  /** ¿Aporta a la brecha de crecimiento declarada? */
  brecha: boolean | null;
  /** ¿Cabe en el perfil de inversión? */
  perfil: boolean | null;
  /** El veredicto del equipo. Vacío = todavía no lo decidieron. */
  veredicto?: Veredicto | "";
  nota: string;
};

export const ENCAJE_VACIO: Encaje = { tipos: [], restricciones: {}, brecha: null, perfil: null, veredicto: "", nota: "" };

export type ResumenEncaje = {
  evaluado: boolean;
  /** Algún límite de la organización quedó marcado como incumplido. */
  rompeRestriccion: boolean;
  veredicto: Veredicto | "SIN_EVALUAR";
};

export function resumirEncaje(e: Encaje, restriccionesOrg: string[]): ResumenEncaje {
  const rompeRestriccion = restriccionesOrg.some((r) => e.restricciones[r] === false);
  if (!e.veredicto) return { evaluado: false, rompeRestriccion, veredicto: "SIN_EVALUAR" };
  return { evaluado: true, rompeRestriccion, veredicto: e.veredicto };
}

export const VEREDICTO_META: Record<ResumenEncaje["veredicto"], { label: string; color: string }> = {
  ENCAJA: { label: "Encaja con la intención", color: "#6FBFB2" },
  PARCIAL: { label: "Encaje parcial", color: "#C9A227" },
  NO_ENCAJA: { label: "No encaja", color: "#B23A3A" },
  SIN_EVALUAR: { label: "Sin evaluar", color: "#5e7370" },
};
