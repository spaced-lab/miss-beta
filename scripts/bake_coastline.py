#!/usr/bin/env python3
"""
WHAT: Thin the Natural Earth 1:110m coastline into src/config/coastline.json (rounded lon/lat polylines).
WHY:  The fireball map in the Learning Center draws real coastlines without fetching anything at run time.
      Natural Earth is public domain ("Made with Natural Earth", naturalearthdata.com).
HOW:  python3 scripts/bake_coastline.py <ne_110m_coastline.geojson>  (download it from the natural-earth-vector
      repository). Keeps every polyline with at least 4 points, drops points closer than 1.2 degrees to the last
      kept one, rounds to 0.1 degree. Stdlib only.
LORE: T3 (how often)
"""
import json
import math
import sys


def main(path):
    gj = json.load(open(path))
    out = []
    for f in gj["features"]:
        g = f["geometry"]
        lines = g["coordinates"] if g["type"] == "MultiLineString" else [g["coordinates"]]
        for line in lines:
            kept = []
            for lon, lat in line:
                if not kept or math.hypot(lon - kept[-1][0], lat - kept[-1][1]) >= 1.2:
                    kept.append([round(lon, 1), round(lat, 1)])
            if line and kept[-1] != [round(line[-1][0], 1), round(line[-1][1], 1)]:
                kept.append([round(line[-1][0], 1), round(line[-1][1], 1)])
            if len(kept) >= 4:
                out.append([v for p in kept for v in p])
    doc = {"_comment": "Natural Earth 1:110m coastline, thinned by scripts/bake_coastline.py. Public domain: Made with Natural Earth.",
           "lines": out}
    with open("src/config/coastline.json", "w") as fh:
        json.dump(doc, fh, separators=(",", ":"))
        fh.write("\n")
    print(f"coastline: {len(out)} polylines, {sum(len(l) // 2 for l in out)} points")


if __name__ == "__main__":
    main(sys.argv[1])
