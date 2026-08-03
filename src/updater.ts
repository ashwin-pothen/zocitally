import { normalizeDOI } from "./utils/doi";
import { OpenAlexClient, OpenAlexError } from "./openalex";
import { CitationStorage } from "./storage";
import type { EligibleItem, UpdateSummary } from "./types";
import { BatchProgress, createCancellationToken, emptySummary } from "./progress";
import { getAPIKey, getMaxConcurrency } from "./preferences-values";
import { redactAPIKey, shortErrorCode } from "./utils/logging";

const sleep = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds));

export interface UpdateOptions {
  showProgress?: boolean;
  concurrency?: number;
}

// Slightly above the transport's own request timeout, so a single
// already-in-flight request has time to finish or time out on its own.
const SHUTDOWN_MAX_WAIT_MS = 35_000;

export class CitationUpdater {
  private shuttingDown = false;
  private activeTokens = new Set<ReturnType<typeof createCancellationToken>>();
  private inFlight = new Set<Promise<UpdateSummary>>();

  constructor(
    private readonly storage: CitationStorage,
    private readonly transportFactory: () => (url: string) => Promise<import("./types").HttpResponse>,
  ) {}

  update(items: EligibleItem[], options: UpdateOptions = {}): Promise<UpdateSummary> {
    const run = this.run(items, options);
    this.inFlight.add(run);
    const forget = () => this.inFlight.delete(run);
    run.then(forget, forget);
    return run;
  }

  private async run(items: EligibleItem[], options: UpdateOptions): Promise<UpdateSummary> {
    const summary = emptySummary(items.length);
    if (items.length === 0 || this.shuttingDown) return summary;
    const token = createCancellationToken();
    this.activeTokens.add(token);
    const progress = options.showProgress === false ? null : new BatchProgress(token, items.length);
    const apiKey = getAPIKey();
    const clientOptions: ConstructorParameters<typeof OpenAlexClient>[0] = {
      transport: this.transportFactory(),
    };
    if (apiKey) clientOptions.apiKey = apiKey;
    const client = new OpenAlexClient(clientOptions);
    let nextIndex = 0;
    const concurrency = Math.max(1, Math.min(5, options.concurrency ?? getMaxConcurrency()));

    const worker = async (): Promise<void> => {
      while (!token.cancelled && !this.shuttingDown) {
        const index = nextIndex++;
        const item = items[index];
        if (!item) break;
        await this.processItem(item, client, summary, apiKey, () => token.cancelled || this.shuttingDown);
        summary.completed += 1;
        progress?.update(summary);
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
      summary.cancelled = token.cancelled || this.shuttingDown;
      Zotero.ItemTreeManager.refreshColumns();
      progress?.finish(summary);
      if (summary.authenticationError) {
        Services.prompt.alert(
          Zotero.getMainWindow(),
          "Zocitally",
          "OpenAlex rejected the configured API key. Check or remove it in the plugin settings.",
        );
      }
      return summary;
    } finally {
      this.activeTokens.delete(token);
    }
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    for (const token of this.activeTokens) token.cancel();
    // Cancelling stops retries and the next queued item, but the request
    // already in flight still needs to settle so storage.close() never
    // races its write. Bound the wait so a stuck request can't hang quit.
    await Promise.race([Promise.allSettled([...this.inFlight]), sleep(SHUTDOWN_MAX_WAIT_MS)]);
  }

  private async processItem(
    item: EligibleItem,
    client: OpenAlexClient,
    summary: UpdateSummary,
    apiKey: string,
    isCancelled: () => boolean,
  ): Promise<void> {
    const identity = { libraryID: item.libraryID, itemKey: item.key };
    const doi = normalizeDOI(item.getField("DOI"));
    if (!doi) {
      await this.storage.saveTerminalStatus(identity, null, "missing-doi");
      summary.missingDOI += 1;
      return;
    }

    try {
      const result = await client.getCitationCount(doi, isCancelled);
      if (result.kind === "not-found") {
        await this.storage.saveTerminalStatus(identity, doi, "not-found");
        summary.notFound += 1;
        return;
      }
      await this.storage.saveSuccess(identity, doi, result.openAlexWorkID, result.count);
      summary.success += 1;
    } catch (error) {
      const code = error instanceof OpenAlexError ? error.code : shortErrorCode(error);
      await this.storage.saveError(identity, doi, code);
      if (code === "authentication") summary.authenticationError = true;
      summary.failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      Zotero.debug(`[Zocitally] ${redactAPIKey(message, apiKey)}`, 2);
    }
  }
}
