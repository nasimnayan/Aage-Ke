"""Vocabulary-coverage threshold for the "unfamiliar wording" flag (dev split only).

Coverage of a message = share of its character n-grams (char_wb, 2 to 5) that are in the
model's vocabulary. The vectoriser is fitted on the training split, coverage is measured on
the dev split (same split and seed as train.py), and the threshold is the dev minimum:
a message less familiar than every dev message is flagged. Test sets are never read.
Writes results/coverage_threshold.json; export.py copies the threshold into the model file.
"""
import json
import sys
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parent))
from preprocess import preprocess  # noqa: E402
from train import load_train, SEED  # noqa: E402

HERE = Path(__file__).resolve().parent


def coverage(analyzer, vocab, text):
    grams = analyzer(preprocess(text))
    return float(np.mean([g in vocab for g in grams])) if grams else 0.0


def main():
    d, _ = load_train()
    primary = d["labels"].map(lambda s: s.split("|")[0] if s else "none")
    tr, dev = train_test_split(d, test_size=0.2, stratify=primary, random_state=SEED)
    vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), max_features=4000, sublinear_tf=True)
    vec.fit([preprocess(t) for t in tr["text"]])
    an, vocab = vec.build_analyzer(), vec.vocabulary_
    cov = np.array([coverage(an, vocab, t) for t in dev["text"]])
    report = {
        "method": "dev minimum of char n-gram vocabulary coverage; vectoriser fitted on the 80% train split",
        "dev_rows": int(len(cov)),
        "threshold": round(float(cov.min()), 3),
        "dev_min": round(float(cov.min()), 3), "dev_p1": round(float(np.percentile(cov, 1)), 3),
        "dev_p5": round(float(np.percentile(cov, 5)), 3), "dev_median": round(float(np.median(cov)), 3),
        "dev_share_flagged": float(np.mean(cov < cov.min())),
    }
    (HERE / "results").mkdir(exist_ok=True)
    with open(HERE / "results" / "coverage_threshold.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
