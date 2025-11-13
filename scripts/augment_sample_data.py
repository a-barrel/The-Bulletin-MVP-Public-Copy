#!/usr/bin/env python3
"""Augment MongoDB sample data with richer pins, bookmarks, replies, and chat content."""
from __future__ import annotations

import json
import math
import random
import secrets
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "docs" / "mongodb-local-sample-data"

random.seed(42)

def load(path: Path) -> Any:
    with path.open() as fh:
        return json.load(fh)


def dump(path: Path, data: Any) -> None:
    with path.open("w") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")


def collect_oids(node: Any, bucket: set[str]) -> None:
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "$oid" and isinstance(value, str):
                bucket.add(value)
            else:
                collect_oids(value, bucket)
    elif isinstance(node, list):
        for item in node:
            collect_oids(item, bucket)


def oid_value(oid_obj: Dict[str, str]) -> str:
    return oid_obj["$oid"]


def date_value(date_obj: Dict[str, str]) -> datetime:
    return datetime.fromisoformat(date_obj["$date"].replace("Z", "+00:00"))


class SampleData:
    def __init__(self) -> None:
        self.users = load(DATA_DIR / "mongodb-sample-users.json")
        self.pins = load(DATA_DIR / "mongodb-sample-pins.json")
        self.bookmarks = load(DATA_DIR / "mongodb-sample-bookmarks.json")
        self.replies = load(DATA_DIR / "mongodb-sample-replies.json")
        self.chat_messages = load(DATA_DIR / "mongodb-sample-proximityChatMessages.json")
        self.chat_presence = load(DATA_DIR / "mongodb-sample-proximityChatPresence.json")
        self.chat_rooms = load(DATA_DIR / "mongodb-sample-proximityChatRooms.json")

        self.used_oids: set[str] = set()
        for dataset in [
            self.users,
            self.pins,
            self.bookmarks,
            self.replies,
            self.chat_messages,
            self.chat_presence,
            self.chat_rooms,
        ]:
            collect_oids(dataset, self.used_oids)

        self.user_lookup = {oid_value(user["_id"]): user for user in self.users}
        self.pin_lookup = {oid_value(pin["_id"]): pin for pin in self.pins}

    def new_oid(self) -> str:
        while True:
            candidate = secrets.token_hex(12)
            if candidate not in self.used_oids:
                self.used_oids.add(candidate)
                return candidate

    def oid_ref(self, oid: str) -> Dict[str, str]:
        return {"$oid": oid}

    @staticmethod
    def iso_date(dt: datetime) -> Dict[str, str]:
        return {"$date": dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")}

    def photo_payload(self, path: str) -> Dict[str, Any]:
        return {
            "url": path,
            "thumbnailUrl": path,
            "width": 512,
            "height": 512,
            "mimeType": "image/jpeg",
        }

    def avatar_payload(self, user: Dict[str, Any]) -> Dict[str, Any]:
        avatar = deepcopy(user.get("avatar"))
        if not avatar:
            avatar = {
                "url": "/images/profile/profile-01",
                "thumbnailUrl": "/images/profile/profile-01",
                "width": 128,
                "height": 128,
                "mimeType": "image/jpeg",
                "uploadedAt": self.iso_date(datetime(2026, 8, 1, tzinfo=timezone.utc)),
            }
        return avatar


def build_titles(prefixes: List[str], subjects: List[str], suffixes: List[str], needed: int) -> List[str]:
    combos: List[str] = []
    for p in prefixes:
        for s in subjects:
            for suf in suffixes:
                combos.append(f"{p} {s} {suf}".strip())
    random.shuffle(combos)
    if len(combos) < needed:
        raise ValueError("Not enough title combinations")
    return combos[:needed]


def random_coordinate() -> Dict[str, Any]:
    lat = 33.7838 + random.uniform(-0.012, 0.012)
    lon = -118.1136 + random.uniform(-0.02, 0.02)
    return {
        "type": "Point",
        "coordinates": [round(lon, 6), round(lat, 6)],
        "accuracy": random.randint(5, 12),
    }


def precise_address() -> Dict[str, Any]:
    anchors = [
        ("Marine Stadium Launch", "5255 Paoli Way"),
        ("CSULB Rec Fields", "1250 N Bellflower Blvd"),
        ("Bluff Park Meetup", "2500 E Ocean Blvd"),
        ("Colorado Lagoon Hub", "5119 E Colorado St"),
        ("Palo Verde Pit Zone", "1800 Palo Verde Ave"),
        ("Los Altos Lot", "2250 Bellflower Blvd"),
    ]
    label, line1 = random.choice(anchors)
    return {
        "precise": label,
        "components": {
            "line1": line1,
            "city": "Long Beach",
            "state": "CA",
            "postalCode": "90840",
            "country": "USA",
        },
    }


def approx_city() -> Dict[str, str]:
    return {
        "city": "Long Beach",
        "state": "CA",
        "country": "USA",
        "formatted": "Long Beach, CA",
    }


def gibberish() -> str:
    syllables = ["zor", "bex", "malo", "quin", "riff", "plom", "zeta", "kyu", "vex", "luma"]
    words = [random.choice(syllables) + random.choice(["", random.choice(syllables)]) for _ in range(random.randint(3, 7))]
    return " ".join(words).capitalize() + "!"


def pluralize(word: str, count: int) -> str:
    return f"{count} {word}{'' if count == 1 else 's'}"


def main() -> None:
    data = SampleData()
    user_ids = list(data.user_lookup.keys())

    event_photos = [f"/images/event/event-{i:02d}" for i in range(21, 71)]
    discussion_photos = [f"/images/discussion/discussion-{i:02d}" for i in range(21, 71)]
    random.shuffle(event_photos)
    random.shuffle(discussion_photos)

    existing_pin_types = {oid_value(pin["_id"]): pin["type"] for pin in data.pins}

    # Bookmark quotas to reach 12 event bookmarks per user
    from collections import Counter

    event_bookmark_counts = Counter()
    for bm in data.bookmarks:
        pid = oid_value(bm["pinId"])
        uid = oid_value(bm["userId"])
        if existing_pin_types.get(pid) == "event":
            event_bookmark_counts[uid] += 1
    bookmark_quota = {uid: max(12 - event_bookmark_counts.get(uid, 0), 0) for uid in user_ids}

    linked_location = data.oid_ref("68e061721329566a22d474c2")

    event_titles = build_titles(
        ["Neon", "Sunset", "Retro", "Velocity", "Lagoon", "Cosmic"],
        ["Kayak", "Trail", "Dive", "Dirt", "Scuba", "Board", "Drone"],
        ["Sprint", "Mixer", "Derby", "Carnival", "Showcase", "Symposium"],
        40,
    )
    discussion_titles = build_titles(
        ["Quiet", "Chaotic", "Lo-Fi", "Skyline", "Mesa", "Quantum"],
        ["Signal", "Thread", "Camp", "Desk", "Idea", "Patch"],
        ["Circle", "Lab", "Club", "Forum", "Bazaar", "Pocket"],
        40,
    )

    new_pins: List[Dict[str, Any]] = []
    pin_meta: Dict[str, Dict[str, Any]] = {}

    base_start = datetime(2026, 3, 1, 17, 0, tzinfo=timezone.utc)

    def pick_attendees(target: int) -> List[str]:
        chosen: List[str] = []
        available = user_ids.copy()
        random.shuffle(available)
        for _ in range(target):
            if not available:
                available = user_ids.copy()
            candidate = max(
                available,
                key=lambda uid: (bookmark_quota.get(uid, 0), random.random()),
            )
            available.remove(candidate)
            chosen.append(candidate)
            if bookmark_quota.get(candidate, 0) > 0:
                bookmark_quota[candidate] -= 1
        return chosen

    def ensure_min_bookmarks(assignments: Dict[str, List[str]]) -> None:
        for uid, needed in list(bookmark_quota.items()):
            while needed > 0:
                pin_id = random.choice(list(assignments.keys()))
                if uid in assignments[pin_id]:
                    continue
                assignments[pin_id].append(uid)
                needed -= 1
            bookmark_quota[uid] = 0

    event_bookmark_assignments: Dict[str, List[str]] = {}

    for idx in range(40):
        pin_id = data.new_oid()
        photo_path = event_photos[idx % len(event_photos)]
        attendees = pick_attendees(random.randint(5, 6))
        event_bookmark_assignments[pin_id] = attendees.copy()

        start_dt = base_start + timedelta(days=idx * 2)
        end_dt = start_dt + timedelta(hours=random.randint(2, 5))
        expires_dt = end_dt + timedelta(days=30)

        tags = random.sample([
            "kayak",
            "offroad",
            "scuba",
            "photo",
            "debug",
            "training",
            "demo",
            "music",
        ], 3)

        pin_payload = {
            "_id": data.oid_ref(pin_id),
            "type": "event",
            "creatorId": data.oid_ref(random.choice(user_ids)),
            "title": event_titles[idx],
            "description": (
                "Hands-on session featuring "
                + random.choice([
                    "kayaks",
                    "dirt rigs",
                    "reef drones",
                    "camera sleds",
                    "trail beacons",
                ])
                + ". Expect ridiculous banter and impromptu challenges."
            ),
            "coordinates": random_coordinate(),
            "address": precise_address(),
            "proximityRadiusMeters": random.choice([800, 1000, 1200]),
            "photos": [data.photo_payload(photo_path)],
            "coverPhoto": data.photo_payload(photo_path),
            "tagIds": [],
            "tags": tags,
            "options": {
                "allowBookmarks": True,
                "allowShares": True,
                "allowReplies": True,
                "showAttendeeList": True,
                "featured": False,
                "visibilityMode": "map-and-list",
                "reminderMinutesBefore": random.choice([30, 45, 60]),
            },
            "relatedPinIds": [],
            "linkedLocationId": linked_location,
            "linkedChatRoomId": None,
            "visibility": "public",
            "isActive": True,
            "attendingUserIds": [data.oid_ref(uid) for uid in attendees],
            "attendeeWaitlistIds": [],
            "attendable": True,
            "participantLimit": random.choice([40, 60, 80, 120]),
            "participantCount": len(attendees),
            "startDate": data.iso_date(start_dt),
            "endDate": data.iso_date(end_dt),
            "stats": {
                "bookmarkCount": 0,
                "replyCount": 0,
                "shareCount": random.randint(0, 5),
                "viewCount": random.randint(120, 800),
            },
            "bookmarkCount": 0,
            "replyCount": 0,
            "descriptionHasMarkdown": False,
            "createdAt": data.iso_date(start_dt - timedelta(days=5)),
            "updatedAt": data.iso_date(start_dt - timedelta(days=5)),
            "expiresAt": data.iso_date(expires_dt),
        }
        new_pins.append(pin_payload)
        pin_meta[pin_id] = {
            "type": "event",
            "attendees": attendees,
            "title": event_titles[idx],
            "photo": photo_path,
        }

    # ensure quotas satisfied
    ensure_min_bookmarks(event_bookmark_assignments)

    for idx in range(40):
        pin_id = data.new_oid()
        photo_path = discussion_photos[idx % len(discussion_photos)]
        start_dt = base_start + timedelta(days=idx)
        expires_dt = start_dt + timedelta(days=90)
        tags = random.sample([
            "chat",
            "debug",
            "design",
            "surf",
            "grid",
            "map",
            "qa",
            "coffee",
        ], 3)
        pin_payload = {
            "_id": data.oid_ref(pin_id),
            "type": "discussion",
            "creatorId": data.oid_ref(random.choice(user_ids)),
            "title": discussion_titles[idx],
            "description": "Open mic for nonsense theories, waypoint lore, and snack trades.",
            "coordinates": random_coordinate(),
            "approximateAddress": approx_city(),
            "proximityRadiusMeters": random.choice([400, 600, 800]),
            "photos": [data.photo_payload(photo_path)],
            "coverPhoto": data.photo_payload(photo_path),
            "tagIds": [],
            "tags": tags,
            "options": {
                "allowBookmarks": True,
                "allowShares": True,
                "allowReplies": True,
                "showAttendeeList": False,
                "visibilityMode": "map-and-list",
                "featured": False,
            },
            "relatedPinIds": [],
            "linkedLocationId": linked_location,
            "linkedChatRoomId": None,
            "visibility": "public",
            "isActive": True,
            "participantCount": 0,
            "autoDelete": False,
            "stats": {
                "bookmarkCount": 0,
                "replyCount": 0,
                "shareCount": random.randint(0, 3),
                "viewCount": random.randint(60, 420),
            },
            "bookmarkCount": 0,
            "replyCount": 0,
            "createdAt": data.iso_date(start_dt - timedelta(days=3)),
            "updatedAt": data.iso_date(start_dt - timedelta(days=3)),
            "expiresAt": data.iso_date(expires_dt),
        }
        new_pins.append(pin_payload)
        pin_meta[pin_id] = {
            "type": "discussion",
            "title": discussion_titles[idx],
            "photo": photo_path,
        }

    data.pins.extend(new_pins)
    for pin in new_pins:
        pid = oid_value(pin["_id"])
        data.pin_lookup[pid] = pin
        existing_pin_types[pid] = pin["type"]

    # Replies
    new_replies: List[Dict[str, Any]] = []
    for pin_id, meta in pin_meta.items():
        pin_type = meta["type"]
        participant_pool = (
            meta.get("attendees", []) if pin_type == "event" else user_ids
        )
        reply_authors = random.sample(participant_pool, min(len(participant_pool), 3))
        parent_id = None
        for idx, author_id in enumerate(reply_authors):
            reply_id = data.new_oid()
            message = (
                "Splatwave latency check" if pin_type == "event" else "Thread drift accepted"
            )
            snippet_bank = [
                "blip", "swoop", "gloop", "kay-mode", "debug dribble", "calico loop",
            ]
            message = f"{random.choice(snippet_bank)} : {gibberish()}"
            reply_payload = {
                "_id": data.oid_ref(reply_id),
                "pinId": data.oid_ref(pin_id),
                "parentReplyId": data.oid_ref(parent_id) if parent_id else None,
                "authorId": data.oid_ref(author_id),
                "message": message,
                "attachments": [],
                "reactions": [],
                "mentionedUserIds": [],
                "audit": {"createdBy": data.oid_ref(author_id)},
                "createdAt": data.iso_date(datetime(2026, 6, 1, tzinfo=timezone.utc) + timedelta(days=random.randint(0, 60))),
                "updatedAt": data.iso_date(datetime(2026, 6, 1, tzinfo=timezone.utc) + timedelta(days=random.randint(0, 60))),
            }
            new_replies.append(reply_payload)
            if idx == 0:
                parent_id = reply_id
        meta["reply_count"] = len(reply_authors)

    data.replies.extend(new_replies)

    # Bookmarks
    new_bookmarks: List[Dict[str, Any]] = []
    bookmark_pairs = {(oid_value(bm["userId"]), oid_value(bm["pinId"])) for bm in data.bookmarks}

    for pin_id, meta in pin_meta.items():
        if meta["type"] == "event":
            users_for_pin = event_bookmark_assignments.get(pin_id, meta.get("attendees", []))
        else:
            users_for_pin = random.sample(user_ids, 4)
        notes_template = {
            "event": "Stack extras for {}",
            "discussion": "Clip notes for {}",
        }
        for uid in users_for_pin:
            if (uid, pin_id) in bookmark_pairs:
                continue
            bookmark_pairs.add((uid, pin_id))
            bookmark_id = data.new_oid()
            stamp = datetime(2026, 7, 1, tzinfo=timezone.utc) + timedelta(days=random.randint(0, 45))
            payload = {
                "_id": data.oid_ref(bookmark_id),
                "userId": data.oid_ref(uid),
                "pinId": data.oid_ref(pin_id),
                "collectionId": None,
                "notes": notes_template[meta["type"]].format(meta["title"]),
                "reminderAt": None,
                "tagIds": [],
                "audit": {
                    "createdBy": data.oid_ref(uid),
                    "updatedBy": data.oid_ref(uid),
                },
                "createdAt": data.iso_date(stamp),
                "updatedAt": data.iso_date(stamp),
            }
            new_bookmarks.append(payload)

    data.bookmarks.extend(new_bookmarks)

    # Chat conversation for CSULB Grid R2C3 (room id ...007)
    room_id = "68e061721329566a22d40007"
    chat_room = next(room for room in data.chat_rooms if oid_value(room["_id"]) == room_id)

    chat_start = datetime(2026, 10, 21, 18, 0, tzinfo=timezone.utc)
    attachments_pool = [
        "/images/discussion/discussion-05",
        "/images/event/event-12",
        "/images/discussion/discussion-33",
        "/images/event/event-27",
    ]
    new_messages: List[Dict[str, Any]] = []

    for idx, uid in enumerate(user_ids):
        msg_id = data.new_oid()
        author = data.user_lookup[uid]
        dt = chat_start + timedelta(minutes=idx * 2)
        attachments = []
        if idx % 3 == 0:
            image_path = random.choice(attachments_pool)
            attachments = [
                {
                    "type": "image",
                    **data.photo_payload(image_path),
                }
            ]
        payload = {
            "_id": data.oid_ref(msg_id),
            "roomId": data.oid_ref(room_id),
            "pinId": None,
            "authorId": data.oid_ref(uid),
            "replyToMessageId": None,
            "message": gibberish(),
            "coordinates": random_coordinate(),
            "attachments": attachments,
            "audit": {"createdBy": data.oid_ref(uid)},
            "createdAt": data.iso_date(dt),
            "updatedAt": data.iso_date(dt),
            "author": {
                "_id": data.oid_ref(uid),
                "username": author["username"],
                "displayName": author["displayName"],
                "avatar": data.avatar_payload(author),
            },
            "authorAvatar": data.avatar_payload(author),
        }
        new_messages.append(payload)

    data.chat_messages.extend(new_messages)

    new_presence: List[Dict[str, Any]] = []
    for idx, uid in enumerate(user_ids):
        presence_id = data.new_oid()
        session_id = data.new_oid()
        joined = chat_start + timedelta(minutes=idx)
        last_active = joined + timedelta(minutes=5 + idx % 4)
        new_presence.append(
            {
                "_id": data.oid_ref(presence_id),
                "roomId": data.oid_ref(room_id),
                "userId": data.oid_ref(uid),
                "sessionId": data.oid_ref(session_id),
                "joinedAt": data.iso_date(joined),
                "lastActiveAt": data.iso_date(last_active),
            }
        )
    data.chat_presence.extend(new_presence)

    chat_room["participantIds"] = [data.oid_ref(uid) for uid in user_ids]
    chat_room["participantCount"] = len(user_ids)

    # Recalculate stats
    bookmark_counts = Counter()
    for bm in data.bookmarks:
        bookmark_counts[oid_value(bm["pinId"])] += 1
    reply_counts = Counter()
    for reply in data.replies:
        reply_counts[oid_value(reply["pinId"])] += 1

    for pin in data.pins:
        pid = oid_value(pin["_id"])
        b_count = bookmark_counts.get(pid, 0)
        r_count = reply_counts.get(pid, 0)
        pin["bookmarkCount"] = b_count
        pin["replyCount"] = r_count
        if "stats" not in pin:
            pin["stats"] = {}
        pin["stats"]["bookmarkCount"] = b_count
        pin["stats"]["replyCount"] = r_count
        if pin["type"] == "event":
            attendees = pin.get("attendingUserIds", [])
            pin["participantCount"] = len(attendees)

    # Update user bookmark stats
    user_bookmarks = Counter()
    for bm in data.bookmarks:
        user_bookmarks[oid_value(bm["userId"])] += 1
    for user in data.users:
        uid = oid_value(user["_id"])
        stats = user.get("stats") or {}
        stats["bookmarks"] = user_bookmarks.get(uid, 0)
        user["stats"] = stats

    # Persist
    dump(DATA_DIR / "mongodb-sample-pins.json", data.pins)
    dump(DATA_DIR / "mongodb-sample-replies.json", data.replies)
    dump(DATA_DIR / "mongodb-sample-bookmarks.json", data.bookmarks)
    dump(DATA_DIR / "mongodb-sample-users.json", data.users)
    dump(DATA_DIR / "mongodb-sample-proximityChatMessages.json", data.chat_messages)
    dump(DATA_DIR / "mongodb-sample-proximityChatPresence.json", data.chat_presence)
    dump(DATA_DIR / "mongodb-sample-proximityChatRooms.json", data.chat_rooms)


if __name__ == "__main__":
    main()
