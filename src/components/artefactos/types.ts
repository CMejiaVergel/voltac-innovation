import type {
  ArtifactKind,
  ArtifactStatus,
  AssumptionStatus,
  ClaimKind,
  FeedbackVerdict,
} from "@/lib/enums";

export type SupuestoVista = {
  id: string;
  text: string;
  likelihood: number;
  status: AssumptionStatus;
};

/** Un fragmento que puede sostener una cifra: sale de los insights del concepto. */
export type FragmentoCitable = { id: string; text: string };

export type ConceptoOpcion = {
  id: string;
  title: string;
  statement: string;
  /** Frase del Ejercicio 1.1 y propuesta de valor: alimentan los prompts de IA. */
  frase: string;
  propuestaValor: string;
  color: string;
  /** Numero de los insights de los que salen sus ideas: "Insight 1", "Insight 3". */
  insights: { numero: number; color: string }[];
  supuestos: SupuestoVista[];
  fragmentos: FragmentoCitable[];
};

export type CifraVista = {
  id: string;
  value: string;
  label: string;
  kind: ClaimKind;
  basis: string;
  fragmento: string | null;
};

export type ReaccionVista = {
  id: string;
  source: string;
  text: string;
  verdict: FeedbackVerdict | "";
  supuesto: string | null;
  fecha: string;
};

export type ArtefactoVista = {
  id: string;
  title: string;
  kind: ArtifactKind;
  promise: string;
  status: ArtifactStatus;
  /** Vuelta del ciclo hacer-probar-revisar-cambiar. */
  iteration: number;
  presentedTo: string;
  presentedAt: string | null;
  tieneDocumento: boolean;
  conceptId: string | null;
  expuestos: string[];
  cifras: CifraVista[];
  reacciones: ReaccionVista[];
};
