import {
  mkdir,
  readFile,
  open,
  rename,
  readdir,
  unlink,
} from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: string;
}
interface State {
  notes: Record<string, Note[]>;
  receipts: Record<string, { subjectHash: string; completedAt: string }>;
}

// One writer process per directory. Replace this adapter with your database for multi-instance hosting.
export class DataStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private directory: string,
    private appId = "",
  ) {}
  private async state(): Promise<State> {
    try {
      return JSON.parse(
        await readFile(join(this.directory, "data.json"), "utf8"),
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { notes: {}, receipts: {} };
      throw error;
    }
  }
  private transact<T>(task: (state: State) => T | Promise<T>): Promise<T> {
    const operation = this.queue.then(async () => {
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      // Interrupted writes must not leave a second copy of erased data behind.
      for (const name of await readdir(this.directory)) {
        if (/^[a-f0-9-]{36}\.tmp$/.test(name))
          await unlink(join(this.directory, name));
      }
      const state = await this.state();
      for (const [id, receipt] of Object.entries(state.receipts)) {
        if (Date.parse(receipt.completedAt) < Date.now() - 30 * 86400000)
          delete state.receipts[id];
      }
      const result = await task(state);
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const temporary = join(this.directory, randomUUID() + ".tmp");
      try {
        const file = await open(temporary, "wx", 0o600);
        try {
          await file.writeFile(JSON.stringify(state));
          await file.sync();
        } finally {
          await file.close();
        }
        await rename(temporary, join(this.directory, "data.json"));
      } finally {
        await unlink(temporary).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
      }
      const directory = await open(this.directory, "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
      return result;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
  async check() {
    await this.transact(() => undefined);
    return {storage: "ready", capabilities: ["export", "erase"]};
  }
  async notes(subject: string): Promise<Note[]> {
    await this.queue;
    return (await this.state()).notes[this.key(subject)] || [];
  }
  add(subject: string, note: Note, authorize: () => Promise<unknown>) {
    return this.transact(async (state) => {
      await authorize();
      const key = this.key(subject);
      const notes = state.notes[key] || [];
      if (notes.length >= 100) throw new Error("Note limit reached.");
      state.notes[key] = [...notes, note];
    });
  }
  erase(subject: string, requestId: string) {
    return this.transact((state) => {
      const subjectHash = this.key(subject);
      const existing = state.receipts[requestId];
      if (existing && existing.subjectHash !== subjectHash)
        throw new Error("Receipt identity mismatch.");
      // Re-delivery of a completed request must not erase data from a later membership.
      if (existing)
        return {
          requestId,
          status: "completed",
          completedAt: existing.completedAt,
        };
      delete state.notes[subjectHash];
      const completedAt = new Date().toISOString();
      state.receipts[requestId] = { subjectHash, completedAt };
      return { requestId, status: "completed", completedAt };
    });
  }
  private key(subject: string) {
    return createHash("sha256")
      .update(this.appId + ":" + subject)
      .digest("hex");
  }
}
