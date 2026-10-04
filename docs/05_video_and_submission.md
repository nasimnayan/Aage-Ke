# 05 · Video and submission

## 0. What HackOS actually asks for (read 4 Oct)

- Project name, challenge **04a - World Bank: Small AI for development (Track A: Health)**
- GitHub repository link (required before submit) and live project URL (GitHub Pages)
- Team photo (JPG, PNG or WebP, max 10 MB)
- **Three separate videos, MP4 or MOV, max 60 seconds each:** Team introduction · Product demo · Technical walkthrough
- Then the Google Form as well: https://forms.gle/VS65tsovASMuBwEn9 (open it early and note every field)
- Uploads and edits open until 19:15 Asia/Dhaka (15-minute grace). Aim to finish by 18:45.

The brief asks for one 2 to 5 minute video with five parts. The three clips below cover all five parts. Join them into one file (about 3 minutes) for the Google Form or anywhere a single video is asked for:
`ffmpeg -f concat -safe 0 -i list.txt -c copy aage_ke_full.mp4` (list.txt lists the three files in order; re-encode if formats differ).

| Brief's video part | Clip |
|---|---|
| Problem statement (one sentence) | 1 |
| Your take on localising AI | 1 |
| Tool demo, user journey end to end | 2 |
| Where it sits in the user's day | 2 |
| AI capabilities, why not a simpler tool, guardrails, tech stack | 3 |

## 1. Recording rules

- Each clip under 58 seconds. Read the script once with a timer before recording.
- Nasim's own voice. No employer logo, ID card, lanyard, office or branded clothing in any shot or in the team photo.
- Demo: Android screen recording, airplane-mode icon visible throughout. English subtitles for Bangla on screen.
- Fill every [X] from `model/results/results.md`. Refresh DGHS numbers on the day.

## 2. Scripts

### Clip 1 · Team introduction (Nasim on camera, about 115 words)

> I'm Nasim Mahmud Nayan from Dhaka, and this is Aage Ke?, which means "who first?".
> Last year DGHS reviewed 114 dengue deaths in Bangladesh. Sixty-six of those people died within a day of reaching hospital. This year 256 people have died so far. The danger begins at home, when the fever comes down.
> Because of this tool, a community health worker will know the same day which of her dengue patients at home has reported a warning sign after the fever falls, which she would otherwise learn too late. We know because WHO advises daily review of these patients, and in villages nobody does it.
> For me, localising AI means the test data is written by the people who will use the tool, the way they really write, and you publish where it breaks.

### Clip 2 · Product demo (screen recording, about 110 words)

> Rina runs a community clinic in Nazirpur, Pirojpur. She checks Aage Ke? after morning clinic and again in the evening. Airplane mode is on.
> Someone in Noor's house texts "pet e khub betha, 2 bar bomi korse". The tool suggests two signs from a fixed list. Rina confirms both. Noor turns red.
> Rina taps refer. The app shows the nearest facility that admits dengue patients and opens a pre-written SMS. Rina presses send herself.
> "pet betha nai, valo achi" flags nothing. "kal bomi hoisilo aj nai" is marked not sure. "kemon jani kortese" says call them. And a patient silent on day five turns amber.

### Clip 3 · Technical walkthrough (charts and code on screen, about 125 words)

> A keyword search flags "pet betha nai" as pain and misses spellings nobody listed. Our model reads Bangla and Banglish through character patterns, and says when it is unsure.
> AI does one job: reading. Sorting, messages, referral and facility choice are plain code. The model can only pick from a fixed list, so it cannot invent advice, and Rina confirms every label.
> We tested on three sets it never saw: my messages, messages from [X] people in [X] districts, and 80 real Bangla health posts. It is weakest on [X]. When it says sure, it is right [X]% of the time.
> The model is [X] kilobytes, runs in the phone's browser, keeps records on the phone and exports DHIS2-shaped events. Next: two weeks with five health providers in one Pirojpur union.

## 3. Submission checklist

HackOS
- [ ] Team "Aage Ke" created ✓
- [ ] Project name "Aage Ke?" and challenge 04a saved as draft early
- [ ] GitHub repo link and GitHub Pages link added
- [ ] Team photo uploaded (no employer branding)
- [ ] Clip 1, Clip 2, Clip 3 uploaded, each under 60 s, playback checked
- [ ] Submit pressed (not only Save draft)

Google Form
- [ ] All fields filled; joined 3-minute video or links as the form asks

Repo
- [ ] Public, Pages link works on a phone, airplane-mode reload works
- [ ] Judge mode reaches the red patient in under 3 taps
- [ ] README: model size, four charts with weak spots first, data sources with licence and size, "what the data does not cover", privacy section (and whether encryption is done), every number linked to `02 §3`
- [ ] Demo data marked fictional; no real patient messages
- [ ] No employer name, data or branding anywhere
- [ ] No diagnosis language in app, SMS or video
- [ ] English everywhere except Bangla UI and examples

Rules from the brief
- [ ] Runs on a device the user already has (Android browser)
- [ ] Core feature works offline
- [ ] Model small enough to send over a weak connection
- [ ] Local language named: Bangla (script and Banglish)
- [ ] Answer ready for "less-supported language?": weakness measured by district; Chakma and Marma not covered and need human-written lists and test data first
- [ ] Human makes the final call; tool flags uncertainty; tool never acts on its own
