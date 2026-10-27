import fs from "node:fs"; import path from "node:path";
export type Row = Record<string, any> & { id: string };
export interface Store {
  get(c: string, id: string): Promise<Row | null>;
  set(c: string, id: string, d: Record<string, any>): Promise<void>;
  del(c: string, id: string): Promise<void>;
  list(c: string): Promise<Row[]>;
}
/** Local store: in memory, saved to a JSON file so demo data survives restarts. */
export class MemoryStore implements Store {
  private db: Record<string, Record<string, any>> = {};
  constructor(private file?: string) { if (file && fs.existsSync(file)) this.db = JSON.parse(fs.readFileSync(file, "utf8")); }
  private save() { if (!this.file) return; fs.mkdirSync(path.dirname(this.file), { recursive: true }); fs.writeFileSync(this.file, JSON.stringify(this.db)); }
  async get(c: string, id: string) { const d = this.db[c]?.[id]; return d ? ({ ...structuredClone(d), id } as Row) : null; }
  async set(c: string, id: string, d: Record<string, any>) { (this.db[c] ||= {})[id] = structuredClone({ ...d, id: undefined }); this.save(); }
  async del(c: string, id: string) { delete this.db[c]?.[id]; this.save(); }
  async list(c: string) { return Object.entries(this.db[c] || {}).map(([id, d]) => ({ ...structuredClone(d), id }) as Row); }
}
