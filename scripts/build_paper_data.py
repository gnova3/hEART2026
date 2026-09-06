#!/usr/bin/env python3
"""Build the static hEART 2026 paper catalogue from EasyChair HTML exports.

Run after downloading the three programme pages and the keyword index:
  python3 scripts/build_paper_data.py /tmp/heart29.html /tmp/heart30.html \
    /tmp/heart01.html --keywords /tmp/heart_keywords.html
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
import random
import re
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable


@dataclass
class Node:
    tag: str
    attrs: dict[str, str] = field(default_factory=dict)
    children: list["Node | str"] = field(default_factory=list)

    def classes(self) -> set[str]:
        return set(self.attrs.get("class", "").split())

    def text(self) -> str:
        value = "".join(c.text() if isinstance(c, Node) else c for c in self.children)
        return re.sub(r"\s+", " ", html.unescape(value)).strip()

    def descendants(self, tag: str | None = None, class_name: str | None = None) -> Iterable["Node"]:
        for child in self.children:
            if not isinstance(child, Node):
                continue
            if (tag is None or child.tag == tag) and (
                class_name is None or class_name in child.classes()
            ):
                yield child
            yield from child.descendants(tag, class_name)

    def first(self, tag: str | None = None, class_name: str | None = None) -> "Node | None":
        return next(self.descendants(tag, class_name), None)


class TreeParser(HTMLParser):
    voids = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node("document")
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag, {key: value or "" for key, value in attrs})
        self.stack[-1].children.append(node)
        if tag not in self.voids:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        self.handle_starttag(tag, attrs)
        if tag not in self.voids:
            self.stack.pop()

    def handle_endtag(self, tag: str) -> None:
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                self.stack = self.stack[:index]
                return

    def handle_data(self, data: str) -> None:
        self.stack[-1].children.append(data)


def parse(path: Path) -> Node:
    parser = TreeParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser.root


def clean_track(session: str) -> str:
    name = re.sub(r"^Session\s+[^:]+:\s*", "", session)
    name = re.sub(r"^\[[^]]+\]\s*", "", name)
    return re.sub(r"\s+\d+$", "", name).strip()


def parse_keywords(path: Path) -> dict[str, list[str]]:
    root = parse(path)
    keyword_map: dict[str, list[str]] = defaultdict(list)
    for row in root.descendants("tr", "entry"):
        name = row.first("td", "name")
        if not name:
            continue
        keyword = name.text()
        for anchor in row.descendants("a"):
            match = re.search(r"#talk:(\d+)", anchor.attrs.get("href", ""))
            if match and keyword not in keyword_map[match.group(1)]:
                keyword_map[match.group(1)].append(keyword)
    return keyword_map


def parse_day(path: Path, date: str, keyword_map: dict[str, list[str]]) -> list[dict]:
    root = parse(path)
    papers = []
    source = f"https://easychair.org/smart-program/hEART2026/{date}.html"
    for session in root.descendants("div", "session"):
        session_title_node = session.first("span", "title")
        talks = list(session.descendants("tr", "talk"))
        if not session_title_node or not talks:
            continue
        session_title = session_title_node.text()
        interval = session.first("span", "interval")
        room = session.first("span", "room_name")
        for talk in talks:
            anchor = next((a for a in talk.descendants("a") if a.attrs.get("name", "").startswith("talk:")), None)
            paper_id = anchor.attrs["name"].split(":", 1)[1] if anchor else ""
            title = talk.first("div", "title")
            abstract = talk.first("div", "abstract")
            authors_node = talk.first("div", "authors")
            presenter_node = talk.first("div", "presenter")
            time_node = talk.first("td", "time")
            if not paper_id or not title or not abstract:
                continue
            authors = [person.text() for person in authors_node.descendants("a", "person")] if authors_node else []
            presenter_link = presenter_node.first("a", "person") if presenter_node else None
            abstract_text = re.sub(r"^ABSTRACT\.\s*", "", abstract.text(), flags=re.I)
            presentation_type = "Poster" if "[Poster]" in session_title else "Podium" if "[Podium]" in session_title else "Talk"
            papers.append(
                {
                    "id": paper_id,
                    "title": title.text(),
                    "authors": authors,
                    "presenter": presenter_link.text() if presenter_link else "",
                    "abstract": abstract_text,
                    "keywords": keyword_map.get(paper_id, []),
                    "date": date,
                    "time": time_node.text() if time_node else "",
                    "sessionInterval": interval.text() if interval else "",
                    "session": session_title,
                    "track": clean_track(session_title),
                    "room": room.text() if room else "",
                    "type": presentation_type,
                    "url": f"{source}#talk:{paper_id}",
                }
            )
    return papers


TOKEN_RE = re.compile(r"[a-z][a-z0-9-]{2,}")
STOPWORDS = set("a an and are as at be been being by can could do does for from had has have how in into is it its may more most new no not of on one or other our over paper proposed results show study such than that the their these this through to two use used using was we were which while with within without".split())


def tokenize(paper: dict) -> list[str]:
    text = f"{paper['title']} {paper['title']} {paper['abstract']} {' '.join(paper['keywords'])}".lower()
    return [token for token in TOKEN_RE.findall(text) if token not in STOPWORDS]


def add_projection(papers: list[dict]) -> None:
    docs = [Counter(tokenize(p)) for p in papers]
    document_frequency = Counter(token for doc in docs for token in doc)
    total = len(papers)
    vectors: list[dict[str, float]] = []
    for doc in docs:
        vector = {
            token: (1 + math.log(count)) * math.log((1 + total) / (1 + document_frequency[token]))
            for token, count in doc.items()
        }
        norm = math.sqrt(sum(value * value for value in vector.values())) or 1
        vectors.append({token: value / norm for token, value in vector.items()})

    similarities = [[0.0] * total for _ in range(total)]
    for i, left in enumerate(vectors):
        similarities[i][i] = 1.0
        for j in range(i):
            right = vectors[j]
            small, large = (left, right) if len(left) < len(right) else (right, left)
            score = sum(value * large.get(token, 0.0) for token, value in small.items())
            similarities[i][j] = similarities[j][i] = score

    means = [sum(row) / total for row in similarities]
    grand_mean = sum(means) / total
    centered = [[similarities[i][j] - means[i] - means[j] + grand_mean for j in range(total)] for i in range(total)]

    def multiply(vector: list[float]) -> list[float]:
        return [sum(row[j] * vector[j] for j in range(total)) for row in centered]

    eigenvectors: list[list[float]] = []
    eigenvalues: list[float] = []
    rng = random.Random(2026)
    for _ in range(2):
        vector = [rng.random() - 0.5 for _ in range(total)]
        for _iteration in range(80):
            candidate = multiply(vector)
            for previous in eigenvectors:
                dot = sum(a * b for a, b in zip(candidate, previous))
                candidate = [a - dot * b for a, b in zip(candidate, previous)]
            norm = math.sqrt(sum(value * value for value in candidate)) or 1
            vector = [value / norm for value in candidate]
        product = multiply(vector)
        eigenvectors.append(vector)
        eigenvalues.append(max(0.0, sum(a * b for a, b in zip(vector, product))))

    axes = [[eigenvectors[axis][i] * math.sqrt(eigenvalues[axis]) for i in range(total)] for axis in range(2)]
    for axis in axes:
        minimum, maximum = min(axis), max(axis)
        span = maximum - minimum or 1
        for i in range(total):
            axis[i] = 5 + 90 * (axis[i] - minimum) / span
    for index, paper in enumerate(papers):
        paper["x"] = round(axes[0][index], 2)
        paper["y"] = round(axes[1][index], 2)


def build_stats(papers: list[dict]) -> dict:
    keyword_counts = Counter(keyword.casefold() for paper in papers for keyword in paper["keywords"])
    keyword_display = {}
    for paper in papers:
        for keyword in paper["keywords"]:
            keyword_display.setdefault(keyword.casefold(), keyword)
    track_counts = Counter(paper["track"] for paper in papers)
    author_counts = Counter(author for paper in papers for author in paper["authors"])
    return {
        "paperCount": len(papers),
        "authorCount": len(author_counts),
        "sessionCount": len({paper["session"] for paper in papers}),
        "keywordCount": len(keyword_counts),
        "topKeywords": [
            {"name": keyword_display[key], "count": count}
            for key, count in keyword_counts.most_common(40)
        ],
        "tracks": [{"name": name, "count": count} for name, count in track_counts.most_common()],
        "prolificAuthors": [{"name": name, "count": count} for name, count in author_counts.most_common(12)],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pages", nargs=3, type=Path)
    parser.add_argument("--keywords", required=True, type=Path)
    parser.add_argument("--output", type=Path, default=Path("public/data/papers.json"))
    args = parser.parse_args()
    keyword_map = parse_keywords(args.keywords)
    dates = ["2026-09-29", "2026-09-30", "2026-10-01"]
    papers = [paper for page, date in zip(args.pages, dates) for paper in parse_day(page, date, keyword_map)]
    add_projection(papers)
    payload = {"generatedAt": "2026-09-06", "papers": papers, "stats": build_stats(papers)}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(papers)} papers to {args.output}")


if __name__ == "__main__":
    main()
