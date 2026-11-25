import { GoogleGenAI } from "@google/genai";
import * as z from "zod";

const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const RETRY_DELAYS_MS = [1500, 3000, 6000];

let cachedAiClient = null;
let cachedApiKey = null;

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error("GEMINI_API_KEY is not configured.");
    err.status = 500;
    throw err;
  }

  if (!cachedAiClient || cachedApiKey !== apiKey) {
    cachedAiClient = new GoogleGenAI({ apiKey });
    cachedApiKey = apiKey;
  }

  return cachedAiClient;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableQuotaOrServiceError(err) {
  const numericStatus = Number(
    err?.status ??
      err?.statusCode ??
      err?.code ??
      err?.error?.code ??
      err?.cause?.status
  );

  if (Number.isFinite(numericStatus) && numericStatus > 0) {
    return numericStatus === 429 || numericStatus === 503;
  }

  const msg = String(err?.message || "");
  return (
    /\b(429|503)\b/.test(msg) ||
    /RESOURCE_EXHAUSTED|UNAVAILABLE|Too Many Requests|Service Unavailable/i.test(
      msg
    )
  );
}

async function callModelWithRetry(ai, { model, parts, config, schema }) {
  let lastError;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
        config,
      });

      const rawText = response?.text;
      if (!rawText) {
        throw new Error(`Gemini model "${model}" returned an empty response.`);
      }

      return schema.parse(JSON.parse(rawText));
    } catch (err) {
      lastError = err;
      const canRetry =
        isRetryableQuotaOrServiceError(err) &&
        attempt < RETRY_DELAYS_MS.length;

      if (!canRetry) {
        throw err;
      }

      const delayMs = RETRY_DELAYS_MS[attempt];
      console.warn(
        `[geminiClient] ${model} returned 429/503 (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}); retrying in ${delayMs}ms`
      );
      await sleep(delayMs);
    }
  }

  throw lastError;
}

/**
 * Generates structured JSON from Gemini using @google/genai and validates it
 * against a Zod v4 schema with retries and automatic fallback on 429/503.
 */
export async function generateStructured({
  parts,
  schema,
  systemInstruction,
  modelOverride,
}) {
  if (!schema || typeof schema.parse !== "function") {
    throw new Error("generateStructured requires a valid Zod schema.");
  }

  const normalizedParts = Array.isArray(parts) ? parts : [parts];
  if (normalizedParts.length === 0 || !normalizedParts[0]) {
    throw new Error("generateStructured requires at least one content part.");
  }

  const ai = getAiClient();
  const defaultModel = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const primaryModel = modelOverride || defaultModel;

  const config = {
    ...(systemInstruction !== undefined ? { systemInstruction } : {}),
    temperature: 0.1,
    responseMimeType: "application/json",
    responseJsonSchema: z.toJSONSchema(schema),
  };

  try {
    return await callModelWithRetry(ai, {
      model: primaryModel,
      parts: normalizedParts,
      config,
      schema,
    });
  } catch (err) {
    if (
      modelOverride &&
      primaryModel !== defaultModel &&
      isRetryableQuotaOrServiceError(err)
    ) {
      console.warn(
        `[geminiClient] ${primaryModel} exhausted retries on 429/503; falling back to ${defaultModel}`
      );
      return await callModelWithRetry(ai, {
        model: defaultModel,
        parts: normalizedParts,
        config,
        schema,
      });
    }
    throw err;
  }
}
