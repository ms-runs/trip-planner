"""Builds a trip's basemap.js from free map data. Standard library only.

    python tools/build_basemap.py trips/tetons-yellowstone

Reads   trips/<trip>/basemap.config.json
Writes  trips/<trip>/basemap.js

The config says which area to cover and which layers to draw:

    {
      "bounds": [south, west, north, east],        // degrees; the map is fitted to this box
      "tolerance": 0.004,                           // simplification in degrees (bigger = smaller file)
      "layers": [
        {"kind": "region", "source": "ne:admin_1_states_provinces",
         "where": {"iso_a2": "US"}, "id": "postal", "name": "name"},
        {"kind": "region", "class": "park", "source": "https://…/yell.geojson",
         "id": "yell", "name": "Yellowstone National Park"},
        {"kind": "water", "source": "ne:lakes"},
        {"kind": "road",  "source": "ne:roads"},
        {"kind": "river", "source": "ne:rivers_lake_centerlines"}
      ],
      "labels": [{"text": "Yellowstone Lake", "lat": 44.42, "lng": -110.36, "kind": "water"}]
    }

"ne:<name>" means Natural Earth's 1:10m layer of that name (worldwide, public domain),
so the same tool works for Japan prefectures, Italian regions, Scottish council areas…
Any other source is a GeoJSON URL or a local file path.

Regions are the shapes stops are checked against ("is this pin in Yellowstone?") and
tinted when a stop is open. "id"/"name" are either a property name to read, or, when
the source holds one shape, the literal value to use.
Downloads are cached in tools/.cache.
"""
import json, math, sys, urllib.request, hashlib
from pathlib import Path

HERE = Path(__file__).parent
CACHE = HERE / ".cache"
NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_{}.geojson"


def load(source, base):
    if source.startswith("ne:"):
        source = NE.format(source[3:])
    if source.startswith("http"):
        CACHE.mkdir(exist_ok=True)
        f = CACHE / (hashlib.sha1(source.encode()).hexdigest()[:12] + ".geojson")
        if not f.exists():
            print("  downloading", source)
            with urllib.request.urlopen(source) as r:
                f.write_bytes(r.read())
        return json.loads(f.read_text())
    return json.loads((base / source).read_text())


def features(gj):
    if gj.get("type") == "FeatureCollection":
        return gj["features"]
    if gj.get("type") == "Feature":
        return [gj]
    return [{"type": "Feature", "properties": {}, "geometry": gj}]


def polygons(geom):
    t, c = geom["type"], geom["coordinates"]
    return [c] if t == "Polygon" else c if t == "MultiPolygon" else []


def lines(geom):
    t, c = geom["type"], geom["coordinates"]
    return [c] if t == "LineString" else c if t == "MultiLineString" else []


def clip_ring(ring, box):
    """Sutherland–Hodgman against an axis-aligned box (s, w, n, e)."""
    s, w, n, e = box
    edges = [(lambda p: p[0] >= w, lambda a, b: (w, a[1] + (b[1] - a[1]) * (w - a[0]) / (b[0] - a[0]))),
             (lambda p: p[0] <= e, lambda a, b: (e, a[1] + (b[1] - a[1]) * (e - a[0]) / (b[0] - a[0]))),
             (lambda p: p[1] >= s, lambda a, b: (a[0] + (b[0] - a[0]) * (s - a[1]) / (b[1] - a[1]), s)),
             (lambda p: p[1] <= n, lambda a, b: (a[0] + (b[0] - a[0]) * (n - a[1]) / (b[1] - a[1]), n))]
    pts = [tuple(p[:2]) for p in ring]
    for inside, cross in edges:
        if not pts:
            break
        out, prev = [], pts[-1]
        for cur in pts:
            if inside(cur):
                if not inside(prev):
                    out.append(cross(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cross(prev, cur))
            prev = cur
        pts = out
    return pts


def clip_line(line, box):
    """Keeps the runs of a line that are inside the box (plus one point either side)."""
    s, w, n, e = box
    inside = lambda p: w <= p[0] <= e and s <= p[1] <= n
    runs, cur = [], []
    for i, p in enumerate(line):
        if inside(p) or (i + 1 < len(line) and inside(line[i + 1])) or (i and inside(line[i - 1])):
            cur.append(tuple(p[:2]))
        elif cur:
            runs.append(cur); cur = []
    if cur:
        runs.append(cur)
    return [r for r in runs if len(r) > 1]


def simplify(pts, tol):
    """Douglas–Peucker, iterative."""
    if len(pts) < 3 or tol <= 0:
        return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        dx, dy, best, idx = bx - ax, by - ay, 0, 0
        L = math.hypot(dx, dy)
        for i in range(a + 1, b):
            # distance to the chord, or to the point itself when the ends meet (closed rings)
            d = (abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L) if L > 1e-12 else math.hypot(pts[i][0] - ax, pts[i][1] - ay)
            if d > best:
                best, idx = d, i
        if best > tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(pts, keep) if k]


def rnd(pts):
    return [[round(x, 4), round(y, 4)] for x, y in pts]


def prop(f, key, single):
    if key is None:
        return None
    props = f.get("properties") or {}
    return props.get(key, key if single else None)


def main(trip_dir):
    base = Path(trip_dir)
    cfg = json.loads((base / "basemap.config.json").read_text())
    s, w, n, e = cfg["bounds"]
    pad = max(n - s, e - w) * 0.35
    box = (s - pad, w - pad, n + pad, e + pad)   # draw a margin so panning past the edge still shows land
    tol = cfg.get("tolerance", 0.004)
    out = {"bounds": cfg["bounds"], "regions": [], "water": [], "roads": [], "rivers": [], "labels": cfg.get("labels", [])}
    for layer in cfg["layers"]:
        feats = features(load(layer["source"], base))
        where = layer.get("where", {})
        feats = [f for f in feats if all((f.get("properties") or {}).get(k) == v for k, v in where.items())]
        if "types" in layer:
            feats = [f for f in feats if (f.get("properties") or {}).get("type") in layer["types"]]
        single = len(feats) == 1
        kind, count = layer["kind"], 0
        for f in feats:
            g = f.get("geometry")
            if not g:
                continue
            if kind in ("region", "water"):
                rings = []
                for poly in polygons(g):
                    for ring in poly:
                        r = simplify(clip_ring(ring, box), tol)
                        if len(r) >= 4:
                            rings.append(rnd(r))
                if not rings:
                    continue
                if kind == "water":
                    out["water"].append(rings)
                else:
                    out["regions"].append({"id": str(prop(f, layer.get("id"), single)), "name": prop(f, layer.get("name"), single),
                                           "class": layer.get("class", "land"), "rings": rings})
                count += 1
            else:
                for ln in lines(g):
                    for run in clip_line(ln, box):
                        r = simplify(run, tol / 2)
                        if len(r) > 1:
                            out["roads" if kind == "road" else "rivers"].append(rnd(r)); count += 1
        print(f"  {kind:6} {layer['source'][:60]:60} {count} kept")
    js = ("// Generated by tools/build_basemap.py from basemap.config.json — edit the config and re-run, don't edit this file.\n"
          "// Map data: Natural Earth (public domain) and any other sources named in the config.\n"
          "window.BASEMAP = " + json.dumps(out, separators=(",", ":")) + ";\n")
    (base / "basemap.js").write_text(js)
    print(f"wrote {base / 'basemap.js'} ({len(js) // 1024} KB, {len(out['regions'])} regions)")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
