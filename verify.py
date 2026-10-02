"""End-to-end check of the trip planner in a headless browser.

    pip install playwright && playwright install chromium
    python verify.py                       # tests trips/tetons-yellowstone
    python verify.py my-other-trip         # or any trip folder

It serves the repo locally, then: runs the built-in checks, adds a place by pasting and by
Enter, saves and reloads, plays the trip day by day, and has two people edit the same plan
against a stand-in database (nothing touches your real Supabase). Screenshots: shot-*.png
"""
import functools, http.server, json, re, sys, threading, time
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
TRIP = sys.argv[1] if len(sys.argv) > 1 else "tetons-yellowstone"
fails = 0


def check(name, ok, detail=""):
    global fails
    fails += not ok
    print(f"  {'✓' if ok else '✕'} {name}{'' if ok else '  — ' + str(detail)}")


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass


handler = functools.partial(Quiet, directory=str(HERE))
server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = f"http://127.0.0.1:{server.server_port}/?trip={TRIP}"

DB = {}   # stand-in for the Supabase "trips" table


def fake_supabase(route):
    req, body = route.request, json.loads(route.request.post_data or "{}")
    key = body.get("p_key")
    now = time.strftime("%Y-%m-%dT%H:%M:%S.") + f"{int(time.time() * 1e6) % 1000000:06d}+00:00"
    if req.url.endswith("/get_trip"):
        row = DB.get(key)
        out = [{"trip": row["data"], "saved_at": row["at"]}] if row else []
    else:
        row = DB.get(key)
        if row and (row["data"].get("tripId") != body["p_data"].get("tripId") or body.get("p_base") is None or row["at"] > body["p_base"]):   # same rules as the real save_trip
            out = [{"ok": False, "trip": row["data"], "saved_at": row["at"]}]
        else:
            DB[key] = {"data": body["p_data"], "at": now}
            out = [{"ok": True, "trip": body["p_data"], "saved_at": now}]
    route.fulfill(status=200, content_type="application/json", body=json.dumps(out))


def config_with_sharing(route):
    src = (HERE / "config.js").read_text()
    src = re.sub(r"supabaseUrl: '[^']*'", "supabaseUrl: 'https://test.supabase.co'", src)
    src = re.sub(r"supabaseKey: '[^']*'", "supabaseKey: 'sb_publishable_test'", src)
    route.fulfill(status=200, content_type="application/javascript", body=src)


def new_page(ctx, errors, sharing=False):
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.route("**/fonts.g*/**", lambda r: r.abort())
    pg.route("**/*.supabase.co/**", fake_supabase if sharing else (lambda r: r.abort()))
    if sharing:
        pg.route("**/config.js", config_with_sharing)
    return pg


def paste(pg, sel, text):
    pg.evaluate("""([sel, text]) => { const dt = new DataTransfer(); dt.setData('text/plain', text);
        document.querySelector(sel).dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); }""", [sel, text])


J = lambda pg, js, *a: pg.evaluate(js, *a)

with sync_playwright() as p:
    browser = p.chromium.launch()
    errors = []

    print("\n1. Loads and the built-in checks pass")
    ctx = browser.new_context(viewport={"width": 1400, "height": 880})
    pg = new_page(ctx, errors); pg.goto(BASE); pg.wait_for_timeout(700)
    R = J(pg, "runChecks().then(R => R.map(r => [r.state, r.name, r.detail]))")
    bad = [r for r in R if r[0] == "fail"]
    check(f"{len(R)} checks, none failed", not bad, bad)
    for r in R:
        if r[0] == "warn": print("    ! " + r[1] + ": " + r[2])
    check("map drawn", J(pg, "document.querySelectorAll('#land path').length") > 0)
    pg.screenshot(path=str(HERE / "shot-plan.png"))

    print("\n2. Adding places")
    first = J(pg, "trip.stops[1]")
    url = f"https://www.google.com/maps/place/Test+Spot/@{first['lat']},{first['lng']},15z/data=!3d{first['lat'] + 0.004}!4d{first['lng'] + 0.004}"
    pg.fill("#paste-in", url); pg.press("#paste-in", "Enter"); pg.wait_for_timeout(300)
    check("Enter opens the dialog and keeps it open", J(pg, "$('#place-dlg').open"))
    check("nearest stop is pre-selected", pg.input_value("#pl-stop") == first["id"], pg.input_value("#pl-stop"))
    pg.fill("#pl-note", "Go early"); pg.click("#place-dlg .primary"); pg.wait_for_timeout(300)
    places = J(pg, f"byId('{first['id']}').places")
    check("place saved with note and position", len(places) == 1 and places[0]["note"] == "Go early" and places[0]["lat"])
    paste(pg, "body", "https://www.google.com/maps/place/Elsewhere/@35.6895,139.6917,15z"); pg.wait_for_timeout(300)
    check("a place off the map is flagged", "outside" in pg.inner_text("#place-info"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)

    print("\n3. Saving")
    J(pg, "localStorage.setItem('japanTripPlanV2', 'untouched')")
    s = J(pg, "trip.stops[0]"); pg.locator(f'.stop[data-sid="{s["id"]}"] [data-action=nights][data-d="1"]').click()
    pg.reload(); pg.wait_for_timeout(600)
    check("nights and places survive a reload", J(pg, "trip.stops[0].nights") == s["nights"] + 1 and len(J(pg, f"byId('{first['id']}').places")) == 1)
    check("other planners' saved data is left alone", J(pg, "localStorage.getItem('japanTripPlanV2')") == "untouched")
    check("saved under this trip's own key", J(pg, f"Boolean(localStorage.getItem('tripPlanner:{TRIP}:plan'))"))

    print("\n4. Playback")
    J(pg, "goToDay(2)"); pg.wait_for_timeout(500)
    check("day label and marker", "Day 2 of" in pg.inner_text("#day-label") and pg.locator(".bob").count() == 1)
    pg.screenshot(path=str(HERE / "shot-playback.png"))
    if J(pg, "IDEAS.length"):
        pg.click("#ideas-tab"); pg.wait_for_timeout(300)
        check("ideas page lists ideas", pg.locator(".idea").count() == J(pg, "IDEAS.length"))
        pg.screenshot(path=str(HERE / "shot-ideas.png"))
    ctx.close()

    print("\n5. Two people sharing one plan (stand-in database)")
    code = "#trip=verify-test-code-123"
    A = new_page(browser.new_context(viewport={"width": 1200, "height": 800}), errors, sharing=True)
    A.goto(BASE + code); A.wait_for_timeout(900)
    check("first person uploads the plan", "verify-test-code-123" in DB and "Shared" in A.inner_text("#status"), A.inner_text("#status"))
    B = new_page(browser.new_context(viewport={"width": 1200, "height": 800}), errors, sharing=True)
    B.goto(BASE + code); B.wait_for_timeout(900)
    sid = J(A, "trip.stops[0].id"); n = J(A, "trip.stops[0].nights")
    A.locator(f'.stop[data-sid="{sid}"] [data-action=nights][data-d="1"]').click(); A.wait_for_timeout(1300)
    J(B, "poll()"); B.wait_for_timeout(500)
    check("second person sees the change", J(B, "trip.stops[0].nights") == n + 1)

    print("\n6. A share code already used by another trip (e.g. the Japan planner)")
    DB["japan-code-in-use-1"] = {"data": {"version": 2, "stops": [{"id": "tokyo1", "name": "Tokyo", "lat": 35.68, "lng": 139.69, "nights": 1}]}, "at": "2026-01-01T00:00:00.000000+00:00"}
    before = json.dumps(DB["japan-code-in-use-1"])
    C = new_page(browser.new_context(viewport={"width": 1200, "height": 800}), errors, sharing=True)
    C.goto(BASE + "#trip=japan-code-in-use-1"); C.wait_for_timeout(900)
    C.locator('.stop [data-action=nights][data-d="1"]').first.click(); C.wait_for_timeout(1300)
    check("the other trip's plan isn't loaded", J(C, "trip.stops[0].id") != "tokyo1")
    check("the other trip's plan isn't overwritten", json.dumps(DB["japan-code-in-use-1"]) == before)
    check("the page says why", "another trip" in C.inner_text("#status"), C.inner_text("#status"))

    check("no script errors", not errors, errors[:3])
    browser.close()

server.shutdown()
print(f"\n{'All good.' if not fails else f'{fails} problem(s).'}")
sys.exit(1 if fails else 0)
