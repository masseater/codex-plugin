# discord-notify

Discord通知 — idle時にセッションの最新メッセージをDiscordスレッドに投稿。

## 環境変数

| 変数                        | 説明                                           |
| --------------------------- | ---------------------------------------------- |
| `DISCORD_NOTIFY_CHANNEL_ID` | 設定されていれば有効化 & 送信先チャンネルID    |
| `DISCORD_BOT_TOKEN`         | Botトークン（公式Discordプラグインと共有可能） |

## Components

| Type | Name          | Description  |
| ---- | ------------- | ------------ |
| hook | create-thread | SessionStart |
| hook | send-discord  | Stop (idle)  |

## Components

<!-- BEGIN:component-list (auto-generated, do not edit) -->

| Type | Name          | Description  |
| ---- | ------------- | ------------ |
| hook | create-thread | SessionStart |
| hook | send-discord  | Stop         |

<!-- END:component-list -->
