import * as v from "valibot";

const EnvSchema = v.object({
  GITHUB_TOKEN: v.optional(v.pipe(v.string(), v.minLength(1))),
  GOOGLE_API_KEY: v.optional(v.pipe(v.string(), v.minLength(1))),
  GEMINI_API_KEY: v.optional(v.pipe(v.string(), v.minLength(1))),
});

export const env = v.parse(EnvSchema, process.env);
