"""CC2 acceptance tests: preprocessing, script detection and the two baselines.

Run: python model/test_cc2.py
"""
import json
import subprocess
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from preprocess import preprocess, detect_script, ROOT  # noqa: E402
from baseline import keyword, keyword_neg  # noqa: E402

# (text, keyword labels, keyword+neg {label: band})
HAND = [
    ("pet betha nai", {"abdominal_pain"}, {}),
    ("পেটে ব্যথা নাই", {"abdominal_pain"}, {}),
    ("kal bomi hoisilo aj nai", {"persistent_vomiting"}, {"persistent_vomiting": "unsure"}),
    ("bomi bondho hocche na", {"persistent_vomiting"}, {"persistent_vomiting": "sure"}),
    ("pet betha kome na", {"abdominal_pain"}, {"abdominal_pain": "sure"}),
    ("rokto porikkha korsi, platelet kom", {"test_result_mentioned"}, {"test_result_mentioned": "sure"}),
    ("jwor nai", {"fever_dropped", "fever_present"}, {"fever_dropped": "sure"}),
    ("prosrab hocche na", {"low_urine"}, {"low_urine": "sure"}),
    ("pet betha nai, kintu bomi korse", {"abdominal_pain", "persistent_vomiting"}, {"persistent_vomiting": "sure"}),
    ("dat theke rokto porse", {"bleeding"}, {"bleeding": "sure"}),
    ("kemon jani kortese", set(), {}),
]


def test_preprocess():
    assert preprocess("Pet e BETHAAAA!!!") == "pet e bethaa"
    assert preprocess("২ বার বমি।") == "2 বার বমি"
    assert preprocess("র‍ক্ত‌") == "রক্ত"
    assert preprocess("  jor   nai ,, aj ") == "jor nai aj"


def test_script():
    assert detect_script("পেটে খুব ব্যথা") == "bn"
    assert detect_script("pet e khub betha") == "banglish"
    assert detect_script("pet e খুব ব্যথা") == "mixed"


def test_baselines():
    for text, kw, kn in HAND:
        assert set(keyword(text)) == kw, (text, keyword(text))
        assert keyword_neg(text) == kn, (text, keyword_neg(text))


def test_js_parity():
    texts = pd.read_csv(ROOT / "data" / "train_sentences.csv")["text"].astype(str).tolist()
    texts += [t for t, _, _ in HAND] + ["Pet e BETHAAAA!!!", "২ বার বমি।", "র‍ক্ত‌"]
    js = (
        "const m=require(process.argv[1]);let d='';process.stdin.setEncoding('utf8');"
        "process.stdin.on('data',c=>d+=c).on('end',()=>{const a=JSON.parse(d);"
        "process.stdout.write(JSON.stringify(a.map(t=>[m.preprocess(t),m.detectScript(t)])));});"
    )
    res = subprocess.run(
        ["node", "-e", js, str(ROOT / "app" / "model.js")],
        input=json.dumps(texts).encode("utf-8"), capture_output=True, check=True,
    )
    out = json.loads(res.stdout.decode("utf-8"))
    bad = [(t, o) for t, o in zip(texts, out) if o != [preprocess(t), detect_script(t)]]
    assert not bad, bad[:5]
    return len(texts)


if __name__ == "__main__":
    test_preprocess()
    test_script()
    test_baselines()
    n = test_js_parity()
    print(f"OK: preprocess, script, {len(HAND)} baseline examples, JS parity on {n} texts")
