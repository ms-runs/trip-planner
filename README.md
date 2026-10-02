# Trip planner

A map-and-itinerary planner for any trip: stops, travel legs, saved places from Google Maps, ideas from saved posts, and day-by-day playback. No build step and no libraries. Each trip is one folder under `trips/`.

| File | What it's for |
|---|---|
| `index.html` | The page. Opens the trip named in `?trip=` (or the first in `config.js`). |
| `planner.js` | The planner itself. Doesn't need editing for a new trip. |
| `config.js` | Shared saving settings and the list of trips. |
| `trips/<id>/trip.js` | Everything about one trip: stops, travel types, categories, colours, ideas. |
| `trips/<id>/basemap.config.json` | The area the map covers and the map layers to draw. |
| `trips/<id>/basemap.js` | The map, generated from the config above. |
| `tools/build_basemap.py` | Builds `basemap.js` for any area. |
| `supabase-setup.sql` | Database setup. Already done in the shared project; only needed for a new one. |
| `maps-link-expander.js` | Optional. Lets short `maps.app.goo.gl` links work. |
| `verify.py` | Optional. Full automated test in a headless browser. |

## 1. Put it on GitHub Pages

1. On GitHub, **New repository**. Name it, for example, `trips`, and make it **Public** (free Pages needs that; plans are stored in Supabase, not the repo). Don't add a README.
2. **Add file → Upload files**. Drag in the *contents* of this folder, so `index.html` sits at the top level and `trips/`, `tools/` keep their folders. Commit.
3. **Settings → Pages →** Source: *Deploy from a branch*, Branch: `main`, folder `/ (root)` → **Save**.
4. After a minute or two the page is at `https://YOUR-USERNAME.github.io/trips/`.

It works now, but each person's edits stay in their own browser. Step 2 makes it shared.

Pages from different repos on the same GitHub account share one address (`YOUR-USERNAME.github.io`), so they share browser storage too. This planner keeps its data under its own keys (`tripPlanner:<trip>:…`), so it never reads or overwrites another planner's saved plan.

## 2. Shared saving (uses the Japan planner's Supabase project)

`config.js` already points at the same Supabase project as the Japan planner, so there's nothing to set up: no new project, and no need to run `supabase-setup.sql` again (the table and functions are identical).

Both planners store each plan as one row, keyed by its share code. So the only rule is: **use a share code you haven't used for Japan.**

1. Make up a long code (12+ characters, e.g. `tetons-2027-q8w4zr`) and share:
   ```
   https://YOUR-USERNAME.github.io/trips/?trip=tetons-yellowstone#trip=tetons-2027-q8w4zr
   ```
   The first person to open it uploads their current plan; everyone after loads the shared one.
2. Press **Checks** in the header. "Shared plan is in sync" should be green.

If a code is reused by mistake, nothing is lost: both planners refuse a code that holds the other's plan (the header says the code belongs to another trip), and the database itself won't save one planner's plan over the other's.

To move to a project of your own later: create one, run `supabase-setup.sql` in **SQL Editor**, and put its **Project URL** and **anon / publishable** key in `config.js` (never the secret or `service_role` key).

**Treat the link like a password**: anyone with it can edit. The code after `#` isn't sent to GitHub or kept in server logs.

How syncing behaves: every change saves in your browser at once and reaches the shared copy about a second later. Others' changes arrive within 15 seconds, or when you switch back to the tab. If two people save in the same second, the first wins and the other is asked to redo their change. Offline edits are kept and sent when you reconnect.

**Free-plan caveat:** Supabase pauses free projects after about a week with no activity (use by either planner counts). Nothing is lost: open the dashboard and press **Restore**. While paused, the page keeps working from each browser's saved copy.

## 3. Optional: short Google Maps links

The **Share** button in the Google Maps app gives `maps.app.goo.gl` links, which hide the location. Without this step you can still add them; you just pick the stop yourself (or paste the long link from the browser address bar).

1. At cloudflare.com (free): **Workers & Pages → Create → Create Worker** → *Hello World* → Deploy → **Edit code**.
2. Replace everything with `maps-link-expander.js` and **Deploy**.
3. Put the worker's address in `resolverUrl` in `config.js`.

## Everyday use

- **Add a place:** in Google Maps, Share → copy link, then paste it into *Add a place* (or anywhere on the page). It's filed under the nearest stop; change the stop or note if needed.
- **New stop:** paste a Maps link for the place and choose *New stop at this place*. **Edit stops** reorders, renames or removes.
- **Bookings:** click the travel line between two stops to add flight, rental or shuttle details. Lines on the map turn solid once something is booked.
- **Ideas:** the Ideas tab lists saved Instagram posts about the trip. Press + to add a place from one.
- **Checks:** runs the built-in checks (map placement, dates vs bookings, saving, sync).
- **Getting Claude to change it:** press **Copy plan**, paste the text into a chat with Claude and ask for the change. **Load plan** pastes plan text back in. To change the built-in starting plan (what **Reset** goes back to), edit `plan` in `trip.js`.

## Adding another trip

1. Copy `trips/tetons-yellowstone` to `trips/<new-id>` (lowercase letters, numbers and hyphens).
2. In `basemap.config.json`, set `bounds` to `[south, west, north, east]` in degrees, and pick layers. `ne:admin_1_states_provinces` gives states, prefectures or provinces anywhere in the world; filter with `"where": {"iso_a2": "JP"}` (the country code). Add any other GeoJSON by URL, as the park outlines are.
3. Build the map: `python tools/build_basemap.py trips/<new-id>` (standard Python, no installs; it downloads the data once).
4. Edit `trip.js`: title, colours, travel types, categories, stops. Each stop's `regionIds` lists the map shapes it should sit in; **Checks** confirms them.
5. Add `{id: '<new-id>', title: '…'}` to `trips` in `config.js`. A trip switcher appears in the header.
6. Open `?trip=<new-id>` and press **Checks**. Use a new trip code in the share link; the same Supabase project holds every trip.

## Running the full test (optional)

```bash
pip install playwright && playwright install chromium
python verify.py                 # or: python verify.py <trip-id>
```

It serves the page locally and tests checks, adding places, saving, playback and two people syncing against a stand-in database. It never touches your real Supabase.

Map data: Natural Earth (public domain) and the US National Park Service.
