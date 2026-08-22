# Student Hub v1.0 Release Notes

## Version

**Student Hub v1.0 RC** (Release Candidate)

Target production start: **2026-09-01**

After this RC, core information architecture and Interaction Model should not change in large ways while prior-term data is entered and operations begin.

---

## Core workflow

```text
일이 있었다 → Record
다음에 확인한다 → Follow-up
지금 계속 본다 → Focus
오래 이어진다 → Case
깊게 분석한다 → Deep Tracking (optional)
```

Ordinary students can be managed with **Record / Focus / Follow-up** alone.

---

## Main views

| Area | Contents |
|------|----------|
| **Dashboard** | Overview + Before Class tab |
| **Students** | Students, Classes |
| **Actions** | Follow-ups, Review Queue, Calendar |
| **Library** | Cases, Messages, Work Notes |

Top-level nav stays grouped (Phase 4A). Before Class is not a top-level item.

---

## Main student surfaces

- **Student Profile** — Operational / Now (Focus, Open Actions, Cases, Timeline)
- **Learning & Behavior Profile** — Longitudinal / Over Time
- **Consultation Summary** — Brief (20–30s) + detailed sections
- **Deep Tracking** — Evidence → Interpretation → Intervention

---

## What v1.0 includes (high level)

- Auth (single-user MVP)
- Terms / Classes / Students / Class history
- Quick Record + Timeline + Tags + Important
- Focus, Follow-up, Stamp, Management status
- Calendar (Record date vs Due date)
- Before Class (Dashboard tab)
- Review Queue
- Messages / Work Notes archives
- Cases (N:M with records)
- Psychology tracking: Voice, Hypothesis, Evidence, Intervention, Response
- ABC / Context / Hypothesis↔Intervention
- Pattern Tracker (descriptive)
- Learning Profile + Consultation notes

---

## Known limitations

- **RLS**: authenticated-all style single-user MVP — not multi-teacher isolation
- **Mobile**: usable on narrow width; not a full mobile redesign
- **Manual QA** still required before freeze
- **No** grade / score integration
- **No** PDF export / AI analysis / custom taxonomy builder
- Security hardening (multi-user) deferred to a dedicated stage

---

## Deferred (post–v1.0)

- Advanced multi-user / ownership redesign
- Export / PDF
- Custom taxonomy management UI
- Tracking Mode DB field
- AI classification / recommendations
- Full E2E automation suite
- Technical Stabilization follow-ups beyond this RC

---

## Migrations

Apply SQL **001 → 012** (and seeds as documented in README).  
**v1.0 RC adds no new migration.**

---

## QA

- Release checklist: `docs/V1_RELEASE_QA.md`
- Phase / feature QA docs under `docs/` remain for deep dives
