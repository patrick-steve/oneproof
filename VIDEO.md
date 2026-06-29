# Walkthrough video — 90 seconds

## Why a video at all

Hackathon judges have minutes per submission. A 90-second walkthrough lands the value proposition before they ever click anything. The README and landing both link to it; if a judge watches nothing else, they should watch this.

## Production setup

- **Tool:** Loom (free tier is enough), or QuickTime + YouTube Unlisted.
- **Display:** 1080p or higher. Browser at ~85% zoom so text reads cleanly when scaled.
- **Mic:** Whatever you have. Built-in laptop mic is fine if quiet room.
- **Tabs to have open BEFORE you hit record:**
  1. `http://localhost:3000` (the landing, scrolled to top)
  2. `http://localhost:3000/console` (the demo page, defaults `anon` / `1000`)
  3. Freighter extension installed + connected to Stellar testnet
- **Pre-warm:** hit `https://oneproof.fly.dev/healthz` 30 seconds before recording so the machine is warm.

## The script (90 seconds, with timing)

> **Read it like you're showing a colleague, not pitching VCs. Pause between sentences. Don't rush.**

### 0:00 — 0:10 · landing hero (10s)
> *"OneProof. We make on-chain ZK verification cost flat on Stellar — no matter how many proofs are inside. Here's the chart."*
- Cursor on the hero, eyes on the chart.
- Drag the N slider from low to high. Yellow climbs. Blue stays flat.

### 0:10 — 0:25 · the problem (15s)
> *"Today, every zero-knowledge proof needs its own on-chain verification. A thousand users means a thousand transactions. That's the wall every privacy app hits."*
- Scroll to "The problem" section. Pause on the WallViz bars.
- Cursor moves over the "off the chart →" badge.

### 0:25 — 0:40 · the solution (15s)
> *"We aggregate many proofs into one — and the chain verifies that single proof in one transaction. Cost stops scaling with N."*
- Scroll to the Pipeline section. Let the R3F animation play for 3-4 seconds.
- No need to scroll all the way through; just enough to show motion.

### 0:40 — 1:20 · the live demo (40s — the meat)
> *"Let me show you. I'm on /console, this is the live demo on Stellar testnet."*
- Cursor moves to the URL bar, navigate to `/console`.
> *"I'll type in some inputs. Amount 500. Nickname `judgedemo`. Click generate."*
- Type the inputs. Click "generate inner proof →".
- During the ~5 second wait: *"The backend is generating a real UltraHonk proof from my inputs right now."*
> *"Now I aggregate this with three companion proofs."*
- Click "aggregate with 3 companions →". The progress UI shows bb stderr live.
- During the wait: *"The phases you see are actual bb output — KZG accumulator, FFT, polynomial commitments, the works."*
- When it completes: *"4 proofs collapsed into 1 outer proof."*
> *"I'll sign with Freighter and submit."*
- Click "sign with Freighter →". Approve in Freighter. Tx settles.
> *"Done. That's one transaction on Stellar, verifying four zero-knowledge proofs. Same cost as one."*
- Cursor on the receipt panel. Highlight the tx hash.

### 1:20 — 1:30 · the close (10s)
> *"Constant cost regardless of N. The full plan, the math, the source — all linked. Thanks."*
- Cut back to the landing or to the GitHub repo.

**Total: 90 seconds.**

## After recording

1. Upload to Loom (or YouTube Unlisted).
2. Get the share URL.
3. Replace the placeholder in two places:
   - `README.md` line 1 (or wherever the placeholder lives)
   - `web/app/page.tsx` hero CTA row — there's a `<VideoCTA href="..." />` placeholder you swap in.
4. Commit + push. Done.

## Backup plan if the live demo breaks mid-recording

You have three backup options for the 0:40–1:20 segment:

- **A. Use defaults** (`anon` / `1000`). That hits the prebaked cache, so the aggregate step is instant. Less impressive but reliable.
- **B. Cut around the wait.** Record the click → cut → record the receipt. Audiences expect quick cuts; nobody minds.
- **C. Use a screen recording you saved earlier.** Pre-record a clean successful run, B-roll it in.

## What NOT to say

- Don't read the landing copy aloud. Show, don't narrate.
- Don't apologize for anything ("sorry the proving takes a few seconds…"). Either it's fast enough or it's part of the story.
- Don't mention the words "hackathon" or "judges." Talk like you're showing the product to anyone.
- Don't try to explain the cryptography. The landing does that. The video is "watch this work."
