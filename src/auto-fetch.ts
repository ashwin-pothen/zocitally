import type { EligibleItem } from "./types";
import { CitationUpdater } from "./updater";

const SESSION_BUDGET = 20;
const MAX_QUEUE = 10;

export class ConservativeAutoFetcher {
  private readonly queue = new Map<string, EligibleItem>();
  private processed = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private stopped = false;

  constructor(private readonly updater: CitationUpdater) {}

  enqueue(item: EligibleItem): void {
    if (this.stopped || this.processed >= SESSION_BUDGET || this.queue.size >= MAX_QUEUE) return;
    this.queue.set(`${item.libraryID}:${item.key}`, item);
    if (!this.timer && !this.running) {
      this.timer = setTimeout(() => void this.flush(), 2000);
    }
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.queue.clear();
  }

  private async flush(): Promise<void> {
    this.timer = null;
    if (this.stopped || this.running) return;
    const remaining = SESSION_BUDGET - this.processed;
    const items = [...this.queue.values()].slice(0, Math.min(MAX_QUEUE, remaining));
    this.queue.clear();
    if (!items.length) return;
    this.running = true;
    try {
      await this.updater.update(items, { showProgress: false, concurrency: 1 });
      this.processed += items.length;
    } finally {
      this.running = false;
    }
  }
}
