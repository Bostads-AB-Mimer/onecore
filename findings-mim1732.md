# MIM-1732 — Real-data findings (Agent B)

> Generated against `test_21_DB` on **2026-05-13**. Diagnostic ran in ~3.6s.
> Raw query outputs are stored under `services/property/prisma/diag-mim1732-output/*.json` (gitignored — not committed, but reproducible by running `pnpm exec ts-node prisma/diag-mim1732.ts` inside `services/property/`).

## TL;DR for Agent A

- **No duplicate `Ytskikt` by name** — the dev-seed row was already renamed to `Ytskikt fake`, so `getSurfaceModels`' name filter does not include it. Picker is not contaminated by the dev seed today.
- **Picker grain → subtypes**: 25 Ytskikt subtypes total, 2,564 models. Vägg averages ~160 models/subtype (max 956 on "Tapetsering"). Subtype-grain trivially fits in a Radix dropdown; model-grain is hostile.
- **One Ytskikt subtype has zero models**: `Sockel` (under Vägg). Render-time filter or hide-empty-subtypes is the safest fix. See §3.
- **`getSurfaceModels` is slow because of payload size, not SQL**: SQL `COUNT(*)` is 22ms; the actual Prisma findMany w/ 4-level nested include hydrating 2,564 rows is 521ms. See §5/§8 for the recommendation to add a `/component-subtypes/surface` endpoint and have the picker call that instead.
- **Sample rooms missing surfaces are listed in §6**: 4,009 rooms total are missing ≥1 surface (out of 77,825 that have any Ytskikt installation; another ~36k rooms have no installations at all). Most common pattern is missing `Tak`.

---

## 1. Inventory

All categories in `component_categories`:

| Category | id | Types | Subtypes | Models |
|---|---|---|---|---|
| Sanitetsgods | `7fa0800a-97fc-499b-a57e-fc833f4d5140` | 3 | 0 | 0 |
| Vitvaror | `7b9fb159-c319-4ddb-963a-58d4efa53ffe` | 18 | 120 | 3,787 |
| Vitvaror ta bort | `da6ea8e8-7803-4a35-8b5a-a03b783f97b0` | 17 | 4 | 2 |
| VVS | `39687523-b610-4919-94b4-709436279a48` | 2 | 1 | 0 |
| **Ytskikt** | **`14e65494-61d2-42a2-8faf-c7912e8bb1be`** | **3** | **25** | **2,564** |
| Ytskikt fake | `00000000-0000-0000-0000-000000000001` | 3 | 12 | 12 |

Component-instance totals:

| Metric | Value |
|---|---|
| `components` rows | 310,276 |
| `component_installations` rows | 310,276 |
| Active installations (`deinstallationDate IS NULL`) | 310,275 |
| Components under Ytskikt subtree | 247,754 |
| Installations under Ytskikt subtree | 247,754 |

> Numbers are slightly higher than the handoff's snapshot (Vitvaror grew from 107→120 subtypes and 2,296→3,787 models; total instances 310,268→310,276). The Ytskikt count (`3 types / 25 subtypes / 2,564 models`) matches the handoff closely (handoff said 24 subtypes — 25 is correct in DB; the discrepancy is the orphan `Sockel`).

## 2. Duplicate Ytskikt — resolution proposal

**There is NO duplicate by `categoryName`.** The dev-seed row was previously renamed to `Ytskikt fake`, so `getSurfaceModels`' filter (`categoryName = 'Ytskikt'`) already matches only the import row. The picker is **not** contaminated by the dev seed.

| Row | id | Types | Subtypes | Models | In picker? |
|---|---|---|---|---|---|
| Real | `14e65494-61d2-42a2-8faf-c7912e8bb1be` | 3 | 25 | 2,564 | yes |
| Dev seed (renamed) | `00000000-0000-0000-0000-000000000001` | 3 | 12 | 12 | no (filtered by name) |

**Recommendation: no action required for picker correctness.** Two follow-up options for the user:

- [ ] **Leave it.** The renamed dev-seed is invisible to the production query and adds no functional risk. Cost: 27 wasted rows.
- [ ] **Clean it up.** Bottom-up cleanup proposed below — execute only after explicit user approval.

Proposed SQL (DO NOT EXECUTE WITHOUT USER APPROVAL):

```sql
-- 1) Delete dev-seed Ytskikt installations + components (if any exist).
--    Components in the dev-seed subtree are extremely unlikely (handoff says picker did not
--    write to test_21_DB), but check first.
SELECT COUNT(*) FROM component_installations inst
JOIN components c ON c.id = inst.componentId
JOIN component_models m ON c.modelId = m.id
JOIN component_subtypes s ON m.componentSubtypeId = s.id
JOIN component_types t ON s.typeId = t.id
WHERE t.categoryId = '00000000-0000-0000-0000-000000000001';
-- If 0: proceed. If >0: stop and re-evaluate.

-- 2) Models → 3) subtypes → 4) types → 5) category
DELETE m FROM component_models m
JOIN component_subtypes s ON m.componentSubtypeId = s.id
JOIN component_types t ON s.typeId = t.id
WHERE t.categoryId = '00000000-0000-0000-0000-000000000001';

DELETE s FROM component_subtypes s
JOIN component_types t ON s.typeId = t.id
WHERE t.categoryId = '00000000-0000-0000-0000-000000000001';

DELETE FROM component_types WHERE categoryId = '00000000-0000-0000-0000-000000000001';
DELETE FROM component_categories WHERE id = '00000000-0000-0000-0000-000000000001';
```

> Caveat: if someone is still running the seed.ts script periodically (e.g. for local dev), deleting the seeded row in shared test_21_DB will be re-created on next seed run. Coordinate with team before deleting in a shared DB. Locally each dev has its own seed run.

The user may also want to clean up `Vitvaror ta bort` (`da6ea8e8-…`) — the name literally means "Vitvaror remove". 17 types/4 subtypes/2 models. Same pattern, same proposal, awaiting approval.

## 3. Orphan subtype

**No structural orphans** (no broken FKs anywhere in the component hierarchy):

| Check | Result |
|---|---|
| Subtypes pointing to missing type | 0 |
| Subtypes under missing category | 0 |
| Models pointing to missing subtype | 0 |
| Types pointing to missing category | 0 |

**One Ytskikt subtype has zero models** — this is the "orphan" the import handoff flagged:

| id | subTypeName | typeName |
|---|---|---|
| `7390d004-2428-4c8e-a474-efaeddf55450` | Sockel | Vägg |

`Sockel` (Swedish for "baseboard / skirting") sits under `Vägg` with no `ComponentModels` rows. Today the picker iterates `surfaceModels` (a flat list of *models*), so `Sockel` is silently absent — but if Agent A switches to subtype-grain (recommended), `Sockel` would appear as a clickable subtype with no underlying model, causing the create call to fail.

**Proposed fix (no DB write needed in the immediate term):** filter `Sockel`-style empty subtypes on the backend. Add to `getSurfaceModels` (or the new `getSurfaceSubtypes` if introduced):

```ts
// In services/property/src/adapters/component-model-adapter.ts:140
//   only return subtypes that have ≥1 model
where: {
  category: { categoryName: SURFACE_CATEGORY_NAME },
  componentModels: { some: {} },  // SQL Server: EXISTS
}
```

Alternative DB cleanup (proposed, awaiting user approval — only run if the product owner confirms `Sockel` is not a real surface category that should eventually have models):

```sql
-- Remove the orphan subtype. If Sockel is intended to exist but just hasn't been
-- populated, leave it and rely on the EXISTS filter above.
DELETE FROM component_subtypes WHERE id = '7390d004-2428-4c8e-a474-efaeddf55450';
```

## 4. Subtype-to-model ratio per surface type

Summary:

| Type | Subtypes | Models | Avg models/subtype | Max |
|---|---|---|---|---|
| Vägg | 11 | 1,757 | ~160 | 956 (`Tapetsering`) |
| Golv | 11 | 400 | ~36 | 154 (`Linoleum`) |
| Tak | 3 | 407 | ~136 | 405 (`Målning tak`) |

Full breakdown:

| Type | Subtype | Models |
|---|---|---|
| Golv | Betonggolv | 10 |
| Golv | Golv målning | 1 |
| Golv | Golvmassa | 7 |
| Golv | Klinker | 14 |
| Golv | Läggning ekparkett | 56 |
| Golv | Laminat | 30 |
| Golv | Linoleum | 154 |
| Golv | Plastgolv | 95 |
| Golv | Slipning/läggning parkett | 28 |
| Golv | Textilgolv | 1 |
| Golv | Trägolv | 4 |
| Tak | Akustiktak | 1 |
| Tak | Innertak skivor | 1 |
| Tak | Målning tak | 405 |
| Vägg | Duschvägg | 1 |
| Vägg | Fondvägg | 101 |
| Vägg | Kakel | 156 |
| Vägg | Målning eller tapetsering | 253 |
| Vägg | Målning väggar | 273 |
| Vägg | Plastbeklädnad | 5 |
| Vägg | Putsade väggar | 1 |
| Vägg | Skivor | 3 |
| Vägg | Sockel | **0** *(see §3)* |
| Vägg | Tapetsering | 956 |
| Vägg | Våtrumsvägg | 8 |

**Recommendation for Agent A: picker-grain = SUBTYPES.**
- Total picker items = 25 (24 after dropping `Sockel`) — fits trivially in a Radix dropdown, no virtualization needed.
- Model-grain would be unusable (956 indistinguishable "Tapetsering" rows under Vägg).
- On click, pick a deterministic model under the chosen subtype. Suggested order (apply first that exists):
  1. The model whose `modelName == subTypeName` exactly.
  2. The lexicographically-first model under that subtype.
  3. (Optional follow-up: a flag on `ComponentModels` like `isDefaultForSubtype` — out of scope here.)

## 5. `getSurfaceModels` performance

| Measurement | Value |
|---|---|
| Raw SQL `COUNT(*)` of Ytskikt models | **22 ms** |
| `prisma.componentModels.findMany` w/ 4-level nested include (mirroring `getSurfaceModels`) | **521 ms** for 2,564 rows |
| Endpoint `/component-models/surface` wall-clock | **not measured** — property dev server not started in this session |

**Verdict: not great, but the bottleneck is payload size + Prisma hydration, not the SQL itself.** 500ms to serialize a 4-level nested tree of 2,564 rows is plausible; SQL is fine.

**Recommended path forward (handed to Agent A):**
- Since picker-grain = subtypes (§4), Agent A should add a backend endpoint `GET /component-subtypes/surface` (returns ~25 subtypes, no nested models) and switch the picker to that. Expected response time: under 50ms.
- The current `GET /component-models/surface` can stay (legacy / alternative use) but does not need to be in the picker hot path.

If Agent A prefers to keep the existing endpoint for now, the 521ms ship-cost is tolerable for a `staleTime: Infinity` React Query cache (one-time on app load).

## 6. Sample rooms missing surfaces (for Agent A to test against)

Aggregate stats:

| Metric | Value |
|---|---|
| Total rooms in DB (`barum`) | 114,219 |
| Rooms with ≥1 Ytskikt installation | 77,825 |
| Rooms with all three (Vägg + Golv + Tak) | 73,816 |
| Rooms missing at least one surface | **4,009** |
| Rooms missing all three | 0 (rooms with no Ytskikt rows at all sit in the 36,394 gap, not here) |

15 concrete sample rooms (room `propertyObjectId` = `barum.keycmobj`, also = `cmobj.keycmobj`). The `propertyObjectId` is `Char(15)` so trailing spaces are part of the key.

| propertyObjectId | residenceCode | residenceName | roomName | Missing |
|---|---|---|---|---|
| `_0J415FLZ4` (+5 spaces) | 0102 | ANTIKVARIEVÄGEN 11 | VARDAGSRUM | Tak |
| `_4J80KVBO752IIV` | 0804 | SÄBYGATAN 2 | KÖK | Tak |
| `_0J415CWPU` (+5 spaces) | 1004 | GEIJERSGATAN 20 | KÖK | Tak |
| `_0J415CJ0C` (+5 spaces) | 0101 | ANNEDALSGATAN 15 B | TRAPP | Tak |
| `_0J415FNIU` (+5 spaces) | 1104 | SÄBYGATAN 9 | VARDAGSRUM | Tak |
| `_0J415FIWK` (+5 spaces) | 0301 | KARLFELDTSPLATSEN 10 | RUM 1 | Tak |
| `_0J415DV84` (+5 spaces) | 0202 | PORTLIDERVÄGEN 2 | VARDAGSRUM | Tak |
| `_0J415E1I4` (+5 spaces) | 0301 | BOMANSGATAN 32 B | HALL | Tak |
| `_0J415FAR0` (+5 spaces) | 0201 | BRUNBJÖRNSVÄGEN 18 | TRAPP | Tak |
| `_0J415DQLI` (+5 spaces) | 0401 | RÖNNBERGAGATAN 52 | VARDAGSRUM | Tak |
| `_0J415EN44` (+5 spaces) | 0201 | STÅNGJÄRNSGATAN 364 | VARDAGSRUM | Tak |
| `_0J415EKQW` (+5 spaces) | 0202 | VÄLLJÄRNSGATAN 15 | RUM 2 | Tak |
| `_0J415F1WO` (+5 spaces) | 0101 | HÅKANTORPSGATAN 139 | TRAPP | Golv |
| `_0J415FZL4` (+5 spaces) | *(no babuf row found)* | — | — | Golv |
| `_3F70LP2ZEXZL09` | *(no babuf row found)* | — | — | Golv |

> **Note**: the pattern is dominantly `missing = Tak` — likely an import-side gap rather than business intent. Agent A's end-to-end test should pick e.g. `_0J415FLZ4` (vardagsrum at ANTIKVARIEVÄGEN 11, residence 0102) to validate the "Lägg till Tak" path.

> Trailing whitespace in `Char(15)` keys: Prisma's TypeScript client returns the value space-padded. The frontend route-param sends it as-is; the property service's existing endpoints already handle this. No change needed.

## 7. Legacy inspection drafts

**Out of scope for this DB.** `test_21_DB` is the property service's database; inspection drafts live in the separate inspection-service database, which I don't have credentials for in this session.

`SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME LIKE '%inspection%'` returned 0 rows in test_21_DB.

**Recommendation for Agent A: not a blocker.** The schema change to `InspectionRoomSchema` (dropping `wall1`–`wall4` etc.) is enforced on parse, so any pre-existing drafts will fail to load. The fix path:
1. Either reset/clear inspection drafts in test-environment inspection DB before testing (coordinate with backend team).
2. Or extend `InspectionRoomSchema` to ignore unknown keys (`.passthrough()` or `.transform(({ wall1, wall2, wall3, wall4, floor, ceiling, ...rest }) => rest)`) — but this is a follow-up, not blocking the picker work.

Should be raised with the user / Agent A separately; nothing for me to do here without the inspection DB.

## 8. Index recommendations

Existing indexes on the component hierarchy (verified via `sys.indexes` query):

| Table | Index | Columns |
|---|---|---|
| component_categories | PK_component_categories | id (clustered) |
| component_types | PK_component_types | id (clustered) |
| component_types | component_types_categoryId_idx | categoryId |
| component_subtypes | PK_component_subtypes | id (clustered) |
| component_subtypes | component_subtypes_typeId_idx | typeId |
| component_models | PK_component_models | id (clustered) |
| component_models | component_models_componentSubtypeId_idx | componentSubtypeId |
| components | PK_components | id (clustered) |
| components | idx_components_model | modelId |
| components | idx_components_status | status |
| component_installations | PK_component_installations | id (clustered) |
| component_installations | component_installations_componentId_idx | componentId |
| component_installations | component_installations_spaceId_idx | spaceId |

**Verdict: no index changes recommended.** The full FK index set is already in place. The only "missing" index would be on `component_categories.categoryName`, but with 6 rows in the table it's strictly worse than a scan. The real perf opportunity is endpoint shape (§5), not DB indexes.

If the picker stays on `getSurfaceModels` with 2,564 models, a covering index `(category_id) INCLUDE (categoryName)` on `component_types` could shave milliseconds, but it is not worth a migration round-trip; the Prisma hydration cost dwarfs any SQL gain.

## 9. Anything else worth knowing

- **Tak under-population**: of the 4,009 rooms missing surfaces, the vast majority are missing `Tak`. Likely an import-source gap (ceilings weren't imported for all room types). Worth flagging upstream (Albin?) — out of scope here but Agent A's UX should handle the "add Tak" path well because it's the dominant case.
- **Sockel (Vägg) has no models** (§3) — the cleanest fix is a backend filter that drops empty subtypes. Not a DB write.
- **Vitvaror ta bort** (`da6ea8e8-…`) is a stale category that should probably be deleted. Out of scope for MIM-1732 (Vitvaror isn't picker-relevant), but worth raising with the user as part of the same cleanup conversation.
- **No structural FK violations** anywhere in the component hierarchy. Import quality is good.
- **Diagnostic script lives at `services/property/prisma/diag-mim1732.ts`** and dumps results to `services/property/prisma/diag-mim1732-output/*.json`. Re-runnable via `pnpm exec ts-node prisma/diag-mim1732.ts` from `services/property/`. Both should probably be `.gitignore`d — I have not added them to the repo intentionally, and they are not committed with this file.
- **Property dev server (`:5050`) was not started in this session**, so the `/component-models/surface` wall-clock number in §5 is the Prisma-client-direct time (mirrors what the route does, minus Koa overhead). Add ~5–15ms for the HTTP layer.
