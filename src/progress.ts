import type { CancellationToken, UpdateSummary } from "./types";

export class BatchProgress {
  private readonly window: InstanceType<ZoteroGlobalRuntime["ProgressWindow"]>;
  private itemProgress: {
    setText(text: string): void;
    setProgress(percent: number): void;
    setError(): void;
  } | null = null;
  private completed = false;

  constructor(private readonly token: CancellationToken, total: number) {
    this.window = new Zotero.ProgressWindow({ window: Zotero.getMainWindow(), closeOnClick: true });
    const originalClose = this.window.close.bind(this.window);
    this.window.close = () => {
      if (!this.completed) this.token.cancel();
      originalClose();
    };
    this.window.changeHeadline(`Updating Citations (0/${total})`);
    this.window.addDescription("Click this progress window to cancel. Running requests will finish safely.");
    this.window.show();
    this.itemProgress = new this.window.ItemProgress(null, summaryText(emptySummary(total)));
    this.itemProgress.setProgress(1);
  }

  update(summary: UpdateSummary): void {
    if (this.token.cancelled) return;
    this.window.changeHeadline(`Updating Citations (${summary.completed}/${summary.total})`);
    this.itemProgress?.setText(summaryText(summary));
    this.itemProgress?.setProgress(Math.max(1, Math.round(summary.completed / summary.total * 100)));
  }

  finish(summary: UpdateSummary): void {
    this.completed = true;
    this.window.changeHeadline(summary.cancelled ? "Citation update cancelled" : "Citation update complete");
    this.itemProgress?.setText(summaryText(summary));
    this.itemProgress?.setProgress(100);
    if (summary.failures > 0) this.itemProgress?.setError();
    this.window.startCloseTimer(7000);
  }
}

export function createCancellationToken(): CancellationToken {
  return {
    cancelled: false,
    cancel() {
      this.cancelled = true;
    },
  };
}

export function emptySummary(total: number): UpdateSummary {
  return {
    completed: 0,
    total,
    success: 0,
    missingDOI: 0,
    notFound: 0,
    failures: 0,
    cancelled: false,
    authenticationError: false,
  };
}

export function summaryText(summary: UpdateSummary): string {
  return [
    `${summary.completed}/${summary.total} completed`,
    `${summary.success} updated`,
    `${summary.missingDOI} without DOI`,
    `${summary.notFound} not found`,
    `${summary.failures} failed`,
  ].join(" · ");
}
