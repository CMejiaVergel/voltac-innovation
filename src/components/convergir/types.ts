import type { AssumptionKind, AssumptionStatus } from "@/lib/enums";
import type { TipoConcepto } from "@/lib/gimi";

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
  /** CONDICION: tiene que llegar a existir. PRECEDENTE: ya dado por sentado. */
  kind: AssumptionKind;
  /** Detonante del Taller 3, o vacio. */
  trigger: string;
  /** Una de las tres menos probables. */
  critical: boolean;
  failFastTest: string;
  expectedResult: string;
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
  /** Ejercicio 1.1: piezas de la frase «Conecte los puntos». */
  fraseOferta: string;
  fraseMercado: string;
  fraseNecesidad: string;
  fraseEntrega: string;
  fraseProduccion: string;
  fraseModelo: string;
  propuestaValor: string;
  /** Vinetas del lienzo por dimension del mapa. */
  lienzo: Record<string, string[]>;
  /** Segun la columna de los fragmentos anclados: dentro o fuera del negocio base. */
  tipo: TipoConcepto | null;
  atrMercado: number;
  atrOpciones: number;
  atrRecompensa: number;
  fitViabilidad: number;
  fitEstrategia: number;
  fitPasion: number;
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
