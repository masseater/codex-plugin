---
name: write-article
description: Write and publish Zenn tech articles. Use when the user asks to write a Zenn article, publish a tech blog post, or turn conversation context into a Zenn article.
---

# Zenn Article Writer

Generate Zenn tech articles from conversation context or specified topics, and publish to the `masseater/zenn-article` repository.

## Workflow

1. **Determine source** — Based on user instructions, compose the article using one of:
   - **Conversation context mode**: Summarize technical content from the current session into an article
   - **Topic mode**: Write about a user-specified topic, referencing conversation context as needed
2. **Generate article** — Produce the article in Zenn Markdown format
3. **Review** — Present the generated article to the user and incorporate feedback
4. **Publish** — Create the file in the Zenn repository, push to a new branch, and open a PR

## Zenn Repository Info

- **GitHub**: `masseater/zenn-article`
- **Local path**: Read from `../../config/repo-path.txt`. If the file does not exist, ask the user for the path, then save it to that file for future use
- **Articles directory**: `articles/`
- **Images directory**: `images/`
- **Default branch**: `master`

## Article Format

### Frontmatter

```yaml
---
title: "Article title"
emoji: "one relevant emoji"
type: "tech"
topics: [relevant-topics, max-5]
published: false
---
```

- Always set `published: false`. The user decides when to publish on Zenn
- Prefer existing Zenn tags for `topics` (e.g., `claude-code`, `typescript`, `react`)
- Choose one emoji that relates to the article content

### Slug (filename)

- Use kebab-case that describes the content (e.g., `claude-code-plugin-intro.md`)
- Do not use random hashes

## Writing Style Guidelines

Strictly follow these rules extracted from the author's past articles. The article MUST be written in Japanese.

### Target Audience

- Assume readers already know the basics of the tools and libraries mentioned. Do NOT over-explain well-known tools
- Skip introductory explanations like "X is a tool that does Y" for mainstream tools (e.g., Claude Code, TypeScript, Git, React). A one-liner at most if context is needed
- Focus on **what the author did, why, and what was learned** — not on teaching the reader how the tool works
- Only explain niche or lesser-known tools/libraries briefly when they are central to the article

### Tone

- Write in **casual Japanese**. Use polite form (desu/masu) as the base, but mix in informal expressions
- Address the reader directly (e.g., "Claude Code, use it? I assume you do, so I'll skip the detailed explanation.")
- Share honest impressions and reflections (e.g., "I thought this was a pretty interesting result", "Not sure if it works. Just a vibe.")
- Insert natural quips and self-deprecation when appropriate (e.g., "What even is this... Oh well.", "That's NOT how it should turn out")
- Don't force humor. Only add quips when there's genuinely something funny

### Structure

- Always start with a **"tl;dr"** section right after the frontmatter — a 1-3 line summary of the key takeaway
- Open with **"はじめに"** (Introduction) — briefly state the background and motivation
- Structure the body with a logical flow
- Close with **"おわりに"** or **"まとめ"** (Conclusion) — reflect and mention next steps
- Keep sections short. Split if they get long

### Technical Content

- Keep technical terms, library names, and commands in English (e.g., `Claude Code`, `git worktree`, `Bun`)
- Always specify language in code blocks (`typescript, `bash, etc.)
- Actively include GitHub links to actual source code
- Use mermaid diagrams to illustrate architecture when helpful
- Leverage Zenn syntax (`:::details`, `:::message`, bare URL auto-embedding)

### Do NOT

- Use overly polite preambles ("I would like to introduce...")
- Use AI-sounding template phrases ("Let's take a look!", "How was it?", "In this article, we will explore...")
- List things in bullet points when prose would be better
- Pretend to know things you don't actually know

## Publishing Steps

After the article is finalized:

1. Navigate to the Zenn repository local path
2. Create a new branch from `master` (format: `article/{slug}`)
3. Create the file at `articles/{slug}.md`
4. Commit and push
5. Open a PR with `gh pr create`

```bash
# Example
cd /path/to/zenn-article
git checkout master && git pull
git checkout -b article/claude-code-plugin-intro
# ... create file ...
git add articles/claude-code-plugin-intro.md
git commit -m "Add article: Claude Code plugin introduction"
git push -u origin article/claude-code-plugin-intro
gh pr create --title "Add article: Claude Code plugin introduction" --body "$(cat <<'EOF'
## Summary
- Add article about Claude Code plugin introduction

## Note
- `published: false` (draft state)
EOF
)"
```

## Important Notes

- `published` MUST always be `false`. Publishing decisions are made by the user
- If images are needed, instruct the user to use Zenn's image upload feature (local images go in `images/`)
- Always ask the user to review the article content before creating a PR
- Restructure conversation content into a proper article — do not paste raw conversation
