import type { PluginPublicAPI } from "./types";

interface PreferenceWindow extends Window {
  ZocitallyPreferences?: typeof ZocitallyPreferences;
}

function pluginAPI(): PluginPublicAPI {
  const api = Zotero.Zocitally;
  if (!api) throw new Error("Zocitally is not initialized");
  return api;
}

export const ZocitallyPreferences = {
  init(): void {
    const account = document.getElementById("zocitally-open-account");
    const test = document.getElementById("zocitally-test-api");
    const clear = document.getElementById("zocitally-clear-cache");
    account?.addEventListener("command", () => Zotero.launchURL("https://openalex.org/settings/api"));
    test?.addEventListener("command", () => void this.testConnection());
    clear?.addEventListener("command", () => void this.clearCache());
  },

  async testConnection(): Promise<void> {
    await this.runWithStatus("Testing OpenAlex authentication…", () => pluginAPI().testAPIConnection());
  },

  async clearCache(): Promise<void> {
    await this.runWithStatus("Checking local cache…", () => pluginAPI().clearCacheFromPreferences());
  },

  async runWithStatus(initial: string, action: () => Promise<string>): Promise<void> {
    const status = document.getElementById("zocitally-pref-status");
    if (status) status.textContent = initial;
    try {
      const message = await action();
      if (status) status.textContent = message;
    } catch (error) {
      if (status) status.textContent = error instanceof Error ? error.message : String(error);
    }
  },
};

(window as PreferenceWindow).ZocitallyPreferences = ZocitallyPreferences;
