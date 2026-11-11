# devkit

開発ツールキット — 技術スタック定義・プロジェクトセットアップ・品質自動化を提供するプラグイン。

## インストール

```bash
/plugin marketplace add masseater/codex-plugin
/plugin install devkit@masseater-plugins
```

## 環境変数

- `DEVKIT_ENFORCE_TOOLS=1`: `npx` / `npm` / `tsc` の実行を止め、`pnpx` / `pnpm` / `tsgo` へ誘導する
- `DEVKIT_AUDIT_ON_STOP=1`: セッション中に増えた devkit 規約違反を、ターンの終わりに Claude へ通知する
