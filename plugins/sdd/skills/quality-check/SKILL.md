---
name: sdd:quality-check
description: 仕様書の品質チェック（矛盾検出・ステアリング準拠確認）
argument-hint: <spec>
allowed-tools: Task, Read, Glob
---

# 品質チェック

指定された spec に対して品質チェックを実行する。

## 実行内容

以下の SubAgent を起動して品質チェックを実施:

1. **contradiction-checker**: ドキュメント間の矛盾検出
2. **steering-reviewer**: ステアリングドキュメントへの準拠確認

## 手順

1. `specs/{spec}/` の存在を確認
2. contradiction-checker SubAgent を起動
3. steering-reviewer SubAgent を起動
4. 結果をまとめて報告
