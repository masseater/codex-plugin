import * as v from "valibot";

const EnvSchema = v.object({
  GITHUB_TOKEN: v.pipe(v.string(), v.minLength(1)),
});

export const env = v.parse(EnvSchema, process.env);
