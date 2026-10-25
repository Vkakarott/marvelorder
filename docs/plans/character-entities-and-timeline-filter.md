# Navigable characters and timeline filtering

## Status and scope

Architecture proposal based on the 2026-10-25 checkout. No data migration or
fictional-universe equivalence is authorized by this document. Rendering must
keep working from checked-in snapshots without a live service, as required by
[ADR-001](../decisions/001-scale-to-zero-data-automation.md).

## Current architecture

| Area | Code evidence | Implication |
| --- | --- | --- |
| Title identity | `src/helpers/listing-identity.ts` produces `movie:<id>` or `tv:<id>` from TMDB IDs. Markdown retains title metadata and `TMDB Data`. | Names and slugs must not serve as title keys. |
| Character data | `src/json/characters.json` v1 stores `titles[identity].{fetchedAt, characters: string[]}`; `PageContent.astro` reads it by title identity. | There is no character ID, incarnation, credit ID, image, or per-name provenance. Array position is display order. |
| Character collection | `scripts/pull-characters.ts` reads the existing TMDB cast pages. `character-credits-page.ts` parses role, performer, and TV episode count. `characters.ts` sorts, filters generic roles, deduplicates slash-separated aliases, and merges with the previous snapshot. | Performer names only help reject `Self`; they are not character IDs. Episode counts and credit links are not persisted. `mergeCharacters` retains older names even if a new page omits them. |
| Timeline catalog | `src/pages/index.astro` prerenders `getHomepageListings()` and hydrates `listing-row.vue`. `homepage-listings.ts` can create several season cards for one `tv:<id>`. `FilteredListings` applies defaults and sort. | Filtering must join against the actual homepage catalog. A series credit does not prove appearance in each season. |
| URL and state | `listing-row.vue` reads `?view=...` and persists category, sort, expanded card, and `scrollLeft` under `cinearc:timeline-state:v1`. `index.astro` restores scroll before hydration; `BackLink.astro` uses local browser history. | Shared filter URLs must override local state. Unfiltered scroll must not be restored into filtered results. |
| Routes | Home is `/`; details are Markdown under `src/pages/pt-br/*.md` using `MainLayout.astro`. Cards use `listing.endpoint`. | `/?personagem=<id>` can be the first navigation route without a new server endpoint. |

Current snapshot measurements: 238 title identities, 235 with names, 10,317
name occurrences, and 7,920 distinct names after simple normalization. There
are 1,110 normalized names in more than one title. These are repeated strings,
**not** 1,110 proven identities. The homepage has 220 cards for 197 distinct
title identities; 205 cards / 183 identities have names in the snapshot.
`tv:888` has 138 names. These measurements are diagnostic, not invariants.

### Concrete identity traps

- `tv:888` includes `Peter Parker / Spider-Man`, `Young Peter Parker`, and
  `Old Peter Parker / Old Spider-Man`. The strings do not establish whether
  these are one individual, separate versions, or portrayals at different ages.
- `movie:324857` includes `Miles Morales`, `Peter Parker`, and
  `Spider-Man Noir`; `movie:569094` also includes `Miles G. Morales` and
  several Spider-Man names. Merging on the alias `Spider-Man` would corrupt
  identity.
- `Kingpin`, `Green Goblin`, and `Spider-Man` can appear without enough
  context. `Bartender` occurs in 24 snapshot credits: identical text also
  does not prove a shared entity.
- `isSameCharacter()` merges roles **within one title** when any slash alias
  matches. This presentation deduplication rule is unsuitable for global
  identity resolution.

## Incremental data model

Keep `characters.json` v1 as display source and fallback. Add a small,
versioned identity overlay with three separate concepts:

1. **Canonical character:** opaque, immutable `characterId` for an evidenced
   fictional identity. Names and aliases are search/display attributes, never
   keys. Each alias has scope and evidence. `Peter Parker` does not include
   `Miles Morales` because both can be called Spider-Man.
2. **Incarnation/version:** opaque `versionId` with a parent `characterId`.
   Start title-scoped when continuity is unknown. Reusing a version across
   titles requires independent evidence; brand, performer, title, and year
   are insufficient. Universe/continuity may remain `null`.
3. **Title participation:** opaque `participationId` connecting a
   `movie:<id>`/`tv:<id>` to a raw observed role, display order, provenance,
   and optional canonical/version IDs. A `tv:888` participation is series-wide
   unless season or episode evidence exists separately.

Illustrative schema for a reviewed link; these IDs are **examples**, not IDs
already assigned to published records:

```json
{
  "version": 1,
  "characters": {
    "ch_opaque1": { "displayName": "Peter Parker", "aliases": [] }
  },
  "versions": {
    "ver_opaque1": {
      "characterId": "ch_opaque1",
      "scopeTitle": "tv:888",
      "continuity": null
    }
  },
  "participations": {
    "part_opaque1": {
      "titleId": "tv:888",
      "rawName": "Peter Parker / Spider-Man",
      "displayOrder": 0,
      "characterId": "ch_opaque1",
      "versionId": "ver_opaque1",
      "source": {
        "kind": "tmdb_cast_page",
        "url": "https://www.themoviedb.org/tv/888/cast",
        "observedAt": "YYYY-MM-DD"
      },
      "scope": "series"
    }
  }
}
```

An item imported **only** from v1 must use
`kind: "legacy_character_snapshot"`, the title's `fetchedAt`, and
`sourceCreditId: null`. Do not retroactively claim that every such string is a
currently verified upstream credit. Future syncs can store raw role, URL,
observation date, and upstream credit identifier **if present**. Such an
identifier belongs to a cast credit, not the fictional character. Do not use
performer identity as a key or add a runtime data source. Preserve v1 display
order until a replacement position is proven.

Assign all three ID types once in a checked-in file. Do not derive them from
slug, spelling, position, performer, or name hash. `titleId + normalized
rawName` may suggest a match across syncs, but a rename or collision must
leave the association unresolved rather than reassign an ID. Keep an explicit
redirect ledger for reviewed merges/corrections; never reuse an old ID.

The overlay can start with a few evidenced links instead of migrating all
10,317 occurrences. Unlinked names remain visible in their existing order in
`PageContent.astro`. Validate foreign keys, duplicate participations, and
ambiguous links. Automated sync may add high-confidence observations but must
not infer fictional equivalence from strings. Suppress uncertain links from
the public index under ADR-001; do not create a mandatory review queue.

## Navigation and filtering

1. At build time derive a compact reverse index from verified participations:
   `characterId/versionId -> Set<titleId>`. Intersect it with the actual
   `getHomepageListings()` catalog. Do not fetch TMDB during rendering, send
   all 10,317 names to the browser, or change title collection.
2. Link a detail-page name only when it has verified identity and at least one
   corresponding timeline title. Example: `/pt-br/spider-man-888/` links to
   `/?personagem=ch_opaque1`. Other names remain readable plain text; do not
   manufacture global matches from a shared label. A later character landing
   page can keep the same ID.
3. Make URL state authoritative. Accept repeated values such as
   `/?personagem=ch_1&personagem=ch_2`, with validation, deduplication, and a
   bounded selection count. Unknown IDs show an explicit empty/invalid state
   rather than the full timeline. Existing `view` categories compose with
   character selection; a visible control clears it. Recommended initial
   multi-select semantics: union (**any selected character**), with optional
   explicit intersection later. A `ver_...` value in the same parameter
   restricts to that incarnation, without automatic widening.
4. In `listing-row.vue`, intersect indexed title IDs with already filtered
   listings and retain current sort. Update URL on filter changes, listen to
   `popstate`, and keep links shareable. With no `personagem` query, preserve
   current behavior exactly. With the query, ignore the old unfiltered scroll
   offset and either key saved position by filter signature or start at the
   first result. Guard the pre-hydration script in `index.astro` too.
5. Use removable chips with accessible names, a labelled filter group,
   visible focus, a clear control, and announced counts. Count **distinct
   title IDs**, not season cards; label card counts separately if displayed.
   Empty states distinguish no verified participation, no homepage title, and
   a `view` intersection with no result. Never silently show all titles for
   an empty match.

Series participations currently apply to a show, not a season. The timeline
can hold several season cards for one `tv:<id>` (for example, `tv:84958`).
Recommended character-filter presentation: one result for the show, anchored
to an existing card and labelled **series**, without claiming an appearance
in each season. The unfiltered homepage remains unchanged. The anchor
position needs a product decision before implementation.

## Delivery stages

| Stage | Bounded change | Gate before advancing |
| --- | --- | --- |
| 0. Baseline | Pin fixtures for `tv:888`, a multiverse movie, a homonym, and a series with several season cards. Record current counts. | Existing tests/build pass; no UI/data changes. |
| 1. Registry | Add types, schema validation, opaque IDs, and a versioned overlay with a few evidenced links. Keep v1 untouched. | No broken references, duplicate participation IDs, or automatic alias merges; v1 renders identically. |
| 2. Provenance | Extend existing sync to record per-credit observations in a separate auditable artifact. Retain last-known-good data on fetch/parser failure and bound each run's changes. | Movie/TV HTML fixtures, source outage, and rename tests; v1 display/order do not regress. |
| 3. Index | Generate a static reverse index of trusted links and intersect it with the consolidated homepage catalog. | Correct title IDs, no extra documents/drafts or season-level claims, measured hydration size. |
| 4. Filter | Add URL parsing, `view`/sort composition, counts, empty states, history, and isolated scroll restoration. | Links survive reload/back/forward; without query the existing timeline and scroll behavior are unchanged. |
| 5. Links | Enable navigation for resolved detail-page names and grow evidence-backed coverage without a required review queue. | `tv:888` retains all 138 names and order; only verified links navigate; uncertain names stay readable. |

Stages 1–5 are proposals, not started work. Each should be a small reversible
commit. Do not replace v1 until display parity, coverage, and recovery have
been demonstrated in production.

## Future acceptance tests

- Identity: reviewed equivalent labels converge on one ID; `Spider-Man` alone
  does not merge Peter, Miles, or Miguel. `Kingpin` and repeated generic roles
  stay unresolved without evidence. IDs survive renames; redirects cannot
  cycle.
- Integrity: participations reference valid titles; versions reference the
  correct canonical character; source/date fields validate; positions retain
  existing arrays. Failed syncs keep the last published artifact.
- Filter: one character, two characters, a version, `view=movies` and
  `view=series`, duplicate/unknown IDs, and empty states. Count distinct
  titles despite season cards and retain timeline order.
- Navigation: click a name on `tv:888`, reload, share the URL, navigate back
  and forward, clear filter, enter detail and return. With no query, compare
  cards, category, sort, and scroll restoration with current behavior.
- Scale: test thousands of participations; measure index/filter cost; avoid
  browser/build-time credit fetches and unnecessary hydration payload.

## Risks and open decisions

| Topic | Risk | Recommendation / decision needed |
| --- | --- | --- |
| Equivalence | Aliases, costumes, and civilian names can refer to different people. | Require evidenced links. Decide who approves cross-title merges and whether an automatic rule can ever provide enough evidence. |
| Versions | Cast pages do not establish fictional continuity reliably. | Start title-scoped; define universe taxonomy before exposing it. |
| Series/seasons | `tv:<id>` does not prove appearance in every season. | Confirm one series result or another representation that does not attribute seasons. |
| Multiple selection | Union may be broad; intersection may surprise across universes. | Approve union as default and decide whether to offer an explicit “all” mode. |
| Unlinked names | Most of 10,317 strings will initially lack entities. | Keep plain text; decide whether a title-scoped credit page has value. |
| Homepage coverage | Some detail-page titles are outside the current 197 homepage IDs. | Link only if home has a result, or explain “no title in this timeline”; decide future catalog scope. |
| Mutable source | TMDB HTML and `mergeCharacters` can retain old roles or change spelling. | Track per-credit observations/confidence; uncertain changes must not rewrite IDs or the public index. |
| Shared state | `localStorage` may hide URL results or restore the wrong scroll offset. | URL takes precedence; decide whether sort belongs in URL for exact reproduction. |

The first implementation stage depends most on the equivalence policy across
versions, series/season representation, and handling of unresolved names.
Until then, v1 remains the display source.
