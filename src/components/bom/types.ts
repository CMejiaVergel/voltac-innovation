import type { TemplateShape } from "@/lib/templates";
import type { ReviewState, Verification } from "@/lib/enums";

export type BoardFragment = {
  id: string;
  rowId: string;
  colId: string;
  text: string;
  position: number;
  verification: Verification;
  reviewState: ReviewState;
  origin: "HUMAN" | "AGENT";
  hidden: boolean;
  sourceUrl: string | null;
  sourceCitation: string | null;
  agentRationale: string | null;
  authorName: string | null;
  updatedAt: string;
};

export type BoardProps = {
  mapId: string;
  slug: string;
  shape: TemplateShape;
  fragments: BoardFragment[];
  editable: boolean;
};
