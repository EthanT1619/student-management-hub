# Message Archive — Later QA Checklist

Run after applying `supabase/migrations/007_message_archive.sql`.

## Setup

1. SQL Editor → run `007_message_archive.sql`
2. Refresh app → open **Messages**

## Scenarios

### A — Class Message
- New Message → Purpose Dream Tree → Target one Class → Save
- Filter by that Class → message appears

### B — Student Message
- New Message → Purpose 개별 피드백 → Target one Student → Save
- Open that Student Profile → **Messages N** → item visible

### C — Purpose browse
- Create several Dream Tree messages
- Purpose filter = Dream Tree → all listed newest first

### D — Duplicate
- Open Archive message → **Duplicate as New**
- Date = today, content copied, targets empty → Save as new
- Original unchanged

### E — Template
- Detail → **Save as Template** → Templates tab
- **Use Template** → New Message form prefilled
- Template does not appear in Archive list

### F — Search
- Search a unique phrase from content → matching message found

### G — Class Detail link
- Class Detail → **Messages** → `/messages?classId=...` filtered

## Out of scope (do not expect)
- SMS / Kakao send
- Auto Record creation from Message
- Full Class History–based student inference for old class messages
