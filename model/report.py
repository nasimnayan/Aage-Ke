"""CC8 charts and results.md, built only from the metrics dict that evaluate_full.py also saves
as metrics.json, so the numbers in the text and in the file always match."""
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

HERE = Path(__file__).resolve().parent
OUT = HERE / "results"
CHARTS = OUT / "charts"
COLOURS = {"keyword": "#9aa5ab", "keyword+neg": "#6f9fbd", "model+rules": "#1f3b4d"}
ORDER = ["T1", "T2", "T3", "pooled", "challenge"]
SET_LABEL = {"T1": "T1 real\nvolunteers", "T2": "T2 real\nunseen", "T3": "T3 real\npublic posts",
             "pooled": "Pooled\nT1+T2+T3", "challenge": "Challenge\n(synthetic)"}

plt.rcParams.update({"font.size": 11, "axes.titlesize": 13, "axes.spines.top": False, "axes.spines.right": False})


def _title(ax, text, note):
    ax.set_title(text + (f"\n[{note}]" if note else ""), loc="left")


def _bars(ax, groups, values_by_system, systems, ylabel, pct=False):
    w = 0.8 / len(systems)
    for i, s in enumerate(systems):
        vals = [v if v is not None else 0 for v in values_by_system[s]]
        xs = [g + (i - (len(systems) - 1) / 2) * w for g in range(len(groups))]
        bars = ax.bar(xs, vals, w, label=s, color=COLOURS[s])
        for b, v in zip(bars, values_by_system[s]):
            if v is not None:
                ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 0.01,
                        f"{100 * v:.0f}%" if pct else f"{v:.2f}", ha="center", va="bottom", fontsize=8)
    ax.set_xticks(range(len(groups)))
    ax.set_xticklabels(groups)
    ax.set_ylabel(ylabel)
    ax.set_ylim(0, 1.12)


def charts(M, note, systems):
    CHARTS.mkdir(parents=True, exist_ok=True)
    sets = [s for s in ORDER if s in M["sets"]]

    # 1. Model vs keyword: missed warnings (headline) and micro-F1 per test set.
    fig, axes = plt.subplots(2, 1, figsize=(7.5, 8))
    # Small sets are shown with their n so a 0% on one message is not read as a result.
    nwarn = {s: M["sets"][s]["model+rules"]["missed_warnings"]["messages_with_warning"] for s in sets}
    _bars(axes[0], [SET_LABEL[s] + f"\nn={nwarn[s]}" for s in sets],
          {sy: [M["sets"][s][sy]["missed_warnings"]["missed_rate"] for s in sets] for sy in systems},
          systems, "share of warning messages missed", pct=True)
    _title(axes[0], "Missed warnings (lower is better)", note)
    axes[0].legend(frameon=False, ncol=3, loc="upper right", fontsize=9)
    _bars(axes[1], [SET_LABEL[s] for s in sets],
          {sy: [M["sets"][s][sy]["micro_f1"] for s in sets] for sy in systems}, systems, "micro-F1")
    _title(axes[1], "Micro-F1 (higher is better)", None)
    fig.tight_layout()
    fig.savefig(CHARTS / "01_model_vs_keyword.png", dpi=180)
    plt.close(fig)

    # 2. By script (pooled) and by district (T1), model+rules: F1 and abstention.
    sc = M["splits"]["script"]["pooled"]
    di = M["splits"].get("district", {}).get("T1", {})
    groups = [f"{k}\n(n={sc[k]['model+rules']['rows']})" for k in sc] + \
             [f"{k}\n(T1, n={di[k]['model+rules']['rows']})" for k in di]
    rows = [sc[k]["model+rules"] for k in sc] + [di[k]["model+rules"] for k in di]
    fig, ax = plt.subplots(figsize=(7.5, 4.5))
    w = 0.38
    xs = range(len(groups))
    ax.bar([x - w / 2 for x in xs], [r["micro_f1"] for r in rows], w, label="micro-F1", color=COLOURS["model+rules"])
    ax.bar([x + w / 2 for x in xs], [r["abstention_rate"] for r in rows], w, label="abstention", color="#d9a441")
    for x, r in zip(xs, rows):
        ax.text(x - w / 2, r["micro_f1"] + 0.01, f"{r['micro_f1']:.2f}", ha="center", fontsize=8)
        ax.text(x + w / 2, r["abstention_rate"] + 0.01, f"{100 * r['abstention_rate']:.0f}%", ha="center", fontsize=8)
    ax.set_xticks(list(xs))
    ax.set_xticklabels(groups, fontsize=9)
    ax.set_ylim(0, 1.12)
    ax.legend(frameon=False)
    _title(ax, "Model+rules by script (pooled) and district (T1)", note)
    fig.tight_layout()
    fig.savefig(CHARTS / "02_by_script_and_district.png", dpi=180)
    plt.close(fig)

    # 3. Negation and past subsets (pooled): exact-match rate = handled correctly.
    subs = [(k, M["splits"].get(k, {}).get("pooled")) for k in ("negation", "past")]
    subs = [(k, v) for k, v in subs if v]
    fig, ax = plt.subplots(figsize=(7.5, 4.5))
    if subs:
        _bars(ax, [f"{k}\n(n={v['model+rules']['rows']})" for k, v in subs],
              {sy: [v[sy]["exact_match"] for _, v in subs] for sy in systems}, systems,
              "handled exactly right (exact match)", pct=True)
        ax.legend(frameon=False, ncol=3, fontsize=9)
    _title(ax, "Negation and past-tense messages (pooled real sets)", note)
    fig.tight_layout()
    fig.savefig(CHARTS / "03_negation_past.png", dpi=180)
    plt.close(fig)

    # 4. Band reliability: precision of labels shown as "suggested" vs "not sure", model+rules.
    fig, ax = plt.subplots(figsize=(7.5, 4.5))
    w = 0.38
    xs = range(len(sets))
    for off, band, col, lab in ((-w / 2, "sure", COLOURS["model+rules"], "✓ suggested (p ≥ 0.75)"),
                                (w / 2, "unsure", "#d9a441", "not sure (0.45–0.75)")):
        vals = [M["sets"][s]["model+rules"][f"precision_{band}_band"] for s in sets]
        ns = [M["sets"][s]["model+rules"][f"labels_in_{band}_band"] for s in sets]
        ax.bar([x + off for x in xs], [v or 0 for v in vals], w, color=col, label=lab)
        for x, v, n in zip(xs, vals, ns):
            ax.text(x + off, (v or 0) + 0.01, ("–" if v is None else f"{100 * v:.0f}%") + f"\nn={n}", ha="center", fontsize=7)
    ax.set_xticks(list(xs))
    ax.set_xticklabels([SET_LABEL[s] for s in sets], fontsize=9)
    ax.set_ylim(0, 1.2)
    ax.set_ylabel("precision of labels in the band")
    ax.legend(frameon=False, fontsize=9)
    _title(ax, "Are the confidence bands honest?", note)
    fig.tight_layout()
    fig.savefig(CHARTS / "04_band_reliability.png", dpi=180)
    plt.close(fig)


def _p(x, pct=True):
    if x is None:
        return "–"
    return f"{100 * x:.0f}%" if pct else f"{x:.2f}"


def _headline_table(M, names, systems):
    lines = ["| Set | System | Rows | Missed warnings | Silent misses | Warning-label recall | Micro-F1 | Exact match | Abstention |",
             "|---|---|---|---|---|---|---|---|---|"]
    for name in names:
        for s in systems:
            r = M[name][s] if name in M else None
            if not r or not r.get("rows"):
                continue
            mw = r["missed_warnings"]
            miss = f"{mw['missed']}/{mw['messages_with_warning']} ({_p(mw['missed_rate'])})" if mw["messages_with_warning"] else "–"
            lines.append(f"| {name} | {s} | {r['rows']} | {miss} | {mw['silent_missed']} | {_p(mw['warning_label_recall'])} | "
                         f"{_p(r['micro_f1'], False)} | {_p(r['exact_match'])} | {_p(r['abstention_rate'])} |")
    return "\n".join(lines)


def _weak_spots(M):
    out = []
    for name in ["T1", "T2", "T3", "pooled"]:
        if name not in M["sets"]:
            continue
        mr = M["sets"][name]["model+rules"]
        kn = M["sets"][name]["keyword+neg"]
        mw = mr["missed_warnings"]
        if mw["missed"]:
            out.append(f"On {name}, model+rules missed the warning sign in {mw['missed']} of "
                       f"{mw['messages_with_warning']} messages that had one ({_p(mw['missed_rate'])}); "
                       f"{mw['silent_missed']} of those were not routed to a call either.")
        if mr["micro_f1"] <= kn["micro_f1"]:
            out.append(f"On {name}, model+rules micro-F1 ({_p(mr['micro_f1'], False)}) does not beat keyword+negation "
                       f"({_p(kn['micro_f1'], False)}).")
    pl = M["sets"].get("pooled", {}).get("model+rules", {}).get("per_label", {})
    weak = [f"{k} (F1 {_p(v['f1'], False)}, n={v['support']})" for k, v in pl.items() if v["support"] >= 3 and v["f1"] < 0.5]
    if weak:
        out.append("Weak labels on the pooled real sets: " + ", ".join(weak) + ".")
    fa = M.get("false_alarms_T3_other", {}).get("model+rules")
    if fa and fa["with_confident_warning"]:
        out.append(f"False alarms: {fa['with_confident_warning']} of {fa['rows']} T3 posts with no listed sign got a confident warning label.")
    return out


def write_results_md(M, note, systems):
    L = []
    if note:
        L += [f"> **{note.capitalize()}.** Every number on this page uses test labels proposed by Claude and not yet "
              "verified by Nasim. They will be re-run when the labels are verified.", ""]
    L += ["# Evaluation results", ""]
    weak = _weak_spots(M)
    L += ["**Weak spots first.** " + (" ".join(weak) if weak else "No weak spot crossed the reporting thresholds."), ""]
    L += [f"Shipped model: TF-IDF character n-grams + one-vs-rest logistic regression, C={M['model']['C']}, trained on "
          f"{M['model']['train_rows']} constructed sentences. Real test sets: T1 (real volunteer messages), "
          "T2 (real, fully unseen), T3 (real public health posts). The challenge set is synthetic and reported only as a stress test.", ""]
    L += ["## Headline: missed warnings next to micro-F1", "",
          "A **missed warning** is a message with at least one real warning sign where the system suggests no warning sign at all. "
          "A **silent miss** is a missed warning that is also not routed to a call by \"did not understand\". "
          "A label counts as suggested from the \"not sure\" band (p ≥ 0.45) up.", "",
          _headline_table(M["sets"], ORDER, systems), "",
          "![Model vs keyword](charts/01_model_vs_keyword.png)", ""]

    if "T3_group" in M["splits"]:
        L += ["## T3 by group", "", "T3 tests general warning-sign wording in real public posts, not dengue follow-up messages.", "",
              _headline_table(M["splits"]["T3_group"], ["fever+sign", "sign_only", "other"], systems), ""]
        L += ["## T3 child posts", "", _headline_table(M["splits"]["T3_child"], ["child posts", "other posts"], systems), ""]
        fa = M["false_alarms_T3_other"]
        L += ["## False alarms", "",
              "T3 posts in the \"other\" group (no listed sign) that get any confident (≥ 0.75) warning label:", "",
              "| System | Posts | With confident warning | Rate |", "|---|---|---|---|"]
        L += [f"| {s} | {fa[s]['rows']} | {fa[s]['with_confident_warning']} | {_p(fa[s]['rate'])} |" for s in systems]
        L += ["", f"Vashantor dialect false-alarm test: {M['false_alarms_vashantor']}.", ""]

    L += ["## By script and district", ""]
    for name, groups in M["splits"]["script"].items():
        L += [f"**{name} by script**", "", _headline_table(groups, list(groups), systems), ""]
    for name, groups in M["splits"].get("district", {}).items():
        L += [f"**{name} by district**", "", _headline_table(groups, list(groups), systems), ""]
    L += ["![By script and district](charts/02_by_script_and_district.png)", ""]

    L += ["## Negation and past tense", ""]
    for key in ("negation", "past"):
        for name, groups in M["splits"].get(key, {}).items():
            L += [f"**{key}, {name}**", "", _headline_table({name: groups}, [name], systems), ""]
    L += ["![Negation and past](charts/03_negation_past.png)", ""]

    L += ["## Band reliability (model+rules)", "", "| Set | ✓ suggested: precision (n) | not sure: precision (n) |", "|---|---|---|"]
    for name in ORDER:
        if name in M["sets"]:
            r = M["sets"][name]["model+rules"]
            L.append(f"| {name} | {_p(r['precision_sure_band'])} ({r['labels_in_sure_band']}) | "
                     f"{_p(r['precision_unsure_band'])} ({r['labels_in_unsure_band']}) |")
    L += ["", "![Band reliability](charts/04_band_reliability.png)", ""]

    if "T1_seen_before_rule_fix" in M["splits"]:
        u = M["splits"]["T1_seen_before_rule_fix"]["unseen (0)"]["model+rules"]["rows"]
        L += ["## T1 and the v0.3 rule fix", "",
              f"All T1 rows were read before the v0.3 rule fix (seen_before_rule_fix=1); {u} T1 rows are unseen. "
              "T2 is fully unseen, so T2 is the clean check of the rules.", ""]

    if "descriptive_severity" in M:
        L += ["## Descriptive run over all source posts (T3 source dataset)", "",
              "Share of posts in each original severity class that get at least one confident warning label. Descriptive only, not accuracy.", "",
              "| Original class | Posts | With confident warning |", "|---|---|---|"]
        L += [f"| {c} | {v['posts']} | {_p(v['share_with_confident_warning'])} |" for c, v in M["descriptive_severity"].items()]
        L += [""]

    L += ["## Per label (pooled real sets, model+rules)", "", "| Label | Precision | Recall | F1 | Support |", "|---|---|---|---|---|"]
    for k, v in M["sets"]["pooled"]["model+rules"]["per_label"].items():
        L.append(f"| {k} | {_p(v['precision'], False)} | {_p(v['recall'], False)} | {_p(v['f1'], False)} | {v['support']} |")
    L += ["", "All numbers above are also in `metrics.json`."]
    (OUT / "results.md").write_text("\n".join(L) + "\n", encoding="utf-8")
