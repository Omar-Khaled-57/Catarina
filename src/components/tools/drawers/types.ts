/**
 * Drawers demo types — the chest = a section, a pull-out drawer = a project,
 * an envelope = a sub-drawer, items = files. Shared across the 3D chest, the
 * focus-mode directory browser, and the demo data.
 */

export interface DirItem {
  id: string;
  type: "CODE" | "IMAGE" | "FILE" | "LINK" | "NOTE" | "VIDEO";
  name: string;
  content?: string;
}

export interface EnvelopeData {
  id: string;
  name: string;
  items?: DirItem[];
}

export interface DemoProject {
  id: string;
  name: string;
  envelopes: EnvelopeData[];
  items?: DirItem[];
}

export interface DemoSection {
  key: string;
  label: string;
  color: string;
  projects: DemoProject[];
}