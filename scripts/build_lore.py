#!/usr/bin/env python3
"""Build the lore chunks from EDUCATION.md (GAME_PLAN 23, EDUCATION.md Section 0).

WHAT: parses every `## <ID> <Title>` topic with its meta line and five level sections into
      public/lore/index.json plus public/lore/<ID>/<LEVEL>.json, and validates the contract.
WHY:  the game bundle carries no lore text; the browser fetches small chunks on demand.
HOW:  a line-oriented state machine; validation errors are collected and printed together, exit 1.
      Checks: five level headers per topic; related ids resolve; DEMO ids are in the LAB registry
      (Section 7 table) or `none`; PICTURE ids have a generator (a key in src/lore/pictures/*.ts) or
      an svg in public/lore/svg/; SIMPLE TEXT at most 20 words; no em dashes anywhere; EXPERT may be BACKLOG.
LORE: C1 (how it is built), C3 (tests)
"""
from __future__ import annotations

import json
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "EDUCATION.md")
OUT = os.path.join(ROOT, "public", "lore")
LEVELS = ["SIMPLE", "BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]
GROUPS = {"T": "THE THREAT", "F": "FINDING THEM", "O": "ORBITS AND MATH", "D": "DEFLECTION", "G": "THE GAME", "C": "THE CODE"}
TOPIC_RE = re.compile(r"^## ([A-Z]\d+) (.+)$")
META_RE = re.compile(r"^meta:\s*related=\[([^\]]*)\]\s*game=\[([^\]]*)\]\s*tags=\[([^\]]*)\]\s*$")


def parse(text: str) -> tuple[list[dict], list[str], list[str]]:
    """Return (topics, lab_ids, errors)."""
    lines = text.split("\n")
    topics: list[dict] = []
    errors: list[str] = []
    cur: dict | None = None
    level: str | None = None
    in_registry = False
    labs: list[str] = []
    for n, raw in enumerate(lines, 1):
        if "—" in raw:
            errors.append(f"line {n}: em dash")
        if raw.startswith("## 7. LAB registry"):
            in_registry = True
            cur = None
            continue
        if in_registry:
            if raw.startswith("## ") and not raw.startswith("## 7."):
                in_registry = False
            m = re.match(r"^\|\s*(LAB_[A-Z0-9_]+)\s*\|", raw)
            if m:
                labs.append(m.group(1))
            continue
        m = TOPIC_RE.match(raw)
        if m:
            cur = {"id": m.group(1), "title": m.group(2).strip(), "line": n, "related": [], "game": [], "tags": [], "levels": {}}
            topics.append(cur)
            level = None
            continue
        if raw.startswith("# ") or (raw.startswith("## ") and not m):
            cur = None
            level = None
            continue
        if cur is None:
            continue
        if raw.startswith("meta:"):
            mm = META_RE.match(raw)
            if not mm:
                errors.append(f"{cur['id']} line {n}: bad meta line")
                continue
            cur["related"] = [x.strip() for x in mm.group(1).split(",") if x.strip()]
            cur["game"] = [x.strip() for x in mm.group(2).split(",") if x.strip()]
            cur["tags"] = [x.strip() for x in mm.group(3).split(",") if x.strip()]
            continue
        hm = re.match(r"^### ([A-Z]+)\s*$", raw)
        if hm:
            level = hm.group(1)
            if level not in LEVELS:
                errors.append(f"{cur['id']} line {n}: unknown level {level}")
            cur["levels"][level] = []
            continue
        if level is not None:
            cur["levels"][level].append(raw)
    return topics, labs, errors


def level_record(topic: dict, level: str) -> dict:
    body = topic["levels"].get(level, [])
    text = "\n".join(body).strip("\n")
    rec = {"id": topic["id"], "level": level, "title": topic["title"], "markdown": text, "pictureId": None, "demoId": None}
    if level == "SIMPLE":
        pic = next((l for l in body if l.startswith("PICTURE:")), "")
        txt = next((l for l in body if l.startswith("TEXT:")), "")
        rec["pictureId"] = pic[len("PICTURE:"):].strip().split(" ")[0] if pic else None
        rec["markdown"] = txt[len("TEXT:"):].strip()
        rec["pictureCaption"] = pic[len("PICTURE:"):].strip().split("  ", 1)[1].strip() if "  " in pic else ""
    if level == "EXPERT":
        demo = next((l for l in body if l.startswith("DEMO:")), "")
        d = demo[len("DEMO:"):].strip().split(" ")[0] if demo else "none"
        rec["demoId"] = None if d.lower() in ("none", "") else d
    return rec


def picture_ids_available() -> set[str]:
    ids: set[str] = set()
    pdir = os.path.join(ROOT, "src", "lore", "pictures")
    if os.path.isdir(pdir):
        for f in os.listdir(pdir):
            if f.endswith(".ts"):
                with open(os.path.join(pdir, f), encoding="utf-8") as fh:
                    ids.update(re.findall(r"['\"]?(pic-[a-z0-9-]+)['\"]?\s*:", fh.read()))
    sdir = os.path.join(OUT, "svg")
    if os.path.isdir(sdir):
        for f in os.listdir(sdir):
            if f.endswith(".svg"):
                ids.add(f[:-4])
    return ids


def validate(topics: list[dict], labs: list[str], errors: list[str]) -> None:
    ids = {t["id"] for t in topics}
    pics = picture_ids_available()
    for t in topics:
        for lv in LEVELS:
            if lv not in t["levels"]:
                errors.append(f"{t['id']}: missing level {lv}")
        for r in t["related"]:
            if r not in ids:
                errors.append(f"{t['id']}: related {r} does not exist")
        simple = level_record(t, "SIMPLE")
        if "SIMPLE" in t["levels"]:
            if not simple["pictureId"]:
                errors.append(f"{t['id']}: SIMPLE has no PICTURE")
            elif simple["pictureId"] not in pics:
                errors.append(f"{t['id']}: picture {simple['pictureId']} has no generator or svg")
            words = len(simple["markdown"].split())
            if words == 0 or words > 20:
                errors.append(f"{t['id']}: SIMPLE TEXT has {words} words (1..20)")
        if "EXPERT" in t["levels"]:
            ex = level_record(t, "EXPERT")
            if ex["demoId"] and ex["demoId"] not in labs:
                errors.append(f"{t['id']}: DEMO {ex['demoId']} is not in the LAB registry")
        for lv in ("BEGINNER", "INTERMEDIATE", "ADVANCED"):
            if lv in t["levels"] and not "\n".join(t["levels"][lv]).strip():
                errors.append(f"{t['id']}: {lv} is empty")


def write_lessons(topics: list[dict]) -> int:
    """docs/LESSONS/<GROUP>.md: one page per lore group with the BEGINNER and INTERMEDIATE texts (GAME_PLAN 26.1)."""
    out_dir = os.path.join(ROOT, "docs", "LESSONS")
    os.makedirs(out_dir, exist_ok=True)
    n = 0
    for g, name in GROUPS.items():
        lines = [f"# {g}. {name}", "", "Generated from EDUCATION.md by `scripts/build_lore.py --lessons`; edit the source, not this file.", ""]
        for t in topics:
            if t["id"][0] != g:
                continue
            lines += [f"## {t['id']} {t['title']}", ""]
            simple = level_record(t, "SIMPLE")
            lines += [f"*{simple['markdown']}*", ""]
            for lv in ("BEGINNER", "INTERMEDIATE"):
                body = "\n".join(t["levels"].get(lv, [])).strip()
                lines += [f"### {lv.title()}", "", body, ""]
            lines += [f"Related: {', '.join(t['related'])}. In the game: {', '.join(t['game'])}.", ""]
        with open(os.path.join(out_dir, f"{g}.md"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines))
        n += 1
    return n


def main() -> int:
    check_only = "--check" in sys.argv
    with open(SRC, encoding="utf-8") as fh:
        text = fh.read()
    topics, labs, errors = parse(text)
    if "--lessons" in sys.argv:
        # Lesson pages need only the parsed text, not the pictures or labs.
        hard = [e for e in errors if "em dash" in e]
        if hard:
            print("\n".join(hard))
            return 1
        print(f"build_lore: wrote {write_lessons(topics)} lesson pages")
        return 0
    validate(topics, labs, errors)
    if errors:
        print("\n".join(errors))
        print(f"build_lore: {len(errors)} error(s)")
        return 1
    if check_only:
        print(f"build_lore: {len(topics)} topics, {len(labs)} labs ok")
        return 0
    # Clean output except hand-authored svg.
    for name in os.listdir(OUT) if os.path.isdir(OUT) else []:
        if name != "svg":
            path = os.path.join(OUT, name)
            shutil.rmtree(path) if os.path.isdir(path) else os.remove(path)
    os.makedirs(OUT, exist_ok=True)
    index = {"topics": [], "groups": GROUPS, "labs": labs}
    for t in topics:
        rec = {"id": t["id"], "group": t["id"][0], "title": t["title"], "tags": t["tags"], "related": t["related"], "game": t["game"], "levels": [lv for lv in LEVELS if lv in t["levels"]], "pictureId": level_record(t, "SIMPLE")["pictureId"], "demoId": level_record(t, "EXPERT")["demoId"]}
        index["topics"].append(rec)
        os.makedirs(os.path.join(OUT, t["id"]), exist_ok=True)
        for lv in LEVELS:
            if lv in t["levels"]:
                with open(os.path.join(OUT, t["id"], f"{lv}.json"), "w", encoding="utf-8") as fh:
                    json.dump(level_record(t, lv), fh, ensure_ascii=False, separators=(",", ":"))
    with open(os.path.join(OUT, "index.json"), "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
    size = os.path.getsize(os.path.join(OUT, "index.json"))
    print(f"build_lore: {len(topics)} topics x {len(LEVELS)} levels, index {size} bytes, {len(labs)} labs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
