"""Three 1920x1080 images for the technical video (model/results/video/).

1. keyword_vs_ai.png   real T1/T2 messages: keyword search vs Aage Ke (both outputs computed here)
2. results.png         missed warnings and micro-F1 on real data: T1+T2 pooled, and T3
3. how_it_works.png    the flow from SMS to referral
Run: python model/video_images.py   (after evaluate.py --full)
"""
import json
import pickle
import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402
from matplotlib.patches import FancyBboxPatch  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from preprocess import load_labels, label_keys  # noqa: E402
from evaluate import run_systems, load_test  # noqa: E402
from evaluate_full import score  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "results" / "video"
INK, MUTED, BRAND, RED, GREEN, AMBER = "#1b2430", "#5b6673", "#0f5c63", "#b3261e", "#2e6b34", "#9a5b00"
plt.rcParams.update({"font.family": "DejaVu Sans"})
SHORT = {"abdominal_pain": "Abdominal pain", "persistent_vomiting": "Vomiting", "bleeding": "Bleeding",
         "lethargy_restless": "Very weak / restless", "low_urine": "Less urine", "cold_clammy": "Cold, clammy",
         "breathing_difficulty": "Breathing difficulty", "cannot_drink": "Cannot eat or drink",
         "fever_dropped": "Fever down", "fever_present": "Fever", "feeling_better": "Feeling better",
         "test_result_mentioned": "Test report"}


def canvas():
    fig = plt.figure(figsize=(19.2, 10.8), dpi=100)
    fig.patch.set_facecolor("white")
    ax = fig.add_axes([0, 0, 1, 1])
    ax.set_xlim(0, 1920)
    ax.set_ylim(1080, 0)
    ax.axis("off")
    return fig, ax


def box(ax, x, y, w, h, fc, ec=None, r=18, lw=2):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0,rounding_size={r}", fc=fc, ec=ec or fc, lw=lw))


def describe(bands, warn):
    """Readable output: warning signs first, e.g. 'Abdominal pain (not sure)'."""
    items = [k for k in bands if k in warn] or list(bands)
    if not items:
        return "nothing found"
    return ", ".join(SHORT[k] + (" (not sure)" if bands[k] == "unsure" else "") for k in items)


def image_keyword_vs_ai(labels_json, m):
    warn = {x["key"] for x in labels_json["warning_signs"]}
    # Real T1/T2 messages: three where the results differ, one where both systems are wrong.
    rows = [
        ("Pet e betha ache ekhono", "The stomach\nstill hurts", "no exact keyword match", True),
        ("Kichu khete partese na ekhono", "Still cannot\neat anything", "spelling not in its list", True),
        ("Gotokalke vomi hoyechilo, ajke hoi ni", "Vomited yesterday,\nnot today", "treats yesterday as now", True),
        ("Bomi bomi laghe", "Feels nauseous\n(not vomiting)", "false alarm", False),
    ]
    out = run_systems([r[0] for r in rows], m, labels_json)
    wrap = {"Kichu khete partese na ekhono": "Kichu khete partese\nna ekhono",
            "Gotokalke vomi hoyechilo, ajke hoi ni": "Gotokalke vomi hoyechilo,\najke hoi ni"}
    fig, ax = canvas()
    ax.text(80, 95, "Keyword search vs Aage Ke, on real messages", fontsize=44, weight="bold", color=INK)
    ax.text(80, 150, "Written by volunteers in their own words (test set, never used for training)", fontsize=24, color=MUTED)
    for x, h in [(80, "Message (Banglish)"), (640, "English meaning"), (1010, "Keyword search"), (1440, "Aage Ke")]:
        ax.text(x, 235, h, fontsize=26, weight="bold", color=BRAND)
    ax.plot([80, 1840], [258, 258], color=BRAND, lw=3)
    y = 300
    for (msg, meaning, why, ai_right), kw, ai in zip(rows, out["keyword"], out["model+rules"]):
        box(ax, 70, y - 35, 1780, 165, "#f5f8fb" if ai_right else "#fff6f5")
        ax.text(80, y + 45, "“" + wrap.get(msg, msg) + "”", fontsize=24, weight="bold", color=INK, va="center", linespacing=1.3)
        ax.text(640, y + 45, meaning, fontsize=23, color=INK, va="center", linespacing=1.3)
        ax.text(1010, y + 20, "✗ " + describe(kw, warn), fontsize=24, color=RED, va="center", weight="bold")
        ax.text(1010, y + 70, why, fontsize=20, color=MUTED, va="center")
        mark, col = ("✓ ", GREEN) if ai_right else ("✗ ", RED)
        ax.text(1440, y + 45, mark + describe(ai, warn).replace(" (not sure)", "\n    (not sure)"), fontsize=24,
                color=col, va="center", weight="bold", linespacing=1.3)
        y += 185
    ax.text(80, 1015, "Last row, honestly: both confuse nausea (“bomi bomi”) with vomiting.", fontsize=21, color=MUTED)
    ax.text(80, 1050, "“Not sure” means the health worker checks before anything changes.", fontsize=21, color=MUTED)
    fig.savefig(OUT / "keyword_vs_ai.png", dpi=100)
    plt.close(fig)


def image_results(labels_json, m):
    keys = label_keys(labels_json)
    warn = {x["key"] for x in labels_json["warning_signs"]}
    d = pd.concat([load_test("test_t1_human.csv"), load_test("test_t2_crowd.csv")], ignore_index=True)
    s = run_systems(d["text"].tolist(), m, labels_json)
    gold = [set(x for x in v.split("|") if x) for v in d["labels"]]
    t12 = {k: score(gold, s[k], keys, warn) for k in ("keyword+neg", "model+rules")}
    M = json.load(open(HERE / "results" / "metrics.json", encoding="utf-8"))
    t3 = {k: M["sets"]["T3"][k] for k in ("keyword+neg", "model+rules")}
    weak = M["sets"]["pooled"]["model+rules"]["per_label"]["fever_present"]
    with open(HERE / "results" / "t1t2_pooled.json", "w", encoding="utf-8") as f:
        json.dump({k: {"rows": v["rows"], "missed_warnings": v["missed_warnings"], "micro_f1": v["micro_f1"]}
                   for k, v in t12.items()}, f, indent=2)

    fig, ax = canvas()
    ax.text(80, 95, "Results on real data", fontsize=48, weight="bold", color=INK)
    ax.text(80, 150, "Missed warning sign = a message with a real warning sign where the system suggests none. Lower is better.",
            fontsize=23, color=MUTED)
    for x0, title, data in [(80, f"{len(d)} real volunteer messages (T1 + T2)", t12),
                            (990, f"{t3['model+rules']['rows']} real public health posts (T3)", t3)]:
        box(ax, x0, 200, 850, 690, "#f5f8fb")
        ax.text(x0 + 40, 260, title, fontsize=26, weight="bold", color=INK)
        for j, (k, label, col) in enumerate((("keyword+neg", "Keyword search + negation", "#5b8fb0"),
                                             ("model+rules", "Aage Ke (model + rules)", BRAND))):
            r = data[k]
            mw = r["missed_warnings"]
            yy = 345 + j * 270
            ax.text(x0 + 40, yy, label, fontsize=27, weight="bold", color=col)
            ax.text(x0 + 40, yy + 90, f"{mw['missed']} of {mw['messages_with_warning']}", fontsize=60, weight="bold", color=col)
            ax.text(x0 + 40, yy + 145, "warning messages missed", fontsize=22, color=MUTED)
            ax.text(x0 + 500, yy + 90, f"{r['micro_f1']:.2f}", fontsize=60, weight="bold", color=col)
            ax.text(x0 + 500, yy + 145, "micro-F1", fontsize=22, color=MUTED)
    ax.text(80, 945, f"Weakest area: “fever still present” (F1 {weak['f1']:.2f}, n={weak['support']}).",
            fontsize=26, color=RED, weight="bold")
    ax.text(80, 990, "The model confuses ongoing fever with fever coming down.", fontsize=24, color=RED)
    ax.text(80, 1045, "23 real messages from 5 people: small sample.", fontsize=26, color=INK, weight="bold")
    fig.savefig(OUT / "results.png", dpi=100)
    plt.close(fig)


def image_how_it_works():
    fig, ax = canvas()
    ax.text(80, 110, "How Aage Ke works", fontsize=50, weight="bold", color=INK)
    steps = [
        ("Family SMS", "own words, Bangla or\nBanglish, or a missed\ncall", "#eef1f4", INK),
        ("Small AI\non the phone", "443 KB · no internet\nfixed list of 12 labels", BRAND, "white"),
        ("Rina confirms", "✓ confirm or ✗ reject\nevery suggestion", "#e7f3e8", GREEN),
        ("List sorted", "red · amber · green\nwho needs her first", "#fdecea", RED),
        ("Nearest\nhospital", "referral note + SMS\nshe presses send", "#fff3df", AMBER),
    ]
    w, h, gap, y = 316, 340, 40, 300
    for i, (title, body, fc, tc) in enumerate(steps):
        x = 80 + i * (w + gap)
        box(ax, x, y, w, h, fc, r=26)
        ax.text(x + w / 2, y + 95, title, fontsize=28, weight="bold", color=tc, ha="center", va="center", linespacing=1.2)
        ax.text(x + w / 2, y + 240, body, fontsize=20, color=tc, ha="center", va="center", linespacing=1.4)
        if i < len(steps) - 1:
            ax.annotate("", xy=(x + w + gap - 4, y + h / 2), xytext=(x + w + 4, y + h / 2),
                        arrowprops=dict(arrowstyle="-|>", color=MUTED, lw=4, mutation_scale=30))
    box(ax, 80, 760, 1760, 120, "#e3f1f2", r=26)
    ax.text(960, 820, "Shows why  ·  says “not sure”  ·  never writes advice  ·  data encrypted on phone",
            fontsize=27, weight="bold", color=BRAND, ha="center", va="center")
    ax.text(960, 960, "AI reads. Code does everything else. A person decides.", fontsize=28, color=MUTED, ha="center")
    fig.savefig(OUT / "how_it_works.png", dpi=100)
    plt.close(fig)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    labels_json = load_labels()
    with open(HERE / "model.pkl", "rb") as f:
        m = pickle.load(f)
    image_keyword_vs_ai(labels_json, m)
    image_results(labels_json, m)
    image_how_it_works()
    print("Wrote", ", ".join(p.name for p in sorted(OUT.glob("*.png"))))


if __name__ == "__main__":
    main()
