#!/usr/bin/env bun
/**
 * Gemini API を使用して画像を分析・比較する
 */

import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { GoogleGenAI } from "@google/genai";
import { defineCommand, runMain } from "citty";
import { env } from "../../../env.js";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? "image/png";
}

async function loadImageAsBase64(filePath: string): Promise<{ data: string; mimeType: string }> {
  const buffer = await readFile(filePath);
  const data = buffer.toString("base64");
  const mimeType = getMimeType(filePath);
  return { data, mimeType };
}

function isPdf(filePath: string): boolean {
  return extname(filePath).toLowerCase() === ".pdf";
}

async function analyzeImage(ai: GoogleGenAI, imagePath: string, prompt?: string): Promise<string> {
  const image = await loadImageAsBase64(imagePath);

  const defaultPrompt = isPdf(imagePath)
    ? `Analyze this PDF document in detail. Describe:
1. Document structure and content summary
2. Key information and data points
3. Visual elements (tables, charts, images if any)
4. Overall purpose and intended audience`
    : `Analyze this image in detail. Describe:
1. What is shown in the image
2. Key visual elements (colors, layout, typography if any)
3. Overall impression and purpose`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt ?? defaultPrompt },
          { inlineData: { data: image.data, mimeType: image.mimeType } },
        ],
      },
    ],
  });

  return response.text ?? "No analysis generated";
}

async function compareImages(
  ai: GoogleGenAI,
  imagePath1: string,
  imagePath2: string,
  prompt?: string,
): Promise<string> {
  const [image1, image2] = await Promise.all([
    loadImageAsBase64(imagePath1),
    loadImageAsBase64(imagePath2),
  ]);

  const fileType = isPdf(imagePath1) || isPdf(imagePath2) ? "documents" : "images";
  const defaultPrompt = `Compare these two ${fileType} in detail:

File 1: ${basename(imagePath1)}
File 2: ${basename(imagePath2)}

Analyze and report:
1. Key differences between the ${fileType}
2. Similarities
3. Which elements changed and how
4. Overall assessment of the changes`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt ?? defaultPrompt },
          { inlineData: { data: image1.data, mimeType: image1.mimeType } },
          { inlineData: { data: image2.data, mimeType: image2.mimeType } },
        ],
      },
    ],
  });

  return response.text ?? "No comparison generated";
}

const main = defineCommand({
  meta: {
    name: "image-analyze",
    description: "Gemini API で画像を分析・比較",
  },
  args: {
    input: {
      type: "string",
      description: "First image path (required)",
      required: true,
    },
    compare: {
      type: "string",
      description: "Second image path (optional, for comparison mode)",
      required: false,
    },
    prompt: {
      type: "string",
      description: "Custom prompt for analysis/comparison",
      alias: "p",
    },
  },
  async run({ args }) {
    const apiKey = env.GOOGLE_API_KEY ?? env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Error: GOOGLE_API_KEY or GEMINI_API_KEY environment variable is not set");
      process.exit(1);
    }

    const ai = new GoogleGenAI({ apiKey });
    const imagePath1 = args.input;
    const imagePath2 = args.compare;
    const customPrompt = args.prompt;

    try {
      if (imagePath2) {
        const analysis = await compareImages(ai, imagePath1, imagePath2, customPrompt);
        console.log(analysis);
      } else {
        const analysis = await analyzeImage(ai, imagePath1, customPrompt);
        console.log(analysis);
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  },
});

runMain(main);
