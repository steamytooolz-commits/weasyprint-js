// Shared CSS types — element refs used across cascade + layout.
export interface ElementRef {
  uid: number;
  tag: string;
  id: string | null;
  classes: string[];
  attrs: Record<string, string>;
  parentUid: number | null;
  /** Raw `style=""` attribute (applied last, specificity [1,0,0]). */
  inlineStyle?: string;
}

export interface CascadeEntry {
  value: string;
  important: boolean;
  specificity: [number, number, number];
  order: number;
}

export interface PageRule {
  name: string;
  pseudo: string | null;
  declarations: Record<string, string>;
  /** @top-center / @bottom-right / … margin-box declarations. */
  marginBoxes?: Record<string, Record<string, string>>;
}

export interface FontFaceRule {
  declarations: Record<string, string>;
}
