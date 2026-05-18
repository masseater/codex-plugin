# diagram-render Plugin Development Guide

Markdown + Mermaid を [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid) で SVG に変換し、CSS 埋め込みの自己完結 HTML を出力するプラグイン。

## Overview

- `skills/render/` — Markdown→HTML 変換スクリプトと SKILL.md
- `skills/draw-diagram/` — 図種別ガイドつきの作図ワークフロースキル

`render` が低レベル変換、`draw-diagram` が高レベルの図作成スキルで、後者は前者を呼び出して使う。

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type  | Name         | Description                                                                                                                                                                                                                                                                                                                                                                                    |
| ----- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| skill | draw-diagram | Markdown + Mermaid でアーキテクチャ図・システム構成図・フローチャート・依存関係図・シーケンス図・ER図などを作成し、`render` スキル経由で HTML 化する。Use when the user asks to "アーキテクチャ図を書いて", "システム構成図", "フローチャート作成", "依存関係を図に", "draw an architecture diagram", "make a flowchart", "diagram", or wants any visual diagram delivered as a viewable HTML. |
| skill | render       | Markdown + Mermaid を beautiful-mermaid で SVG にレンダリングし、自己完結 HTML として出力する。Use when the user asks to render a Markdown file with mermaid diagrams to HTML, "markdown を HTML に変換", "mermaid を SVG で埋め込んだ HTML を作って", or wants to produce a shareable HTML report with embedded diagrams.                                                                     |

<!-- END:component-list -->

## Dependencies

- `beautiful-mermaid` — Mermaid → SVG レンダラ (同期, DOM 非依存)
- `marked` — Markdown → HTML
- `shiki` — コードブロックのシンタックスハイライト (インラインスタイル埋め込み)
- `citty` — CLI 引数パース
