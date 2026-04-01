type DiscordEnv = {
  channelId: string;
  botToken: string;
};

/**
 * 環境変数からDiscord設定を読み取る。
 * DISCORD_NOTIFY_CHANNEL_ID が未設定なら null（プラグイン無効）。
 * CHANNEL_ID があるのに DISCORD_BOT_TOKEN が無い場合はエラー。
 */
function readDiscordEnv(): DiscordEnv | null {
  const channelId = process.env.DISCORD_NOTIFY_CHANNEL_ID;
  if (!channelId) return null;

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    throw new Error("DISCORD_NOTIFY_CHANNEL_ID is set but DISCORD_BOT_TOKEN is missing");
  }

  return { channelId, botToken };
}

export { readDiscordEnv };
