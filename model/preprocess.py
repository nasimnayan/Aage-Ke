"""Text preprocessing for Aage Ke?. Mirrored exactly in app/model.js.

Steps (docs/03 CC2):
1. Unicode NFC
2. Remove ZWJ (U+200D) and ZWNJ (U+200C)
3. Lowercase Latin letters
4. Bangla digits to ASCII digits
5. Collapse any character repeated 3+ times to 2
6. Replace punctuation (anything not a letter, mark, digit or space) with spaces, collapse whitespace
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LABELS_PATH = ROOT / "data" / "labels_dengue.json"

_BN_DIGITS = {ord("০") + i: str(i) for i in range(10)}
_REPEAT = re.compile(r"(.)\1{2,}", re.DOTALL)
_SPACES = re.compile(r"\s+")


def _keep(ch):
    # Letters, combining marks (Bangla vowel signs, hasanta) and digits stay; the rest is punctuation.
    return unicodedata.category(ch)[0] in "LMN" or ch.isspace()


def preprocess(text):
    t = unicodedata.normalize("NFC", text or "")
    t = t.replace("‍", "").replace("‌", "")
    t = t.lower()
    t = t.translate(_BN_DIGITS)
    t = _REPEAT.sub(r"\1\1", t)
    t = "".join(ch if _keep(ch) else " " for ch in t)
    return _SPACES.sub(" ", t).strip()


def detect_script(text):
    """Share of Bangla-block characters among letters: >= 0.8 bn, <= 0.2 banglish, else mixed."""
    letters = [ch for ch in unicodedata.normalize("NFC", text or "") if unicodedata.category(ch)[0] in "LM"]
    if not letters:
        return "banglish"
    share = sum(1 for ch in letters if "ঀ" <= ch <= "৿") / len(letters)
    if share >= 0.8:
        return "bn"
    if share <= 0.2:
        return "banglish"
    return "mixed"


def load_labels(path=LABELS_PATH):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def label_keys(labels_json):
    return [x["key"] for x in labels_json["warning_signs"]] + [x["key"] for x in labels_json["status_labels"]]
