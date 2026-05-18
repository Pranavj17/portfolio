# Journey · Lore Content

Fill in the strings below, then tell me "lore ready" and I'll implement Phase A + Contact CTA from `~/.claude/plans/eventual-honking-dragon.md`.

**Rules:**
- 1-3 sentences per string. First person. Specific > general.
- Beats: mark `[x]` for 3 active per chapter (or more — system supports up to 8 per chapter, but plan budgeted for 24). Write text only for the marked ones.
- Empty / unmarked beats are skipped — viewer won't see a lore card when clicking them.

---

## CHAPTER LORE
*Shown when a progress-strip dot is clicked. 2-3 sentences setting the era.*

```yaml
itics:    "2004 - 2013 crazy peacful school life"
cmr:      "2013-2015 had a new entry to world since 10 years of school with same friends and now got to the world dealing with new folks"
college:  "2015-2019 did multiple things -> interned in BOSCH, ABB, and also fever"   # DSCE
fever104: "2018-2019 made creative friends, edited videos, calls recording and also prank calls on air"
sakha:    "2019-2022 made as a frontend developer"
scripbox: "2022-now become full stack with infra and ai"
vwgt:     "..."
now:      "..."
```

---

## BEAT LORE
*Shown when a painted beat is clicked in-world. Mark `[x]` for active beats. Write 1-3 sentences for each.*

### ITICS (until 2013, primary school)

```yaml
[x] exam-anxiety:        "drinks water and actually studied the last 3 days before exam"
[x] trips:               "bus trips to school and school trips to near by places in karnataka in train"
[x] chit-chat:           "casaully timepass"
[x] assembly-stage:      "we do that everyday morning 8:30"
[x] football-match:      "intra and inter school competitons"
[x] sports-day:          "great fun and won"
[x] cricket-match:       "played district level for karnataka"
[x] cultural-dance:      "did so as a part of school activity"
```

### CMR NATIONAL (2013-2015, PU pressure-cooker)

```yaml
[x] tuition-rush:        "went for iit jee"
[x] mock-test:           "didnt study"
[x] study-lamp:          "have room lights"
[x] pu-graduation:       "fun"
[x] group-study:         "did do during exam times"
[x] movie-night:         "with girlfriend bahubali"
[x] cricket-weekend:     "yes every weekend in iti pavilion"
[x] first-crush:         "yes in tution"
```

### D.S.C.E. (2015-2019, mechanical engineering)

```yaml
[ x] hostel-room:         "didnt go to hostel travelled everyday from walking to 3 bus changes to college walk"
[x ] fest-stage:          "had great fun we did dance in the fest"
[x ] group-ride:          "yes everyday triples"
[x ] convocation:         "attended with parents"
```

### FEVER 104 FM (Mar-May 2019, radio internship)

```yaml
[x ] headphones:          "did"
[ x] script-binder:       "did"
[ x] sound-engineer:      "did"
[ x] trainee-cert:        "did"
```

### SAKHA GLOBAL (Jul 2019 - Sep 2022, first job)

```yaml
[x] interview-day:       "crazy feel first interview cracked after 5 failed attempts"
[x ] first-day-badge:     "liked it"
[x ] team-lunch:          "..."
[x] first-paycheck:      "bought watch and saree for dad and mum respectively"
[x] wfh-covid:           "changed my life, got bored eventually"
[x] office-standup:      "new experience"
[x] late-night-coding:   "yes was passionate"
[x] team-outing:         "yes did"
```

### SCRIPBOX (Sep 2022 - present, AI/MCP work)

```yaml
[x] onboarding:          "was great fun meet lot of friends"
[x] pr-review:           "did"
[x] anthropic-catalog:   "was excited after that did show off"
[x] whiteboard:          "gave knowledge transfer on things i learn with my peers"
[x] claude-code:         "best learnt ai skill as of now for me"
[x] anthropic-talk:      "success"
[x] coffee-setup:        "timepass"
[x] bangalore-traffic:   "okay sometimes"
```

### THE GT (Nov 16, 2025, VW Virtus delivery)

```yaml
[x] test-drive:          "yes"
[x] documents-signing:   "yes"
[x] keys-handover:       "yes"
[x] first-drive-out:     "yes"
```

### NOW (2026-present)

```yaml
[ x] morning-routine:     "..."
[x ] code-flow:           "..."
[ x] anthropic-goal:      "..."
[x ] forward-horizon:     "..."
```

---

## CONTACT URLs
*Used in the end-card CTA after journey completes.*

```yaml
resume:   "https://..."          # link to PDF resume
github:   "https://github.com/Pranavj17"
linkedin: "https://www.linkedin.com/in/..."
email:    "mailto:..."           # e.g. mailto:hello@example.com
```

---

## Examples (for vibe — replace, don't keep)

```yaml
[x] first-crush:    "Met her in 11th. We sat at the same coaching center for 2 years
                     before saying hi. She moved to Pune for Symbiosis. I stayed."

[x] wfh-covid:      "Lockdown started 3 days into a sprint. The cat learned where
                     the warm laptop was. I shipped 11 PRs from this corner of
                     the bedroom in March 2020 alone."

[x] anthropic-talk: "Watched Dario's Senate testimony at midnight Bangalore time.
                     Wrote my first MCP server the next weekend."
```

---

## When done

Just send "lore ready" in chat. I'll:
1. Read this file
2. Generate the BEATS array in journey.js from the marked entries
3. Wire all 5 features in one commit
4. Run regression suite
5. Push to deploy
