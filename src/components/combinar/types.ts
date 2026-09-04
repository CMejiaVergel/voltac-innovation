import type { DotRole } from "@/lib/enums";
import type { TemplateShape } from "@/lib/templates";

/** Un punto del mapa: un fragmento del BOM listo para conectarse. */
export type Punto = {
  id: string;
  rowId: string;
  colId: string;
  text: string;
  verification: "VERIFIED" | "TO_CONFIRM" | "ASSUMPTION";
};

export type DotVista = {
  id: string;
  fragmentId: string | null;
  textSnapshot: string;
  rowId: string;
  colId: string;
  role: DotRole;
  position: number;
  /** El fragmento del que salio fue borrado del mapa. */
  huerfano: boolean;
};

export type IdeaVista = { id: string; text: string; origin: "HUMAN" | "AGENT" };

export type InsightVista = {
  id: string;
  tag: string;
  statement: string;
  fact: string;
  counterpart: string;
  shift: string;
  offerWho: string;
  offerProof: string;
  payWho: string;
  payProof: string;
  business: string;
  limitNote: string;
  reviewState: "ACCEPTED" | "PROPOSED" | "REJECTED";
  origin: "HUMAN" | "AGENT";
  hidden: boolean;
  position: number;
  dots: DotVista[];
  ideas: IdeaVista[];
};

export type CombinarProps = {
  slug: string;
  shape: TemplateShape;
  puntos: Punto[];
  insights: InsightVista[];
  editable: boolean;
};
