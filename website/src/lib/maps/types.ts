export type MapKey = 'domain' | 'ecosystem' | 'cognition';
export type DocumentRef = { id: string; anchor?: string; label?: string };
export type MapRelation = { map: MapKey; node: string; label: string };
export type MapNode = {
  id: string;
  title: string;
  summary: string;
  detail: string;
  boundary?: string;
  documents: DocumentRef[];
  sources: string[];
  children?: MapNode[];
  relations?: MapRelation[];
};
export type MapDefinition = {
  id: MapKey;
  title: string;
  indexId: string;
  number: string;
  layout?: 'directed';
  question: string;
  description: string;
  branches: MapNode[];
  auxiliary: DocumentRef[];
  connections?: { from: string; to: string; label: string }[];
};
export type ResolvedLink = { title: string; href: string };
export type MapLinks = Record<string, ResolvedLink>;
export type MapState = { expanded: string[]; selected: string | null };
