/**
 * Figma REST API レスポンスの valibot スキーマ。
 * figma-scaffold / figma-data の export-screenshot など複数スクリプトが参照する単一ソース。
 */

import * as v from "valibot";

export type FigmaNode = {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[] | undefined;
};

const FigmaNodeSchema: v.GenericSchema<FigmaNode> = v.object({
  id: v.string(),
  name: v.string(),
  type: v.string(),
  children: v.optional(v.array(v.lazy((): v.GenericSchema<FigmaNode> => FigmaNodeSchema))),
});

const FigmaFileResponseSchema = v.object({
  document: FigmaNodeSchema,
  name: v.string(),
});

export type FigmaFileResponse = v.InferOutput<typeof FigmaFileResponseSchema>;

const FigmaImagesResponseSchema = v.object({
  err: v.nullable(v.string()),
  images: v.record(v.string(), v.nullable(v.string())),
});

export type FigmaImagesResponse = v.InferOutput<typeof FigmaImagesResponseSchema>;

/**
 * 値を FigmaFileResponse としてパースする。失敗時は Error を投げる。
 * @param value パース対象の値
 * @returns パース済みの FigmaFileResponse
 */
export function parseFigmaFileResponse(value: unknown): FigmaFileResponse {
  const result = v.safeParse(FigmaFileResponseSchema, value);
  if (!result.success) {
    throw new Error("Unexpected Figma API response format");
  }
  return result.output;
}

/**
 * 値を FigmaImagesResponse としてパースする。失敗時は Error を投げる。
 * @param value パース対象の値
 * @returns パース済みの FigmaImagesResponse
 */
export function parseFigmaImagesResponse(value: unknown): FigmaImagesResponse {
  const result = v.safeParse(FigmaImagesResponseSchema, value);
  if (!result.success) {
    throw new Error("Figma API: unexpected response format");
  }
  return result.output;
}
