# Autonomous mode · log

User went to sleep at ~1:20 AM IST, gave me 5 hours.
Wake-up planned: ~6:30 AM IST.

## Constraints I'm setting myself
- NO regenerating stage videos unless specific quality issue (saves API credits)
- Test after every commit (zero console errors required)
- Conservative changes (don't break existing features)
- Use ScheduleWakeup to pace · ~35-45min batches

## Planned batches

### Batch 1 (NOW) · UI polish + lore enrichment
- Rewrite thin "Did." beat lore strings into substantial sentences
- Add beats counter to score panel (X/44)
- Improve mobile responsive HUD
- Better tap-hint copy
- Add small "share" pill to end-card
- Polish progress dots (era hint on tap)

### Batch 2 (T+45min) · Story depth
- Add 6-10 new beats for specific moments (childhood pets, friendships, etc.)
- Add chatter arrays to beats that lack them
- Expand landmark lore with more Bangalore detail

### Batch 3 (T+90min) · SFX enhancements  
- Add 3-4 new SFX types (food vendor, prayer bell, monsoon thunder, applause)
- Balance volumes across all SFX
- Verify mobile audio (puppeteer mobile emulator)

### Batch 4 (T+135min) · Visual enrichments
- Street food carts in scenes
- Better animations on more beats
- More birds/wildlife in sky
- Polish character walk

### Batch 5 (T+180min) · Sharper videos
- Re-encode existing MP4s with ffmpeg unsharp mask
- Boost contrast
- Better video compression

### Batch 6 (T+225min) · Final polish + smoke test
- Comprehensive puppeteer test
- Mobile screenshot review
- Final commit + push
