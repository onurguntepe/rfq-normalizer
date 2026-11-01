/*
 * RFQ Normalizer - mode 1, direct AI reading with the user's own key.
 * The browser talks to the provider directly; there is no server of ours in between.
 * The AI only turns text into the quote schema. It never computes a total.
 */
(function (root) {
  'use strict';

  const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
  const ANTHROPIC_VERSION = '2026-10-21';
  const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/';

  const PROVIDERS = {
    anthropic: { label: 'Claude (Anthropic)', defaultModel: 'claude-opus-5-5', models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'], needsUrl: false, needsKey: true },
    openai: { label: 'OpenAI uyumlu uç nokta / kendi proxy', defaultModel: 'gpt-4o-mini', models: [], needsUrl: true, needsKey: false, defaultUrl: 'https://api.openai.com/v1/chat/completions' },
    gemini: { label: 'Google Gemini', defaultModel: 'gemini-2.5-flash', models: [], needsUrl: false, needsKey: true }
  };

  class AiError extends Error {
    constructor(code, detail) { super(code); this.code = code; this.detail = detail || ''; }
  }

  async function post(url, headers, body, signal) {
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal });
    } catch (e) {
      if (e && e.name === 'AbortError') throw new AiError('ABORTED');
      throw new AiError('NETWORK', e && e.message);
    }
    let data = null;
    const text = await res.text();
    try { data = JSON.parse(text); } catch (_) { data = null; }
    if (!res.ok) {
      const msg = (data && (data.error && (data.error.message || data.error.type) || data.message)) || text.slice(0, 200);
      if (res.status === 401 || res.status === 403) throw new AiError('AUTH', msg);
      if (res.status === 429) throw new AiError('RATE', msg);
      if (res.status === 404) throw new AiError('MODEL', msg);
      throw new AiError('HTTP_' + res.status, msg);
    }
    return data;
  }

  /* ---------- content parts ---------- */
  // attachment: { kind: 'pdf' | 'image', base64, mime }

  function anthropicContent(text, att) {
    const parts = [];
    if (att && att.kind === 'pdf') parts.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: att.base64 } });
    if (att && att.kind === 'image') parts.push({ type: 'image', source: { type: 'base64', media_type: att.mime, data: att.base64 } });
    parts.push({ type: 'text', text });
    return parts;
  }

  function supportsEffort(model) { return /^claude-(opus|sonnet|haiku|fable)-5/.test(model); }
  function supportsFallback(model) { return /^claude-(opus-5|fable-5|sonnet-5-5)/.test(model); }

  async function anthropic(cfg, system, user, schema, att, signal) {
    const model = cfg.model || PROVIDERS.anthropic.defaultModel;
    const headers = {
      'content-type': 'application/json',
      'x-api-key': cfg.key,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true'
    };
    const body = {
      model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: anthropicContent(user, att) }]
    };
    const outputConfig = {};
    if (supportsEffort(model)) outputConfig.effort = 'low';
    if (schema) outputConfig.format = { type: 'json_schema', schema };
    if (Object.keys(outputConfig).length) body.output_config = outputConfig;
    if (supportsFallback(model)) {
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
      body.fallbacks = 'default';
    }
    const data = await post(ANTHROPIC_URL, headers, body, signal);
    if (data.stop_reason === 'refusal') throw new AiError('REFUSAL', data.stop_details && data.stop_details.explanation);
    if (data.stop_reason === 'max_tokens') throw new AiError('TRUNCATED');
    const block = (data.content || []).find(b => b.type === 'text');
    if (!block) throw new AiError('EMPTY');
    return block.text;
  }

  async function openai(cfg, system, user, schema, att, signal) {
    const url = cfg.url || PROVIDERS.openai.defaultUrl;
    const headers = { 'content-type': 'application/json' };
    if (cfg.key) headers.authorization = 'Bearer ' + cfg.key;
    const content = [{ type: 'text', text: user }];
    if (att && att.kind === 'image') content.unshift({ type: 'image_url', image_url: { url: 'data:' + att.mime + ';base64,' + att.base64 } });
    const body = {
      model: cfg.model || PROVIDERS.openai.defaultModel,
      messages: [{ role: 'system', content: system }, { role: 'user', content }]
    };
    if (schema) body.response_format = { type: 'json_object' };
    const data = await post(url, headers, body, signal);
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new AiError('EMPTY');
    return text;
  }

  async function gemini(cfg, system, user, schema, att, signal) {
    const model = cfg.model || PROVIDERS.gemini.defaultModel;
    const parts = [];
    if (att && (att.kind === 'image' || att.kind === 'pdf')) parts.push({ inline_data: { mime_type: att.kind === 'pdf' ? 'application/pdf' : att.mime, data: att.base64 } });
    parts.push({ text: user });
    const body = {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }]
    };
    if (schema) body.generationConfig = { responseMimeType: 'application/json' };
    // Key travels in a header, never in the URL.
    const data = await post(GEMINI_URL + encodeURIComponent(model) + ':generateContent', { 'content-type': 'application/json', 'x-goog-api-key': cfg.key }, body, signal);
    const cand = data && data.candidates && data.candidates[0];
    const text = cand && cand.content && cand.content.parts && cand.content.parts.map(p => p.text || '').join('');
    if (!text) throw new AiError(cand && cand.finishReason === 'SAFETY' ? 'REFUSAL' : 'EMPTY');
    return text;
  }

  const CALLERS = { anthropic, openai, gemini };

  function configured(cfg) {
    if (!cfg || !PROVIDERS[cfg.provider]) return false;
    const p = PROVIDERS[cfg.provider];
    if (p.needsKey && !cfg.key) return false;
    if (p.needsUrl && !cfg.url) return false;
    return true;
  }

  /** Quote text (and optional PDF/image) to a raw quote object for RFQParser.normalizeQuote. */
  async function readQuote(cfg, items, rawText, attachment, signal) {
    if (!configured(cfg)) throw new AiError('NOT_CONFIGURED');
    const P = root.RFQParser;
    const text = await CALLERS[cfg.provider](cfg, P.systemPrompt(), P.userPrompt(items, rawText || '(see attachment)'), P.jsonSchema(items.length), attachment, signal);
    try { return P.extractJson(text); } catch (e) { throw new AiError('BAD_JSON', text.slice(0, 160)); }
  }

  /** Free-text writing from facts the engine already computed. */
  async function writeLetter(cfg, system, facts, signal) {
    if (!configured(cfg)) throw new AiError('NOT_CONFIGURED');
    return CALLERS[cfg.provider](cfg, system, facts, null, null, signal);
  }

  root.RFQAi = { PROVIDERS, AiError, configured, readQuote, writeLetter };
})(typeof self !== 'undefined' ? self : this);
