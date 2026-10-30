# Image questions

Clickable prototype: `source/ImageQuestion.dc.html` (board "Image questions · prototype"). It is one board with a host side, a player phone and a demo console. Sample library images are in `assets/image-library/`.

## Scope
- A question may have **one optional image**. Text-only questions keep their existing layout.
- Image source: the **curated library** (8 bundled images) or an **upload** (JPEG, PNG or WebP, up to 5 MB).
- Out of scope: pasted image URLs, AI-generated images, image answer choices, animated images (GIF), "Pin on Image".
- Answer keys now use card suits: heart (tangerine), diamond (cobalt, white shape), spade (sun), club (mint).

## Flow
Build → Prepare players → Question → Reveal (or Voided) → Next question.

## Builder (host)
- **Add image** opens a dialog with two tabs: **Library** (categories, host-only names) and **Upload your own**.
- Upload tab: file picker, "JPEG, PNG or WebP · up to 5 MB", and the reminder "Only upload images you have permission to share. Everyone playing will see this picture on their phone."
- Errors in the dialog (role=alert), each with "Choose a different file":
  - Unsupported type: "That file type isn't supported".
  - Over 5 MB: "That file is too large" (shows the file size and the limit).
- Valid file: dialog closes, the image slot shows file name, size, a progress bar (`role=progressbar`), then "Checking your image…", then the preview. **Cancel** is available while uploading.
- Failed upload: "Upload didn't finish" with **Retry** and **Cancel**. Nothing is added to the question.
- Ready image: **Replace**, **Remove**, and an editable **image description** (screen-reader text; do not give the answer away). Uploads are labelled "YOUR UPLOAD · name · size".
- **Start is blocked** while an upload is uploading, being checked, or failed: "Play this question" is disabled with an explanation, and the later flow steps are disabled.
- The phone preview shows a loading placeholder while an upload is pending.

## Prepare (host and players)
- Players load the image before the timer starts. The host sees how many are ready.
- Delayed (slow loading): **Wait a few seconds**, **Start anyway**, **Skip question** (no scoring). Never "everyone must be ready".
- Failed for some players: **Void question for everyone** or **Start anyway**.
- Player phone: "Getting your question ready…", then Retry on failure.

## Question
- Image sits in a fixed-height box (190px, 150px at 320px wide), shown whole (contain), so layout never shifts.
- Tapping the image opens an enlarge dialog with a visible countdown and a Close button. Esc closes it. The clock keeps running.
- Timer starts at the same moment for everyone.

## Reveal and void
- Reveal keeps the image, highlights the correct answer, shows answer distribution and an optional "Did you know" fact.
- **Voided** is visually distinct from wrong: neutral, striped and dashed, "Question voided", no points change, scores and streaks kept.

## Accessibility
- Works down to 320px wide. Dialogs trap focus and have a visible close control. Status changes use live regions (not per-percent updates).
- Reduced motion is honoured (`prefers-reduced-motion`) and there is a demo toggle.
- Colour is never the only signal: answer keys pair colour with a suit.

## Prototype-only controls (do not build)
Console toggles: Loading Normal/Slow, Player image Loads/Fails, Upload Works/Fails, Phone 390/320, Reduce motion, Jump to 3 s left, Restart; sample upload files in the Upload tab; timed fake upload (~3.6 s).

## Needs real implementation
Server-side upload, type sniffing and size enforcement, content moderation before players see an image, image storage and delivery, and a preload step before the timer starts.
