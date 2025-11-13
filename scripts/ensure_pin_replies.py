#!/usr/bin/env python3
"""Ensure every pin in sample data has at least 2-3 replies."""
from __future__ import annotations

import json
import random
import secrets
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "docs" / "mongodb-local-sample-data"

random.seed(99)


def load(name: str) -> Any:
    return json.loads((DATA_DIR / name).read_text())


def dump(name: str, data: Any) -> None:
    (DATA_DIR / name).write_text(json.dumps(data, indent=2) + "\n")


def oid_value(obj: Dict[str, str] | None) -> str | None:
    if isinstance(obj, dict):
        return obj.get("$oid")
    return None


def iso_date(dt: datetime) -> Dict[str, str]:
    return {"$date": dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")}


def gibberish() -> str:
    syllables = [
        "zor",
        "plix",
        "melo",
        "drim",
        "kyu",
        "vex",
        "luma",
        "riff",
        "scof",
        "bloop",
    ]
    words = [random.choice(syllables) + random.choice(["", random.choice(syllables)]) for _ in range(random.randint(3, 6))]
    flair = random.choice(["!", "?", "...", "!!!"])
    return " ".join(words).capitalize() + flair


def playful_sentence(pin_title: str) -> str:
    templates = [
        "{noise} calibrating vibes around '{title}'",
        "{noise} pls bring more snacks to '{title}'",
        "{noise} someone left a paddle at '{title}'",
        "{noise} thread drift achieved near '{title}'",
    ]
    return random.choice(templates).format(noise=gibberish(), title=pin_title)


def main() -> None:
    users = load("mongodb-sample-users.json")
    pins = load("mongodb-sample-pins.json")
    replies = load("mongodb-sample-replies.json")

    user_ids = [oid_value(u["_id"]) for u in users]
    user_lookup = {oid_value(u["_id"]): u for u in users}

    used_reply_ids = {oid_value(r["_id"]) for r in replies}

    def new_oid() -> str:
        while True:
            candidate = secrets.token_hex(12)
            if candidate not in used_reply_ids:
                used_reply_ids.add(candidate)
                return candidate

    reply_counts = Counter()
    for reply in replies:
        pid = oid_value(reply.get("pinId"))
        if pid:
            reply_counts[pid] += 1

    new_replies: List[Dict[str, Any]] = []
    baseline = datetime(2026, 8, 1, 12, 0, tzinfo=timezone.utc)

    for pin in pins:
        pid = oid_value(pin["_id"])
        if not pid:
            continue
        existing = reply_counts.get(pid, 0)
        if existing >= 2:
            continue
        target = random.choice([2, 3])
        needed = target - existing
        if needed <= 0:
            continue
        if pin["type"] == "event":
            attendee_ids = [oid_value(a) for a in pin.get("attendingUserIds", []) or []]
            pool = [uid for uid in attendee_ids if uid] or user_ids
        else:
            pool = user_ids
        pool = pool or user_ids
        available = pool.copy()
        random.shuffle(available)
        parent_id = None
        for i in range(needed):
            if not available:
                available = pool.copy()
                random.shuffle(available)
            author_id = available.pop()
            reply_id = new_oid()
            created = baseline + timedelta(days=random.randint(0, 30), minutes=random.randint(0, 720))
            message = playful_sentence(pin.get("title", "a pin"))
            payload = {
                "_id": {"$oid": reply_id},
                "pinId": {"$oid": pid},
                "parentReplyId": {"$oid": parent_id} if parent_id and random.random() < 0.6 else None,
                "authorId": {"$oid": author_id},
                "message": message,
                "attachments": [],
                "reactions": [],
                "mentionedUserIds": [],
                "audit": {"createdBy": {"$oid": author_id}},
                "createdAt": iso_date(created),
                "updatedAt": iso_date(created),
            }
            new_replies.append(payload)
            parent_id = reply_id
            reply_counts[pid] += 1

    if not new_replies:
        print("All pins already satisfied minimum replies.")
    else:
        replies.extend(new_replies)
        dump("mongodb-sample-replies.json", replies)
        print(f"Added {len(new_replies)} replies across {len({oid_value(r['pinId']) for r in new_replies})} pins.")

    # Update pin stats
    if new_replies:
        counts = Counter()
        for reply in replies:
            pid = oid_value(reply.get("pinId"))
            if pid:
                counts[pid] += 1
        for pin in pins:
            pid = oid_value(pin["_id"])
            c = counts.get(pid, 0)
            pin["replyCount"] = c
            pin.setdefault("stats", {})["replyCount"] = c
        dump("mongodb-sample-pins.json", pins)


if __name__ == "__main__":
    main()
