---
name: research:image-analyze
description: 'This skill should be used when the user asks to "analyze image", "compare screenshots", "visual diff", "PDFを解析", or wants image/PDF analysis using AI or local processing.'
---

# Image Analyze

Analyze or compare images and PDF documents. Two scripts available:

- **image-analyze.ts** - AI-powered analysis via Gemini API
- **image-process.ts** - Local image processing (API不要, offline)

## Scripts

Located at `./scripts`.

Run every script with `bun <path> ...` (e.g. `bun ./scripts/image-process.ts info --image x.png`).

| Script             | Description                                   | Requires API |
| ------------------ | --------------------------------------------- | :----------: |
| `image-analyze.ts` | AI analysis / comparison (images + PDF)       | Yes (Gemini) |
| `image-process.ts` | Pixel diff, edge, overlay, side-by-side, info |      No      |

---

### image-analyze.ts

AI-powered image analysis using Gemini API. Requires `GEMINI_API_KEY` (or `GOOGLE_API_KEY`).

Supported formats: PNG, JPEG, GIF, WebP, PDF

Arguments are **named flags** (not positional):

| Argument         | Required | Description                                     |
| ---------------- | -------- | ----------------------------------------------- |
| `--input`        | ✓        | First image/PDF path                            |
| `--compare`      |          | Second image/PDF path (enables comparison mode) |
| `--prompt`, `-p` |          | Custom prompt for analysis/comparison           |

**Analyze single image:**

```bash
bun ./scripts/image-analyze.ts --input ./screenshot.png
```

**Analyze PDF document:**

```bash
bun ./scripts/image-analyze.ts --input ./document.pdf
```

**Compare two images:**

```bash
bun ./scripts/image-analyze.ts --input ./before.png --compare ./after.png
```

**Compare two PDFs:**

```bash
bun ./scripts/image-analyze.ts --input ./v1.pdf --compare ./v2.pdf
```

**With custom prompt:**

```bash
bun ./scripts/image-analyze.ts --input ./design.png -p "Check if this follows Material Design guidelines"
```

---

### image-process.ts

Local image processing tool. No API key required.

#### Subcommands

| Subcommand     | Description                            |
| -------------- | -------------------------------------- |
| `diff`         | Pixel-level diff between two images    |
| `edge`         | Edge detection (Sobel filter)          |
| `overlay`      | Semi-transparent overlay of two images |
| `side-by-side` | Horizontal side-by-side comparison     |
| `info`         | Display image metadata                 |

#### diff

Compare two **same-size** images pixel by pixel. Outputs a diff image and match rate. Different-size inputs hard-fail with an error (unlike `overlay` / `side-by-side`, which auto-resize).

| Option        | Required | Default             | Description                           |
| ------------- | :------: | ------------------- | ------------------------------------- |
| `--image1`    |    ✓     |                     | Source image                          |
| `--image2`    |    ✓     |                     | Target image                          |
| `--output`    |          | `{image1}_diff.png` | Output path                           |
| `--threshold` |          | `0.1`               | Sensitivity (0-1, smaller = stricter) |

```bash
bun ./scripts/image-process.ts diff --image1 before.png --image2 after.png --threshold 0.05
```

#### edge

Extract edges using Sobel filter. Useful for comparing layout structure.

| Option     | Required | Default            | Description |
| ---------- | :------: | ------------------ | ----------- |
| `--image`  |    ✓     |                    | Input image |
| `--output` |          | `{image}_edge.png` | Output path |

```bash
bun ./scripts/image-process.ts edge --image screenshot.png
```

#### overlay

Overlay two images with adjustable opacity to visually spot differences.

| Option      | Required | Default                | Description           |
| ----------- | :------: | ---------------------- | --------------------- |
| `--image1`  |    ✓     |                        | Base image            |
| `--image2`  |    ✓     |                        | Overlay image         |
| `--output`  |          | `{image1}_overlay.png` | Output path           |
| `--opacity` |          | `0.5`                  | Overlay opacity (0-1) |

```bash
bun ./scripts/image-process.ts overlay --image1 before.png --image2 after.png --opacity 0.3
```

#### side-by-side

Place two images side by side for visual comparison.

| Option     | Required | Default                   | Description             |
| ---------- | :------: | ------------------------- | ----------------------- |
| `--image1` |    ✓     |                           | Left image              |
| `--image2` |    ✓     |                           | Right image             |
| `--output` |          | `{image1}_sidebyside.png` | Output path             |
| `--gap`    |          | `4`                       | Gap between images (px) |

```bash
bun ./scripts/image-process.ts side-by-side --image1 before.png --image2 after.png --gap 8
```

#### info

Display image metadata (dimensions, format, color space, file size, DPI, alpha).

| Option    | Required | Default | Description |
| --------- | :------: | ------- | ----------- |
| `--image` |    ✓     |         | Input image |

```bash
bun ./scripts/image-process.ts info --image screenshot.png
```

---

## Use Cases

- Design review and feedback (AI analysis)
- PDF document analysis and comparison (AI analysis)
- Screenshot comparison for UI testing (diff, side-by-side)
- Visual diff between design iterations (diff, overlay)
- Layout structure comparison (edge detection)
- Image metadata inspection (info)
- Accessibility analysis of UI elements (AI analysis)
