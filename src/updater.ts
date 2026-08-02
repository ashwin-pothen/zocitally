import { normalizeDOI } from "./utils/doi";
import { OpenAlexClient, OpenAlexError } from "./openalex";
import { CitationStorage } from "./storage";
import type { EligibleItem, UpdateSummary } from "./types";
import { BatchProgress, createCancellationToken, emptySummary } from "./progress";
import { getAPIKey, getMaxConcurrency } from "./preferences-values";
import { redactAPIKey, shortErrorCode } from "./utils/logging";

export interface UpdateOptions {
  showProgress?: boolean;
  concurrency?: number;
}

export class CitationUpdater {
  private shuttingDown = false;
  private activeTokens = new Set<ReturnType<typeof createCancellationToken>>();

  constructor(
    private readonly storage: CitationStorage,
    private readonly transportFactory: () => (url: string) => Promise<import("./types").HttpResponse>,
  ) {}

  async update(items: EligibleItem[], options: UpdateOptions = {}): Promise<UpdateSummary> {
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
        await this.processItem(item, client, summary, apiKey);
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

  shutdown(): void {
    this.shuttingDown = true;
    for (const token of this.activeTokens) token.cancel();
  }

  private async processItem(
    item: EligibleItem,
    client: OpenAlexClient,
    summary: UpdateSummary,
    apiKey: string,
  ): Promise<void> {
    const identity = { libraryID: item.libraryID, itemKey: item.key };
    const doi = normalizeDOI(item.getField("DOI"));
    if (!doi) {
      await this.storage.saveTerminalStatus(identity, null, "missing-doi");
      summary.missingDOI += 1;
      return;
    }

    try {
      const result = await client.getCitationCount(doi);
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
