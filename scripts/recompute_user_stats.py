#!/usr/bin/env python3
"""Recompute user stats (bookmarks, events hosted/attended, posts) from sample data."""
from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any, Dict

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "docs" / "mongodb-local-sample-data"


def load(name: str) -> Any:
    return json.loads((DATA_DIR / name).read_text())


def dump(name: str, data: Any) -> None:
    (DATA_DIR / name).write_text(json.dumps(data, indent=2) + "\n")


def oid_value(obj: Dict[str, str] | None) -> str | None:
    if isinstance(obj, dict):
        return obj.get("$oid")
    return None


def main() -> None:
    users = load("mongodb-sample-users.json")
    pins = load("mongodb-sample-pins.json")
    bookmarks = load("mongodb-sample-bookmarks.json")
    replies = load("mongodb-sample-replies.json")

    bookmark_counts = Counter()
    for bm in bookmarks:
        uid = oid_value(bm.get("userId"))
        if uid:
            bookmark_counts[uid] += 1

    events_hosted = Counter()
    events_attended = Counter()
    for pin in pins:
        pid_type = pin.get("type")
        creator = oid_value(pin.get("creatorId"))
        if pid_type == "event" and creator:
            events_hosted[creator] += 1
        if pid_type == "event":
            for attendee in pin.get("attendingUserIds", []) or []:
                attendee_id = oid_value(attendee)
                if attendee_id:
                    events_attended[attendee_id] += 1

    reply_counts = Counter()
    for reply in replies:
        author = oid_value(reply.get("authorId"))
        if author:
            reply_counts[author] += 1

    for user in users:
        uid = oid_value(user.get("_id"))
        if not uid:
            continue
        stats = user.get("stats") or {}
        stats["bookmarks"] = bookmark_counts.get(uid, 0)
        stats["eventsHosted"] = events_hosted.get(uid, 0)
        stats["eventsAttended"] = events_attended.get(uid, 0)
        stats["posts"] = reply_counts.get(uid, 0)
        user["stats"] = stats

    dump("mongodb-sample-users.json", users)


if __name__ == "__main__":
    main()
