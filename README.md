# Zocitally

**Zo(tero)-Ci(te)-Tally — Citation counts for Zotero**

Zocitally is a lightweight Zotero plugin that retrieves citation counts from OpenAlex and displays them in a sortable **Citations** column.

> **Citation counts come from [OpenAlex](https://openalex.org/), not Google Scholar.** OpenAlex indexes citations differently than Google Scholar, Scopus, or Web of Science, so the number you see here will rarely match those sources exactly. Treat it as a fast, free, roughly-accurate estimate for sorting and triage within your Zotero library, not an authoritative citation count for a CV or report.

Zocitally is an independent community plugin. It is not affiliated with or endorsed by Zotero or OpenAlex.

It deliberately does **not** use or scrape Google Scholar, calculate journal metrics, retrieve impact factors/quartiles/CiteScore/SJR/FWCI, create tags, write to Zotero's `Extra` field, or modify any bibliographic field.

## Compatibility

- Zotero desktop 9.x
- macOS and Windows (no platform-specific runtime dependencies)
- Local-only operation; no backend or external server beyond OpenAlex

## Installation

### 1. Download the XPI

Get the latest `zocitally-<version>.xpi` from the [Releases page](https://github.com/ashwin-pothen/zocitally/releases). Download the `.xpi` file attached to the latest release; do not download the source code archive.

If no release is published yet, or you want a development version, [build it locally](#development) with `pnpm run build`, which produces `build/zocitally-0.2.0.xpi`.

### 2. Install into Zotero

1. Open Zotero and choose **Tools → Add-ons** (Zotero 8: **Tools → Plugins**).
2. Click the gear icon in the top-right of the Add-ons window and choose **Install Add-on From File…**.
3. Select the downloaded `.xpi` file.
4. Restart Zotero if prompted.

### 3. Enable the Citations column

Right-click any column header in the item list (or use the column-selector chevron), and check **Citations** in the list. The column is hidden by default and, once enabled, can be resized, hidden, shown, and sorted like any of Zotero's built-in columns.

### Upgrading from an earlier development build

The add-on ID changed to `zocitally@ashwin-pothen`, so Zotero treats Zocitally as a separate add-on. Disable or uninstall the CiteSight or earlier development add-on before installing Zocitally to avoid duplicate columns or menu commands. Earlier builds preserve their cache when uninstalled.

On first startup, Zocitally copies user-set API key, automatic-fetch, refresh-interval, and concurrency preferences from the CiteSight preference branch, falling back to the earlier legacy branch, if no Zocitally value already exists. It opens the existing citation database in place, so cached counts are retained without a schema or file-copy migration. Legacy preferences are left untouched to make rollback safe. Earlier column layout keys are not reused, so you may need to enable the new **Citations** column once.

## OpenAlex API key

Singleton DOI lookups currently work without a key and are free according to the [OpenAlex authentication documentation](https://developers.openalex.org/api-reference/authentication). A free API key provides a larger daily allowance:

1. Create or sign in to an OpenAlex account.
2. Copy the key from [OpenAlex API settings](https://openalex.org/settings/api).
3. In Zotero, open **Settings → Zocitally** (or **Tools → Zocitally Settings**).
4. Paste the key and use **Test API Connection**.

The input is masked. The key is stored locally in Zotero preferences, is sent only to `api.openalex.org` as the documented `api_key` parameter, and is redacted by this plugin's logging utilities. Never commit a key to this repository.

## Using the plugin

- Select one or more bibliographic items and use the item context command **Update Citation Count**.
- Or use **Tools → Update Citations for Selected Items**.
- Click the progress notification while a batch is running to cancel. No new requests will be scheduled; already-running requests finish safely.

Attachments selected in the item list are resolved to their parent bibliographic item when possible. Notes, annotations, and child attachments are never queried directly.

### Column values

| Display | Meaning |
| --- | --- |
| blank | Citation data has never been fetched for the item |
| `0` | OpenAlex found the work and reports zero citations |
| positive integer | OpenAlex's current `cited_by_count` |
| `—` | The item was checked but has no usable DOI |
| `∅` | The DOI was not found in OpenAlex |
| `!` | The latest attempt failed and no prior valid count is available |

Hover over a value for the DOI, OpenAlex work ID, successful update time, staleness, or concise status/error. If a refresh fails for the same DOI, a previously valid count remains visible and the tooltip records the failed refresh.

Counts sort numerically. Internally the data provider uses a fixed-width numeric sort key while the custom cell renderer shows the unpadded integer, preserving the supported Zotero item-tree column contract.

### Citations Updated column

A second, also-hidden-by-default column, **Citations Updated**, shows when each item's count was last successfully fetched from OpenAlex (e.g. "3 days ago"), so you can tell at a glance which items are due for a refresh. It sorts chronologically, oldest/never-fetched first. Hovering shows the exact date and time, same as the Citations column tooltip.

When a cached value is older than your configured **Refresh interval** (see [Settings and cache](#settings-and-cache)), both the Citations and Citations Updated cells render in amber to flag it as stale at a glance, in addition to the "Cached value is stale" tooltip note.

## Settings and cache

- **Refresh interval:** never automatically, 7, 30 (default), or 90 days.
- **Maximum concurrent requests:** 1–5, default 3.
- **Automatically fetch visible uncached items:** off by default. When enabled, the implementation is intentionally conservative: one request at a time, at most 10 queued items, and a 20-item session budget.
- **Clear Cached Citation Data:** confirms the exact local record count, removes only plugin data, and refreshes the column.

Citation records are stored in `openalex-citation-count.sqlite` in the active Zotero data directory. This legacy-compatible filename is intentionally retained so existing cached counts remain available after the rename. The compound identity is Zotero library ID plus stable item key. The cache contains the normalized DOI, OpenAlex work ID, count/status, attempt and success timestamps, error code, and schema version. It is local to one computer and does not sync through Zotero.

Disabling, uninstalling, or upgrading the plugin does not silently delete this database. Use the settings button to remove cached data explicitly. If an item's DOI changes, its old count is invalidated until the new DOI is fetched.

## Privacy

The plugin has no telemetry or analytics and collects no user data. It sends only normalized DOI lookup requests (and the optional API key) to OpenAlex. It does not send titles, authors, notes, attachments, library contents, or personally identifying information. It never changes Zotero item metadata.

## Rate limiting and errors

Requests use bounded concurrency. HTTP 429 honors `Retry-After` when present and otherwise uses exponential backoff. Network failures and 5xx responses have a limited retry count. Authentication errors, not-found responses, and malformed responses are distinct. A batch reports totals for updated, missing DOI, not found, and failed items without showing one alert per paper.

## Known limitations

- Version 1 matches by DOI only; it does not guess a DOI or match by title.
- Citation data is local-only and does not sync between Zotero installations.
- Automatic refresh is conservative; manual update remains the primary workflow.
- Citation coverage and update timing vary by source; see the note at the top of this README on OpenAlex vs. Google Scholar.
- The automated suite cannot verify Zotero's rendered desktop UI. See the manual checklist below.

## Troubleshooting

- **Blank column:** enable the column and run a manual update. A blank means never fetched.
- **Dash instead of a count:** verify that the Zotero DOI field contains a valid DOI.
- **Empty-set symbol:** OpenAlex returned 404 for the normalized DOI.
- **Authentication warning:** test the key in settings, correct it, or remove it to use anonymous singleton lookups.
- **Offline or server error:** the last valid count is preserved; retry later.
- **Column/menu duplication after development reload:** disable and re-enable once and inspect Zotero's debug output. The plugin explicitly unregisters each registered component on shutdown.

Useful technical messages are prefixed `[Zocitally]` in Zotero debug output. API keys are redacted by plugin logging.

## Development

Requirements: Node.js 20+ and pnpm 11.

```sh
pnpm install
pnpm run build:dev
pnpm run lint
pnpm run typecheck
pnpm test
pnpm run build
```

`pnpm run build` creates a production XPI at:

```text
build/zocitally-0.2.0.xpi
```

The archive contains only runtime JavaScript, manifest/default preferences, preference UI assets, and locale data. It excludes TypeScript, tests, source maps, dependencies, and secrets.

For iterative development, run `pnpm run build:dev`, then create a text file named `zocitally@ashwin-pothen` in the disposable Zotero development profile's `extensions` directory. Put the absolute path to `build/runtime` in that file. Start Zotero with a separate profile and data directory; never point development builds at a normal library. Rebuild and disable/re-enable the add-on to reload.

The repository and package name is `zotero-zocitally`.

The implementation follows Zotero's official [plugin development documentation](https://www.zotero.org/support/dev/client_coding/plugin_development), [Zotero 7+ development guidance](https://www.zotero.org/support/dev/zotero_7_for_developers), supported [Zotero 8 custom-menu API](https://www.zotero.org/support/dev/zotero_8_for_developers), and OpenAlex's [single-work DOI endpoint](https://developers.openalex.org/api-reference/works/get-a-single-work).

## Manual Zotero 9 test checklist

- [ ] Fresh installation from the production XPI in a disposable Zotero 9 profile
- [ ] Preference pane appears, inputs persist, and API-key field is masked
- [ ] API-key test succeeds with a valid key and fails clearly with a bad key
- [ ] One selected DOI-bearing item retrieves and displays a count
- [ ] Multiple selected items update with correct progress totals
- [ ] Item without a DOI displays `—`
- [ ] A known valid zero-citation work displays `0`, not blank
- [ ] An unknown DOI displays `∅`
- [ ] Clicking the progress notification cancels new work safely
- [ ] Counts and statuses persist after Zotero restart
- [ ] Disable and re-enable creates no duplicate column, menus, or observer behavior
- [ ] Numeric sort order is `0, 2, 9, 10, 100` (not lexicographic)
- [ ] Tooltips show count, successful update time, DOI, work ID, and status
- [ ] Citations Updated column shows a relative age and sorts oldest-first
- [ ] Citations and Citations Updated cells turn amber once older than the refresh interval
- [ ] Clearing cache confirms the count, clears the column, and leaves items unchanged
- [ ] Offline refresh preserves an existing valid count and reports one concise failure summary
- [ ] DOI change immediately invalidates the old association

## Development credit

Built with assistance from Claude. Zocitally is an independent community project and is not affiliated with or endorsed by Anthropic, Zotero, or OpenAlex.

## License and attribution

MIT licensed. Citation data is provided by [OpenAlex](https://openalex.org/), an open catalog of scholarly works from OurResearch.
