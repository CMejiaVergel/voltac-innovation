import type { AssumptionStatus } from "@/lib/enums";

export type OrigenVista = {
  id: string;
  ideaId: string | null;
  textSnapshot: string;
  insightId: string;
  /** La idea de la que salio ya no esta en Combinar. */
  huerfano: boolean;
};

/** Un fragmento del mapa que sostiene el concepto en una dimension. */
export type AnclaVista = {
  id: string;
  rowId: string;
  text: string;
  /** El fragmento ya no esta aceptado y visible en el mapa. */
  huerfano: boolean;
};

/** Una dimension del mapa, en el orden de la plantilla del proyecto. */
export type DimensionVista = { id: string; name: string; color: string };

export type SupuestoVista = {
  id: string;
  text: string;
  likelihood: number;
  status: AssumptionStatus;
  note: string;
  /** Ya tiene una pregunta en el banco. */
  questionId: string | null;
};

export type ConceptoVista = {
  id: string;
  title: string;
  statement: string;
  description: string;
  color: string;
  impDemanda: number;
  impImplementar: number;
  impEscalar: number;
  fitProblema: number;
  fitEquipo: number;
  fitMetas: number;
  reviewState: "ACCEPTED" | "PROPOSED" | "REJECTED";
  origin: "HUMAN" | "AGENT";
  hidden: boolean;
  position: number;
  origenes: OrigenVista[];
  supuestos: SupuestoVista[];
  anclas: AnclaVista[];
};

/** Una idea de Combinar, disponible para construir conceptos. */
export type IdeaDisponible = {
  id: string;
  text: string;
  insightId: string;
  /** Numero del insight en el tablero de Combinar, 1..n. */
  insightNumero: number;
  insightColor: string;
  /** Ya la usa algun concepto. */
  usada: boolean;
};

export type ConvergirProps = {
  slug: string;
  conceptos: ConceptoVista[];
  ideas: IdeaDisponible[];
  dimensiones: DimensionVista[];
  editable: boolean;
};
