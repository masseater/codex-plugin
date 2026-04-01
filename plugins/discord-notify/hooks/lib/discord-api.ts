const DISCORD_API_BASE = "https://discord.com/api/v10";

type DiscordMessage = {
  id: string;
};

type DiscordThread = {
  id: string;
};

function headers(botToken: string): Record<string, string> {
  return {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  };
}

async function sendMessage(
  channelId: string,
  botToken: string,
  content: string,
): Promise<DiscordMessage> {
  const res = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: headers(botToken),
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord sendMessage failed (${res.status}): ${body}`);
  }
  return (await res.json()) as DiscordMessage;
}

async function createThread(
  channelId: string,
  messageId: string,
  botToken: string,
  name: string,
): Promise<DiscordThread> {
  const res = await fetch(
    `${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}/threads`,
    {
      method: "POST",
      headers: headers(botToken),
      body: JSON.stringify({ name, auto_archive_duration: 1440 }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord createThread failed (${res.status}): ${body}`);
  }
  return (await res.json()) as DiscordThread;
}

const DISCORD_MAX_LENGTH = 2000;

function splitMessage(text: string): string[] {
  if (text.length <= DISCORD_MAX_LENGTH) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= DISCORD_MAX_LENGTH) {
      chunks.push(remaining);
      break;
    }

    const slice = remaining.slice(0, DISCORD_MAX_LENGTH);
    const lastNewline = slice.lastIndexOf("\n");
    const splitAt = lastNewline > DISCORD_MAX_LENGTH / 2 ? lastNewline + 1 : DISCORD_MAX_LENGTH;

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  return chunks;
}

export { createThread, DISCORD_MAX_LENGTH, sendMessage, splitMessage };
