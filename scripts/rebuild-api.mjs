import fs from 'fs';
import { execSync } from 'child_process';

const newRetry = `async function withRetry<T>(fn: () => Promise<T>, retries = 4, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorMessage = (error?.message || String(error) || '').toLowerCase();
    const isQuotaError =
      errorMessage.includes('429') ||
      errorMessage.includes('resource_exhausted') ||
      errorMessage.includes('quota exceeded') ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('rate_limit') ||
      errorMessage.includes('too many requests');

    const isRetryable =
      isQuotaError ||
      errorMessage.includes('503') ||
      errorMessage.includes('unavailable') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('econnreset') ||
      errorMessage.includes('fetch failed') ||
      errorMessage.includes('internal error');

    if (retries > 0 && isRetryable) {
      console.warn('Gemini retry (' + retries + ' left):', error?.message || error);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }

    console.error('Gemini final error:', error?.message || error);
    if (isQuotaError) {
      throw new Error("Muitas solicitações ao mesmo tempo. Aguarde alguns segundos e tente novamente.");
    }
    if (errorMessage.includes('api_key') || errorMessage.includes('api key') || errorMessage.includes('chave_api')) {
      throw new Error("CHAVE_API_AUSENTE: Configure GEMINI_API_KEY no servidor.");
    }
    const original = (error?.message || '').toString();
    if (original && original.length < 240 && !original.includes('\\n')) {
      throw new Error(original);
    }
    throw new Error("Instabilidade momentânea no servidor de IA. Tente novamente em alguns segundos.");
  }
}`;

let lib = fs.readFileSync('lib/geminiServer.ts', 'utf8');
lib = lib.replace(/async function withRetry[\s\S]*?\n}\n\nconst QUESTION_SCHEMA/, newRetry + '\n\nconst QUESTION_SCHEMA');

const modelHelper = `const getGeminiModel = () =>
  (process.env.GEMINI_MODEL || 'gemini-3.5-flash').trim() || 'gemini-3.5-flash';

`;
if (!lib.includes('getGeminiModel')) {
  lib = lib.replace('let aiInstance: any = null;', modelHelper + 'let aiInstance: any = null;');
}
lib = lib.replace(/model:\\s*['"]gemini-3-flash-preview['"]/g, 'model: getGeminiModel()');
lib = lib.replace(/model: 'gemini-3-flash-preview'/g, 'model: getGeminiModel()');
lib = lib.replace(/model: "gemini-3-flash-preview"/g, 'model: getGeminiModel()');

fs.writeFileSync('lib/geminiServer.ts', lib, 'utf8');

const base = execSync('git show 845d14f:api/index.ts', { encoding: 'utf8' });

let gemini = fs.readFileSync('lib/geminiServer.ts', 'utf8');
gemini = gemini.replace(/^export const /gm, 'const ');
gemini = gemini.replace(/^export function /gm, 'function ');

let out = base.replace(
  /import \{\s*fetchFilteredQuestions[\s\S]*?\} from '\.\/geminiServer\.js';\s*/,
  ''
);

out = out.replace(
  /type AuthedRequest = express\.Request & \{[\s\S]*?\};/,
  (m) =>
    m +
    '\n\n/* ==== Gemini (inlined para bundle Vercel) ==== */\n' +
    gemini +
    '\n/* ==== fim Gemini ==== */\n'
);

// Ensure handler export from current working version
if (!out.includes('export default function handler')) {
  out = out.replace(
    /export default app;?\s*$/,
    `export { app };

export default function handler(req: IncomingMessage, res: ServerResponse) {
  return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
}
`
  );
}

fs.writeFileSync('api/index.ts', out, 'utf8');
console.log('ok', {
  len: out.length,
  solicitacoes: out.includes('solicitações'),
  modelHelper: out.includes('getGeminiModel'),
  previewLeft: out.includes('gemini-3-flash-preview'),
  handler: out.includes('export default function handler'),
});
