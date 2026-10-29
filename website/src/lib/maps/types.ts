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
  category?: '贡献' | '交接' | '资源与成本' | '证据与修订' | '认识视角' | '检验方法' | '反馈修订';
};
export type EvidenceRecord = { title: string; date: string; source: string; locator: string; text: string };
export type TeamProfile = {
  series: string; release: string; official: { title: string; href: string }[];
  reusable: string; dependencies: string; limits: string; missingEvidence: string;
};
export type LegacyCollection = { id: string; title: string; summary: string; members: string[]; documents: DocumentRef[]; sources: string[] };
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
  records?: EvidenceRecord[];
  teamProfile?: TeamProfile;
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
  connections?: (Pick<ConceptRelation, 'from' | 'to' | 'label'> & Partial<ConceptRelation>)[];
  learningPath?: string[];
  conceptRelations?: ConceptRelation[];
  legacyCollections?: LegacyCollection[];
};
export type ResolvedLink = { title: string; href: string };
export type MapLinks = Record<string, ResolvedLink>;
export type MapState = { expanded: string[]; selected: string | null };
