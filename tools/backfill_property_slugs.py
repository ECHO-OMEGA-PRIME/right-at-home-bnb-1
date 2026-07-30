#!/usr/bin/env python3
"""
Backfill Property.slug from the public catalogue (#26898).

WHY SLUG AND NOT Property.id
The public catalogue publishes ids like `Humble-3106`, and the lock hardware
names its devices `castleford` / `garfield` / `lincolngreen`. Both use the slug
scheme; neither uses Property.id (a cuid). So the slug is the real cross-system
key. It is ADDED rather than replacing Property.id, because a published id that
Airbnb/VRBO configs may already reference must not change underneath them.

MATCHING BY ADDRESS, NOT NAME
Slugs encode street + number (`Humble-3106` -> 3106 Humble), which matches the
database reliably. Names do not: the public catalogue lists slug
`blazing-saddle-2501` under the name "Mockingbird Ridge", while 2501 Blazing
Saddle Blvd and 4400 Mockingbird Ln are two different properties. Matching on
names would have silently written that error into the database.

Anything that does not match confidently is left NULL and printed. A wrong slug
is worse than a missing one: it would send a door code to the wrong house.

Usage:
    python tools/backfill_property_slugs.py            # dry run, prints the plan
    python tools/backfill_property_slugs.py --apply    # writes
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.request

CATALOGUE_URL = "https://rah-midland.com/api/properties"
WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "apps", "web")


def fetch_catalogue() -> list[dict]:
    with urllib.request.urlopen(CATALOGUE_URL, timeout=45) as r:
        return json.load(r)["properties"]


def slug_tokens(slug: str) -> tuple[str, str] | None:
    """Split `Humble-3106` / `lincoln-green-5055` into (street, number)."""
    m = re.match(r"^(.*?)[-_]?(\d{3,5})$", slug)
    if not m:
        return None
    street = re.sub(r"[-_]+", " ", m.group(1)).strip().lower()
    return (street, m.group(2)) if street else None


def address_tokens(address: str) -> tuple[str, str] | None:
    """Split `5055 Lincoln Green` into (street, number)."""
    m = re.match(r"^\s*(\d{3,5})\s+(.*)$", address)
    if not m:
        return None
    street = re.sub(r"\b(blvd|ln|st|street|drive|dr|ave|avenue|rd|road)\b", "", m.group(2).lower())
    street = re.sub(r"\s+", " ", street).strip()
    return (street, m.group(1))


def run_node(script: str) -> str:
    return subprocess.run(
        ["node", "-e", script], cwd=WEB_DIR, capture_output=True, text=True, check=True
    ).stdout


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="write the slugs (default: dry run)")
    args = ap.parse_args()

    catalogue = fetch_catalogue()
    props = json.loads(
        run_node(
            "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();"
            "p.property.findMany({select:{id:true,name:true,address:true,slug:true}})"
            ".then(r=>{console.log(JSON.stringify(r));return p.$disconnect()})"
        )
    )

    by_addr: dict[tuple[str, str], dict] = {}
    for pr in props:
        key = address_tokens(pr["address"] or "")
        if key:
            by_addr[key] = pr

    plan: list[tuple[dict, str]] = []
    unmatched_slugs: list[str] = []
    name_disagreements: list[str] = []
    taken: set[str] = set()
    leftovers: list[dict] = []

    # ---- pass 1: address (authoritative) -------------------------------
    for entry in catalogue:
        slug = entry["id"]
        key = slug_tokens(slug)
        prop = by_addr.get(key) if key else None
        if not prop or prop["id"] in taken:
            leftovers.append(entry)
            continue
        plan.append((prop, slug))
        taken.add(prop["id"])
        cat_name = (entry.get("name") or "").lower()
        db_name = (prop["name"] or "").lower()
        # Surfaced, never acted on. The address match is the authority.
        if cat_name and db_name and cat_name.split()[0] not in db_name:
            name_disagreements.append(
                f"{slug}: catalogue says '{entry.get('name')}' | database says '{prop['name']}' "
                f"[{prop['address']}]"
            )

    # ---- pass 2: name, ONLY where an address match was impossible ------
    #
    # Fourteen properties carry a vague address ("Midland", "Uptown area") with
    # no street number, so pass 1 could never reach them. Their names are
    # distinctive, but a name match is only accepted when it is UNIQUE in both
    # directions -- exactly one unclaimed property matches this slug's name, and
    # that property matches no other slug. A wrong slug sends a door code to the
    # wrong house, so an ambiguous match is left NULL on purpose.
    def norm(s: str) -> str:
        s = (s or "").lower().replace("&", " and ")
        s = re.sub(r"[^a-z0-9 ]+", " ", s)
        # "Pool & Billiards" and "Pool and Billiards" are the same name; drop the
        # conjunction entirely so the two spellings collapse together.
        s = re.sub(r"\band\b", " ", s)
        return re.sub(r"\s+", " ", s).strip()

    free = [p for p in props if p["id"] not in taken]

    def candidates(cat_name: str) -> list[dict]:
        c = norm(cat_name)
        if not c:
            return []
        hits = [p for p in free if norm(p["name"]) == c]
        if hits:
            return hits
        # Fall back to prefix containment (DB names are often longer, e.g.
        # "Patio Home with Hot Tub and multiple outdoor spaces").
        return [
            p for p in free if norm(p["name"]).startswith(c) or c.startswith(norm(p["name"]))
        ]

    for entry in leftovers:
        slug = entry["id"]
        hits = [h for h in candidates(entry.get("name", "")) if h["id"] not in taken]
        if len(hits) == 1:
            plan.append((hits[0], slug))
            taken.add(hits[0]["id"])
        else:
            why = "no name match" if not hits else f"AMBIGUOUS ({len(hits)} candidates)"
            unmatched_slugs.append(
                f"{slug}  (catalogue name: {entry.get('name', '?')}) -- {why}"
            )

    print(f"catalogue entries: {len(catalogue)}   database properties: {len(props)}")
    print(f"\nMATCHED BY ADDRESS ({len(plan)}):")
    for prop, slug in plan:
        print(f"  {slug:<22} -> {prop['address']:<30} | {prop['name'][:40]}")

    if unmatched_slugs:
        print(f"\nUNMATCHED, LEFT NULL ({len(unmatched_slugs)}) -- needs a human:")
        for s in unmatched_slugs:
            print(f"  {s}")

    if name_disagreements:
        print(f"\n! CATALOGUE/DATABASE NAME DISAGREEMENTS ({len(name_disagreements)}):")
        print("  Address match wins; these are reported, NOT written.")
        for d in name_disagreements:
            print(f"  {d}")

    if not args.apply:
        print("\nDRY RUN. Re-run with --apply to write.")
        return 0

    updates = ",".join(
        f"p.property.update({{where:{{id:{json.dumps(pr['id'])}}},data:{{slug:{json.dumps(sl)}}}}})"
        for pr, sl in plan
    )
    out = run_node(
        "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();"
        f"Promise.all([{updates}])"
        ".then(async r=>{console.log('updated',r.length);"
        "console.log('with slug now:',await p.property.count({where:{NOT:{slug:null}}}));"
        "return p.$disconnect()})"
    )
    print("\n" + out.strip())
    return 0


if __name__ == "__main__":
    sys.exit(main())
