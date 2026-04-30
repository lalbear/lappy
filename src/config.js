/**
 * Lappy AI — Config
 *
 * API keys are loaded from .env (never committed).
 * Copy .env.example → .env and fill in your keys.
 *
 * Primary model:  Gemma 4 26B A4B  (google/gemma-4-26b-a4b-it:free)
 * Fallback model: Nemotron Nano 12B 2 VL (nvidia/nemotron-nano-12b-v2-vl:free)
 */

// Read from Vite env — set in .env as VITE_OPENROUTER_API_KEY
export const HARDCODED_OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';
export const FREE_MODE_ENABLED        = import.meta.env.VITE_FREE_MODE_ENABLED === 'true';

export const APP_SITE_URL  = 'http://localhost:5174';
export const APP_SITE_NAME = 'Lappy AI';

// ── Model IDs (verified from OpenRouter API) ───────────────────────────────
export const PRIMARY_MODEL  = 'google/gemma-4-26b-a4b-it:free';
export const FALLBACK_MODEL = 'nvidia/nemotron-nano-12b-v2-vl:free';

// ── OpenRouter Model Catalogue ─────────────────────────────────────────────
export const OPENROUTER_MODELS = [

  // ── ⭐ RECOMMENDED (your picks) ─────────────────────────────────────────
  {
    id:      'google/gemma-4-26b-a4b-it:free',
    label:   'Gemma 4 26B',
    desc:    'Google · Primary model · Fast MoE architecture',
    isFree:  true,
    context: '128K',
    tag:     '⭐ Primary',
  },
  {
    id:      'nvidia/nemotron-nano-12b-v2-vl:free',
    label:   'Nemotron Nano 12B VL',
    desc:    'NVIDIA · Fallback · Vision-language capable',
    isFree:  true,
    context: '128K',
    tag:     '🔄 Fallback',
  },

  // ── 🆓 FREE TIER ────────────────────────────────────────────────────────
  {
    id:      'meta-llama/llama-3.1-8b-instruct:free',
    label:   'Llama 3.1 8B',
    desc:    'Meta · Great for chat & summarization',
    isFree:  true,
    context: '131K',
    tag:     '🆓 Free',
  },
  {
    id:      'google/gemma-4-31b-it:free',
    label:   'Gemma 4 31B',
    desc:    'Google · Larger Gemma 4 variant',
    isFree:  true,
    context: '128K',
    tag:     '🆓 Free',
  },
  {
    id:      'deepseek/deepseek-r1-0528:free',
    label:   'DeepSeek R1',
    desc:    'DeepSeek · Strong reasoning & analysis',
    isFree:  true,
    context: '64K',
    tag:     '🆓 Free',
  },
  {
    id:      'mistralai/mistral-7b-instruct:free',
    label:   'Mistral 7B',
    desc:    'Mistral AI · Sharp instruction following',
    isFree:  true,
    context: '32K',
    tag:     '🆓 Free',
  },
  {
    id:      'nvidia/nemotron-3-super-120b-a12b:free',
    label:   'Nemotron 3 Super 120B',
    desc:    'NVIDIA · Large MoE, high quality',
    isFree:  true,
    context: '128K',
    tag:     '🆓 Free',
  },
  {
    id:      'google/gemma-3-27b-it:free',
    label:   'Gemma 3 27B',
    desc:    'Google · Previous gen, well-tested',
    isFree:  true,
    context: '131K',
    tag:     '🆓 Free',
  },

  // ── 💰 PAID ─────────────────────────────────────────────────────────────
  {
    id:      'anthropic/claude-3.5-haiku',
    label:   'Claude 3.5 Haiku',
    desc:    'Anthropic · Fast & affordable',
    isFree:  false,
    context: '200K',
    tag:     '💎 Best Value',
  },
  {
    id:      'openai/gpt-4.1-mini',
    label:   'GPT-4.1 Mini',
    desc:    'OpenAI · Reliable & well-rounded',
    isFree:  false,
    context: '1M',
    tag:     '💰 Paid',
  },
  {
    id:      'google/gemini-2.5-flash-preview',
    label:   'Gemini 2.5 Flash',
    desc:    'Google · Multimodal & very fast',
    isFree:  false,
    context: '1M',
    tag:     '💰 Paid',
  },
  {
    id:      'anthropic/claude-sonnet-4-5',
    label:   'Claude Sonnet 4.5',
    desc:    'Anthropic · Top performance',
    isFree:  false,
    context: '200K',
    tag:     '🚀 Premium',
  },
  {
    id:      'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    label:   'Nemotron Super 49B',
    desc:    'NVIDIA · Flagship Nemotron',
    isFree:  false,
    context: '131K',
    tag:     '💰 Paid',
  },
];

// ── Grok model catalogue ─────────────────────────────────────────────────
export const GROK_MODELS = [
  {
    id:      'x-ai/grok-3-mini-beta',
    label:   'Grok 3 Mini',
    desc:    'xAI · Fast, efficient & capable',
    isFree:  false,
    context: '131K',
    tag:     '⚡ Recommended',
  },
  {
    id:      'x-ai/grok-3',
    label:   'Grok 3',
    desc:    'xAI · Flagship model, top quality',
    isFree:  false,
    context: '131K',
    tag:     '🚀 Flagship',
  },
];

// ── Defaults ──────────────────────────────────────────────────────────────
export const DEFAULT_OPENROUTER_MODEL = PRIMARY_MODEL;
export const DEFAULT_GROK_MODEL       = 'x-ai/grok-3-mini-beta';
