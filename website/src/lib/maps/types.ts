export type MapKey = 'domain' | 'ecosystem' | 'cognition';
export type DocumentRef = { id: string; anchor?: string; label?: string };
export type MapRelation = { map: MapKey; node: string; label: string };
export type TeachingBlock = { title: string; paragraphs?: string[]; steps?: string[]; table?: { headers: string[]; rows: string[][] }; formula?: string };
export type NodeLesson = {
  role: string; goal: string; explanation: string[];
  example: { input: string; steps: string[]; output: string; materials: string[] };
  confusions: string[]; check: { question: string; answer: string }; advanced?: TeachingBlock[];
};
export type TopicLesson = { question: string; overview: string[]; outcome: string; classification: string };
export type ConceptRelation = {
  from: string; to: string; label: string; description: string; sources: string[];
  core: boolean; direction: 'directed' | 'undirected'; basis: 'material' | 'editorial';
};
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
  type?: string;
  understanding?: '待自评' | '已初步理解' | '已经尝试' | '待深入学习';
  verification?: '待核实' | '已核实';
  lesson?: NodeLesson;
  topic?: TopicLesson;
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
  learningPath?: string[];
  conceptRelations?: ConceptRelation[];
};
export type ResolvedLink = { title: string; href: string };
export type MapLinks = Record<string, ResolvedLink>;
export type MapState = { expanded: string[]; selected: string | null };
