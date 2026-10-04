# Generates data/train_sentences.csv (constructed, source=claude_draft, verified=false).
# Hand-written templates x subjects x Banglish spelling variants. Seeded, reproducible.
import csv, random, re, unicodedata
random.seed(42)

GEN_BN = ["আম্মার","আব্বার","আমার","রোগীর","আমার স্বামীর","আমার বউয়ের","ভাইয়ের","বোনের","নানির","দাদির"]
NOM_BN = ["আম্মা","আব্বা","শাশুড়ি","রোগী","আমার স্বামী","আমার বউ","ভাই","বোন","নানি","দাদি"]
GEN_EN = ["ammar","abbar","amar","rogir","shamir","bouer","bhaiyer","boner","nanir","dadir"]
NOM_EN = ["ammu","abbu","shashuri","rogi","amar shami","amar bou","bhai","bon","nani","dadi"]
GREET_BN = ["","","","আপা, ","আসসালামু আলাইকুম আপা, ","আপা "]
GREET_EN = ["","","","apa, ","assalamualaikum apa, ","apa "]

# {g}=genitive subject, {n}=nominative subject
T = {
 "abdominal_pain": (
  ["{g} পেটে খুব ব্যথা","{g} পেটে প্রচণ্ড ব্যথা হচ্ছে","{g} পেট ব্যথা কমছে না","সকাল থেকে {g} পেটে একটানা ব্যথা",
   "{g} পেট কামড়াচ্ছে","{n} পেটের ব্যথায় কাতরাচ্ছে","{g} পেটের ডান দিকে ব্যথা করছে","{n} পেট ধরে বসে আছে, খুব ব্যথা"],
  ["{g} pete khub betha","{g} pet betha kortese","{g} pete onek batha","sokal theke {g} pet betha kome na",
   "{g} pet kamrai","pete khub bedona","{g} peter dan dike betha","{n} pet dhore bose ase, khub betha"]),
 "persistent_vomiting": (
  ["{n} বারবার বমি করছে","{n} আজ ৩ বার বমি করেছে","{g} বমি থামছে না","যা খায় তাই বমি করে দেয়",
   "{n} সকাল থেকে বমি করছে","{g} বারবার বমি হচ্ছে","{n} উল্টি করছে","{n} বমি করেই যাচ্ছে"],
  ["{n} barbar bomi kortese","aj 3 bar bomi korse","{g} bomi thamtese na","ja khay tai bomi kore dey",
   "sokal theke {n} bomi kortese","{g} bomi hocche barbar","{n} ulti kortese","bomi korei jacche"]),
 "bleeding": (
  ["{g} দাঁতের মাড়ি দিয়ে রক্ত পড়ছে","{g} নাক দিয়ে রক্ত পড়ছে","বমির সাথে রক্ত এসেছে","{g} পায়খানা কালো হয়ে গেছে",
   "পায়খানার সাথে রক্ত যাচ্ছে","{g} মাড়ি থেকে রক্ত বের হচ্ছে","দাঁত ব্রাশ করার সময় রক্ত পড়ছে","{g} নাক থেকে রক্ত আসছে"],
  ["{g} dat theke rokto porse","{g} nak diye rokto porche","bomir sathe rokto ashche","{g} paikhana kalo hoye gese",
   "paykhanar sathe rokto jacche","maari theke rokto ber hocche","brush korte gele rokto pore","{g} nak theke rokto ashtese"]),
 "lethargy_restless": (
  ["{n} খুব দুর্বল হয়ে গেছে","{n} একদম নেতিয়ে পড়েছে","{n} সারাদিন ঝিমাচ্ছে","{n} খুব অস্থির করছে",
   "ডাকলে ঠিকমতো সাড়া দিচ্ছে না","{n} বিছানা থেকে উঠতে পারছে না","{n} ঘুম ঘুম ভাব, কথা বলছে না"],
  ["{n} khub durbol hoye gese","{n} ekdom netiye porse","{n} sharadin jhimacche","{n} khub osthir kortese",
   "dakle thikmoto shara dey na","{n} bichana theke uthte pare na","ghum ghum vab, kotha bole na"]),
 "low_urine": (
  ["{g} প্রস্রাব খুব কম হচ্ছে","সকাল থেকে একবারও প্রস্রাব হয়নি","{g} পেশাব কমে গেছে","সারাদিনে মাত্র একবার প্রস্রাব করেছে",
   "{g} প্রস্রাব হচ্ছে না","প্রস্রাব খুব অল্প, রং গাঢ়"],
  ["{g} prosrab khub kom hocche","sokal theke ekbaro prosrab hoy nai","{g} peshab kome gese","sharadine matro ekbar peshab korse",
   "{g} prosrab hocche na","urine khub kom, rong ghoro"]),
 "cold_clammy": (
  ["{g} হাত পা ঠান্ডা হয়ে গেছে","{g} শরীর ঠান্ডা আর ঘামছে","{g} হাত-পা বরফের মতো ঠান্ডা","{n} ঠান্ডা ঘাম দিচ্ছে","{g} হাত পা ঠান্ডা, গা ঘামে ভেজা"],
  ["{g} hat pa thanda hoye gese","{g} shorir thanda ar ghamtese","hat pa borofer moto thanda","{n} thanda gham dicche","{g} hat-pa thanda, gham e bheja"]),
 "breathing_difficulty": (
  ["{g} শ্বাস নিতে কষ্ট হচ্ছে","{n} হাঁপাচ্ছে","{g} শ্বাসকষ্ট হচ্ছে","{n} দম নিতে পারছে না","বুক ভারী লাগছে, শ্বাস নিতে কষ্ট"],
  ["{g} shash nite kosto hocche","{n} hapacche","{g} shashkosto hocche","{n} dom nite partese na","buk bhari, shash nite kosto"]),
 "cannot_drink": (
  ["{n} কিছুই খেতে পারছে না","পানিও খেতে পারছে না","মুখে কিছু দিলেই ফেলে দেয়","{n} দুইদিন ধরে কিছু খাচ্ছে না","স্যালাইন খাওয়াতে পারছি না","{n} পানি খাচ্ছে না"],
  ["{n} kichui khete parche na","pani o khete pare na","mukhe kichu dile fele dey","{n} duidin dhore kichu khay na","saline khawate partesi na","{n} pani khay na"]),
}
STATUS = {
 "fever_dropped": (["জ্বর কমেছে","আজ জ্বর নেই","জ্বর ছেড়ে গেছে","{g} জ্বর নেমে গেছে","গতরাত থেকে জ্বর নাই"],
                   ["jor komse","aj jor nai","jor chere gese","{g} jor neme gese","jor ar ase nai"]),
 "fever_present": (["এখনো জ্বর আছে","জ্বর ১০৩","{g} জ্বর বাড়ছে","গায়ে অনেক জ্বর"],
                   ["ekhono jor ase","jor 103","{g} jor bartese","gaye onek jor"]),
 "feeling_better": (["আলহামদুলিল্লাহ ভালো আছি","আজ একটু ভালো","আগের চেয়ে ভালো","{n} ভালো আছে, চিন্তা করবেন না","{n} এখন সুস্থ লাগছে","সব ঠিক আছে আপা"],
                    ["alhamdulillah valo achi","aj ektu bhalo","ager cheye valo","{n} valo ase, chinta korben na","{n} ekhon sustho lagtese","sob thik ase apa"]),
 "test_result_mentioned": (["প্লাটিলেট ৮০ হাজার","আজ রক্ত পরীক্ষা করেছি","রিপোর্ট এসেছে, প্লাটিলেট কম","সিবিসি করাইছি, রিপোর্ট কাল দিবে","{g} প্লেটলেট কমে গেছে","রক্তের রিপোর্ট হাতে পেয়েছি"],
                           ["platelet 80 hajar","aj rokto porikkha korsi","report aise, platelet kom","cbc korailam, report kal dibe","{g} platelet kome gese","blood test er report paisi"]),
}
# hard negatives: words that look close to cues but are not on the list
NONE = (["বমি বমি লাগছে","মাথা ব্যথা করছে","{g} সারা শরীর ব্যথা","চোখের পিছনে ব্যথা","গায়ে ব্যথা আছে, আর কিছু না",
         "কাল হাসপাতালে যাব","ডাব খাওয়াচ্ছি","রক্ত পরীক্ষা করাতে যাব কাল","আপা কেমন আছেন","ঔষধ শেষ হয়ে গেছে"],
        ["bomi bomi lage","matha betha kortese","{g} shara shorir betha","chokher pichone betha","gaye betha ase, ar kichu na",
         "kal hospital e jabo","dab khawacchi","rokto porikkha korate jabo","apa kemon achen","oshudh shesh hoye gese"])
# negated: label suppressed (labels empty, or a status label)
NEG = [("পেটে ব্যথা নাই",""),("আজ আর বমি হয়নি",""),("রক্ত পড়ে নাই",""),("শ্বাসকষ্ট নেই",""),("দুর্বল না, ভালো আছে","feeling_better"),
       ("হাত পা ঠান্ডা না",""),("পেট ব্যথা নেই, ভালো আছি","feeling_better"),("বমি করে নাই আজ",""),("জ্বর নাই","fever_dropped"),
       ("pet betha nai",""),("aj ar bomi hoyni",""),("rokto pore nai",""),("shash kosto nai",""),("durbol na, valo ase","feeling_better"),
       ("hat pa thanda na",""),("pet betha nei, valo achi","feeling_better"),("bomi kore nai aj",""),("jor nai","fever_dropped"),
       ("nak diye rokto pore nai",""),("pete kono betha nai",""),("jor ase nai","fever_dropped")]
# past: label kept, is_past=1 (rule caps band at 'not sure')
PAST = [("কাল বমি হয়েছিল, আজ হয়নি","persistent_vomiting"),("গতকাল পেটে ব্যথা ছিল","abdominal_pain"),("কাল রাতে নাক দিয়ে রক্ত পড়েছিল","bleeding"),
        ("গতকাল খুব দুর্বল ছিল","lethargy_restless"),("কাল প্রস্রাব কম হয়েছিল","low_urine"),
        ("kal bomi hoisilo, aj hoy nai","persistent_vomiting"),("gotokal pete betha chilo","abdominal_pain"),("kal rate nak diye rokto porsilo","bleeding"),
        ("gotokal khub durbol chilo","lethargy_restless"),("kal prosrab kom hoisilo","low_urine"),("kal shash nite kosto hoisilo","breathing_difficulty"),
        ("gotokal kichu khete pare nai","cannot_drink")]
VARIANTS = [("khub",["khub","kub","khoob","onek"]),("betha",["betha","batha","bytha","beta"]),("korse",["korse","korche","korce","korsey"]),
            ("kortese",["kortese","korteche","kortase","kortesay"]),("hocche",["hocche","hoitese","hosse","hoche"]),("rokto",["rokto","rokkto","roktto"]),
            ("gese",["gese","geche","gece"]),("nai",["nai","nei","nai re"]),("bomi",["bomi","bomii","vomi"])]

def vary(s):
    for w,opts in VARIANTS:
        s=re.sub(r'\b'+w+r'\b', lambda m: random.choice(opts), s)
    return s
def script_of(t):
    letters=[c for c in t if c.isalpha()]
    if not letters: return "banglish"
    bn=sum(1 for c in letters if '\u0980'<=c<='\u09FF')/len(letters)
    return "bn" if bn>=0.8 else ("banglish" if bn<=0.2 else "mixed")
def fill(tpl, bn, i=None):
    i=random.randrange(10) if i is None else i
    g,n=(GEN_BN[i],NOM_BN[i]) if bn else (GEN_EN[i],NOM_EN[i])
    s=tpl.replace("{g}",g).replace("{n}",n)
    s=(random.choice(GREET_BN) if bn else random.choice(GREET_EN))+s
    return s if bn else vary(s)

rows=[]
def add(text,labels,neg=0,past=0):
    text=unicodedata.normalize("NFC",re.sub(r"\s+"," ",text).strip())
    rows.append(dict(text=text,labels=labels,script=script_of(text),dialect="standard",is_negated=neg,is_past=past,source="claude_draft",verified="false"))

for lab,(bn,en) in T.items():
    for tpl in bn:
        for _ in range(3): add(fill(tpl,True),lab)
    for tpl in en:
        for _ in range(3): add(fill(tpl,False),lab)
for lab,(bn,en) in STATUS.items():
    for tpl in bn:
        for _ in range(3): add(fill(tpl,True),lab)
    for tpl in en:
        for _ in range(3): add(fill(tpl,False),lab)
for tpl in NONE[0]:
    for _ in range(2): add(fill(tpl,True),"")
for tpl in NONE[1]:
    for _ in range(2): add(fill(tpl,False),"")
for t,l in NEG:
    add(t,l,neg=1); add(vary(t) if script_of(t)!="bn" else t+"।",l,neg=1)
for t,l in PAST:
    add(t,l,past=1)
# two-sign combos
keys=list(T)
for _ in range(70):
    a,b=random.sample(keys,2); bn=random.random()<0.5; si=random.randrange(10)
    ta=random.choice(T[a][0 if bn else 1]); tb=random.choice(T[b][0 if bn else 1])
    joiner=random.choice([", ",", আর "," আর "] if bn else [", ",", ar "," ar "])
    add(fill(ta,bn,si)+joiner+re.sub(r"^(আসসালামু আলাইকুম আপা, |আপা,? ?|assalamualaikum apa, |apa,? ?)","",fill(tb,bn,si)),"|".join(sorted([a,b])))
# warning sign + fever status combos
for _ in range(30):
    a=random.choice(keys); bn=random.random()<0.5
    st=random.choice(["fever_dropped","fever_present"])
    si=random.randrange(10)
    add(fill(random.choice(STATUS[st][0 if bn else 1]),bn,si)+", "+re.sub(r"^(আসসালামু আলাইকুম আপা, |আপা,? ?|assalamualaikum apa, |apa,? ?)","",fill(random.choice(T[a][0 if bn else 1]),bn,si)),"|".join(sorted([a,st])))

# dedupe
seen=set(); out=[]
for r in rows:
    k=r["text"].lower()
    if k in seen: continue
    seen.add(k); out.append(r)
with open("train_sentences.csv","w",newline="",encoding="utf-8") as f:
    w=csv.DictWriter(f,fieldnames=["text","labels","script","dialect","is_negated","is_past","source","verified"])
    w.writeheader(); w.writerows(out)
from collections import Counter
c=Counter()
for r in out:
    for l in (r["labels"].split("|") if r["labels"] else ["(none)"]): c[l]+=1
print(len(out),"rows"); print(dict(c)); print(Counter(r["script"] for r in out))
