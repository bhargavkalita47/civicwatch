# CivicWatch geography — worldwide reporting

CivicWatch no longer restricts reports to a fixed list of cities or a city radius.
A report is anchored to **precise WGS84 latitude/longitude**. An independently
recorded reporting area (town, village or locality, region, country) groups
reports for the Overview directory. No reporting area needs to exist beforehand.

## User experience

1. On Explore, search for a place **explicitly** (press Find) or pan the map to any location in the world. Reports visible in the viewport form the right-hand list.
2. Press Report an issue; search for the location, use your device's location, or tap the exact map point.
3. The form attempts a **single** reverse lookup for the selected pin. If it fails or the result is inaccurate, edit the optional City and Locality fields manually, or continue using the pin alone. Region and country are internal metadata, with explicit unspecified values when lookup cannot supply them. The pin's coordinates remain the authoritative position.
4. Save a report. The local service adds its reporting area and updates the dataset and relevant totals in that browser. Other locations are never rejected for being beyond an existing city's radius.
5. Overview has **one distinct platform total** from the active service; people are deduplicated globally instead of summing unique counts by locality. Town watchlist provides selected-town activity and totals across saved towns.
6. Resolved issues leave active map markers but remain in Reports → Resolved for watched towns, in My reports for their author, and in resolved statistics.

Fictional reports across four cities are available only when `VITE_SEED_DEMO=true` is explicitly enabled for an empty browser-local dataset. New datasets are empty by default. They are not an allowed-city list. Existing browser-local reports are migrated when loaded.

## API and data contracts

- `Issue.location` is authoritative exact `Coordinate`.
- `Issue.cityId` retains a stable geographic grouping ID for backwards compatibility, but is **not** a whitelist.
- `CreateIssueInput.area` includes the locality, region, country and center; `mockService` normalizes names and constructs a deterministic ID. The service upserts the area when a new location is reported.
- `GET /cities` is a historical path name kept for compatibility; it means reporting areas with reports. An unbound Worker returns `[]`, never a made-up fixed list.
- `Dataset.areas` adds source-owned area metadata; older datasets without this field are upgraded on read.
- `GET /overview` can use server-side grouped SQL + deduplicated platform aggregates; it doesn't need to load the entire map.
- D1 migration `0005_unrestricted_reporting.sql` removes unused sample areas from a newly migrated database, preserves referenced rows and adds a geographic directory index. Insert/upsert area in the same authenticated transaction as a new issue before inserting the issue to satisfy foreign keys.
- **Production security:** never trust a browser-provided user or administrative role. Validate and rate-limit location labels, verify coordinates and appropriate locality mapping server-side when the API is activated. A user-supplied place name is unverified metadata, not a jurisdiction or authorization boundary.

## Map tiles and place lookup

Map tiles: OpenStreetMap via Leaflet (replaceable by `VITE_TILE_URL`; public OSM tile service has its own fair-use policy).

Place lookup: Photon, an OSM-derived open-source geocoder (explicit user searches and pin-triggered reverse lookups, **not** search-as-you-type). Default `https://photon.komoot.io` is a community-hosted demo; it has **no uptime guarantee**, throttles heavy clients and must not be relied upon for high-traffic production. The client caches repeated responses, serializes requests and spaces requests by at least 1.1 seconds **per browser only**. These client limits do not enforce a global application-wide limit. This endpoint is configurable via the build-time `VITE_GEOCODER_BASE_URL`, so switch to your own hosted Photon or managed geocoder with a suitable SLA before a major launch. Avoid private search data in external geocoding calls.

If a lookup fails, users can still report by pinning the precise location and optionally correcting City and Locality. No location label is required to continue with a confirmed pin. A backend geocoder integration can replace `src/services/geo.ts` without changing reporting or storage. Maps are not bound to the geocoder provider.
