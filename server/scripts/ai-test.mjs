import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const apiKey = process.env.ADAPTION_API_KEY;
if (!apiKey) {
  console.error('ADAPTION_API_KEY is not set in process.env.');
  process.exit(1);
}

const endpoint = 'https://api.prod.adaptionlabs.ai/api/v1/responses';
const safetyInstruction = 'Only restate the provided data. Do not give medical advice.';
const pixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jHn8AAAAASUVORK5CYII=';

async function probe(label, model, input) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, instructions: safetyInstruction, input, max_output_tokens: 64, temperature: 0 }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      console.log(`${label} (${model}): FAILED (HTTP ${response.status})`);
      return false;
    }
    const result = await response.json();
    const ok = result.status === 'completed' && typeof result.output_text === 'string' && result.output_text.length > 0;
    const inputTokens = Number(result.usage?.input_tokens ?? 0);
    const outputTokens = Number(result.usage?.output_tokens ?? 0);
    const rates = model === 'deepseek-v4-flash' ? { input: 0.045, output: 0.14 } : model === 'gemma-4-31b-it' ? { input: 0.09, output: 0.34 } : null;
    const estimatedCredits = rates ? (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000 : null;
    console.log(`${label} (${model}): ${ok ? 'OK' : `FAILED (${result.status ?? 'no status'})`}; ${inputTokens} input + ${outputTokens} output tokens${estimatedCredits === null ? '' : `; estimated ${estimatedCredits.toFixed(9)} credits`}`);
    return ok;
  } catch (error) {
    const message = error instanceof Error && error.name === 'TimeoutError' ? 'timed out after 10s' : 'request failed';
    console.log(`${label} (${model}): FAILED (${message})`);
    return false;
  }
}

const textOk = await probe('Text model', process.env.AI_TEXT_MODEL || 'deepseek-v4-flash', 'Reply with the single word OK.');
const imageOk = await probe('Vision model', process.env.AI_VISION_MODEL || 'gemma-4-31b-it', [
  { role: 'user', content: [
    { type: 'input_text', text: 'Describe the provided image in one word.' },
    { type: 'input_image', image_url: `data:image/png;base64,${pixelPng}` },
  ] },
]);
if (!textOk || !imageOk) process.exitCode = 1;
