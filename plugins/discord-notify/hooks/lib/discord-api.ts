const DISCORD_API_BASE = "https://discord.com/api/v10";

export type DiscordMessage = {
  id: string;
};

export type DiscordThread = {
  id: string;
};

/**
 * Discord API のレスポンス本文から id を持つオブジェクトを取り出す。
 * @param body レスポンス本文の JSON
 * @param operation エラーメッセージに含める API 操作名
 * @returns id だけを持つオブジェクト
 */
function parseIdResponse(body: unknown, operation: string): { id: string } {
  if (hasStringId(body)) {
    return { id: body.id };
  }
  throw new Error(`Discord ${operation} returned a response without an id`);
}

function hasStringId(body: unknown): body is { id: string } {
  return typeof body === "object" && body !== null && "id" in body && typeof body.id === "string";
}

function headers(botToken: string): Record<string, string> {
  return {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  };
}

/**
 * Discord API に POST し、作成されたオブジェクトの id を返す。
 * @param pathSegments API のパスの要素（チャンネル ID などはここでエスケープする）
 * @param botToken Bot のトークン
 * @param body リクエスト本文
 * @param operation エラーメッセージに含める API 操作名
 * @returns 作成されたオブジェクトの id
 */
async function postDiscord(
  pathSegments: string[],
  botToken: string,
  body: unknown,
  operation: string,
): Promise<{ id: string }> {
  const url = `${DISCORD_API_BASE}/${pathSegments.map(encodeURIComponent).join("/")}`;
  // fallow-ignore-next-line security-sink -- origin は固定の Discord API で、パスの各要素は encodeURIComponent でエスケープしている
  const res = await fetch(url, {
    method: "POST",
    headers: headers(botToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Discord ${operation} failed (${res.status}): ${await res.text()}`);
  }
  return parseIdResponse(await res.json(), operation);
}

async function sendMessage(
  channelId: string,
  botToken: string,
  content: string,
): Promise<DiscordMessage> {
  return postDiscord(["channels", channelId, "messages"], botToken, { content }, "sendMessage");
}

async function createThread(
  channelId: string,
  messageId: string,
  botToken: string,
  name: string,
): Promise<DiscordThread> {
  return postDiscord(
    ["channels", channelId, "messages", messageId, "threads"],
    botToken,
    { name, auto_archive_duration: 1440 },
    "createThread",
  );
}

const DISCORD_MAX_LENGTH = 2000;

/**
 * 長さの上限の範囲で、後半に改行があればその直後を、無ければ上限ちょうどを分割位置にする。
 * @param remaining まだ送っていない本文
 * @returns 分割位置
 */
function splitPoint(remaining: string): number {
  const lastNewline = remaining.slice(0, DISCORD_MAX_LENGTH).lastIndexOf("\n");
  return lastNewline > DISCORD_MAX_LENGTH / 2 ? lastNewline + 1 : DISCORD_MAX_LENGTH;
}

function splitMessage(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > DISCORD_MAX_LENGTH) {
    const splitAt = splitPoint(remaining);
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  return [...chunks, remaining];
}

export { createThread, sendMessage, splitMessage };
