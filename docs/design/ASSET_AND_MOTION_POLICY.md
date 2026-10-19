# Assets, Iconography and Motion — Sourcing Policy

This is a production codebase, not a design moodboard. External assets may be downloaded and saved locally for the authorized redesign, but **never treat internet visibility as permission to reproduce**.

## Allowed preference order

1. **Existing real shop/product images** served through current UniStore APIs with relevant permissions. Preserve their provenance; never convert another seller's photo into a different seller's listing.
2. **Original vector UI built from code** (brand mark, layout shapes, progress markers, primitives) and a consistent verified permissive icon set.
3. **Permissively licensed icon components**, primarily Lucide (ISC; selected Feather-derived MIT; include copyright/license notices in third-party credits). Icons need text labels or meaningful accessible names for controls.
4. **Photos genuinely useful to explain campus-life contexts**, from licensed sources such as Unsplash for editorial campaigns/backgrounds only, not as a substitute for actual product or store photos. Record page, author, date, original URL, license, and what it represents.
5. **MotionSites** is inspiration only: observe structure, typography, visual rhythm and interaction behavior. Do not download/re-host its gated commercial templates, prompts, premium footage or branded assets without explicit rights.

## Asset manifest (maintain as assets are added)

Record each downloaded item in `docs/design/ASSET_MANIFEST.json` with `localPath`, `originalUrl`, `sourcePage`, `author`, `license`, `attribution`, `purpose`, `contentType`, `sizeBytes`, and `verifiedAt`. Do not add an entry for an asset that was not actually fetched/verified. Current discovery includes **no downloaded assets**.

## Performance and accessibility

- Prefer local, optimized SVGs for icons with a consistent stroke weight (not arbitrary mixed Emoji/3D glyphs).
- For photos use responsive sizes, explicit aspect ratio, WebP/AVIF where compatible, and lazy loading for noncritical visual content; prevent layout shift.
- Do not add heavy UI/animation libraries as a default; CSS transitions and reduced-motion handling are preferred for production operational screens.
- For non-decorative visuals provide meaningful Thai alternative text. Do not use photos with identifiable people, trademarks or artwork in ways that exceed permitted rights.
- Buttons must remain obvious without hover. Click/touch target, focus state and status feedback take priority over aesthetic decoration.
- Animation is for transitions, system feedback or purposeful product storytelling; never delay form completion, page data, role switching or error recovery.

## Canonical licensing sources

- https://lucide.dev/license — ISC (plus Feather derived MIT where noted).
- https://unsplash.com/license — free use subject to specific restrictions; check publisher details.
- https://motionsites.ai/ and https://motionsites.ai/motionsite — inspiration only; no assumption that prompts/design assets are open-source.

**No external media, font or icon has yet been copied into this repository as part of the redesign.**
