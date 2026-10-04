"""Python vs JS (Node) inference parity (docs/03 CC3).

Runs scikit-learn and app/model.js on every T1 row (inference only) plus every training text.
Passes when the max absolute probability difference is below 1e-3.
"""
import json
import pickle
import subprocess
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from preprocess import ROOT, preprocess  # noqa: E402

HERE = Path(__file__).resolve().parent
TOL = 1e-3

JS = (
    "const m=require(process.argv[1]);const model=require(process.argv[2]);let d='';"
    "process.stdin.setEncoding('utf8');process.stdin.on('data',c=>d+=c).on('end',()=>{"
    "const a=JSON.parse(d);process.stdout.write(JSON.stringify(a.map(t=>{const p=m.predict(model,t);"
    "return model.labels.map(k=>p[k]);})));});"
)


def main():
    with open(HERE / "model.pkl", "rb") as f:
        m = pickle.load(f)
    t1 = pd.read_csv(ROOT / "data" / "test_t1_human.csv", keep_default_na=False)["text"].astype(str).tolist()
    train = pd.read_csv(ROOT / "data" / "train_sentences.csv", keep_default_na=False)["text"].astype(str).tolist()
    texts = t1 + train

    py = m["clf"].predict_proba(m["vec"].transform([preprocess(t) for t in texts]))
    res = subprocess.run(
        ["node", "-e", JS, str(ROOT / "app" / "model.js"), str(ROOT / "app" / "model_dengue.json")],
        input=json.dumps(texts).encode("utf-8"), capture_output=True, check=True,
    )
    js = json.loads(res.stdout.decode("utf-8"))
    diffs = [abs(a - b) for row_p, row_j in zip(py, js) for a, b in zip(row_p, row_j)]
    worst = max(diffs)
    t1_worst = max(diffs[: len(t1) * len(m["keys"])], default=0.0)
    ok = worst < TOL
    print(f"T1 rows: {len(t1)}, training rows: {len(train)}")
    print(f"Max |p_python - p_js|: all {worst:.2e}, T1 {t1_worst:.2e} -> {'PASS' if ok else 'FAIL'} (< {TOL})")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
