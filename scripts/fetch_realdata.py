#!/usr/bin/env python3
"""
WHAT: Fetch small public-domain snapshots from NASA/JPL SSD APIs into src/config/realdata.json.
WHY:  The Learning Center plots real data (closest approaches, the Sentry risk list, recorded fireballs) and the
      game loads nothing remote at run time (CSP, no remote fetches). So the data is baked: this script is the
      recipe, the JSON is the dated snapshot, both are committed. NASA/JPL data is public domain.
HOW:  python3 scripts/fetch_realdata.py  (needs network; stdlib only). Reduces each table to the fields the
      game draws and records the query URL and fetch date with it.
LORE: T3 (how often), F9 (Torino and Palermo), O12 (close approach)
"""
import datetime
import json
import urllib.request

UA = {"User-Agent": "miss-beta-teaching-repo (public data snapshot)"}
CAD = "https://ssd-api.jpl.nasa.gov/cad.api?date-min=2015-01-01&date-max=2026-10-01&dist-max=0.01&sort=dist&limit=60&fullname=true"
SENTRY = "https://ssd-api.jpl.nasa.gov/sentry.api"
FIREBALL = "https://ssd-api.jpl.nasa.gov/fireball.api?req-loc=true&sort=-energy&limit=40"
AU_KM = 149597870.7
LD_KM = 384400.0


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.load(r)


def main():
    today = datetime.date.today().isoformat()
    cad = get(CAD)
    f = cad["fields"]
    ix = {k: f.index(k) for k in ("des", "cd", "dist", "v_rel", "h")}
    approaches = [
        {"des": row[ix["des"]], "date": row[ix["cd"]], "dist_ld": round(float(row[ix["dist"]]) * AU_KM / LD_KM, 4),
         "v_rel_kms": round(float(row[ix["v_rel"]]), 2), "h": float(row[ix["h"]]) if row[ix["h"]] else None}
        for row in cad["data"]
    ]
    sen = get(SENTRY)["data"]
    sen.sort(key=lambda d: float(d.get("ps_cum", "-99")), reverse=True)
    risks = [
        {"des": d["des"], "range": d["range"], "ip": float(d["ip"]), "ps_cum": float(d["ps_cum"]),
         "ts_max": int(d["ts_max"]) if d.get("ts_max") not in (None, "") else 0,
         "d_km": float(d["diameter"]) if d.get("diameter") else None, "h": float(d["h"]), "v_inf_kms": float(d["v_inf"])}
        for d in sen[:30]
    ]
    fb = get(FIREBALL)
    f = fb["fields"]
    ix = {k: f.index(k) for k in f}
    fireballs = []
    for row in fb["data"]:
        lat = float(row[ix["lat"]]) * (1 if row[ix["lat-dir"]] == "N" else -1)
        lon = float(row[ix["lon"]]) * (1 if row[ix["lon-dir"]] == "E" else -1)
        fireballs.append({"date": row[ix["date"]], "impact_kt": float(row[ix["impact-e"]]), "lat": lat, "lon": lon,
                          "alt_km": float(row[ix["alt"]]) if row[ix["alt"]] else None,
                          "vel_kms": float(row[ix["vel"]]) if row[ix["vel"]] else None})
    out = {
        "_comment": "Public-domain snapshots from NASA/JPL SSD APIs, reduced to what the game draws. Regenerate with scripts/fetch_realdata.py.",
        "fetched": today,
        "sources": {"approaches": CAD, "risks": SENTRY, "fireballs": FIREBALL},
        "approaches": approaches,
        "risks": risks,
        "fireballs": fireballs,
    }
    with open("src/config/realdata.json", "w") as fh:
        json.dump(out, fh, indent=1)
        fh.write("\n")
    print(f"realdata: {len(approaches)} approaches, {len(risks)} risks, {len(fireballs)} fireballs ({today})")


if __name__ == "__main__":
    main()
