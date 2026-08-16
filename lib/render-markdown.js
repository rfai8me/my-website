import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';
import sanitizeHtml from 'sanitize-html';
import { createHighlighter } from 'shiki';
import GithubSlugger from 'github-slugger';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const embedFixture = JSON.parse(readFileSync(
  new URL('./provider-fixtures/embeds.v1.json', import.meta.url),
  'utf8'
));

const SHIKI_THEMES = Object.freeze({ light: 'github-light', dark: 'github-dark' });
const SHIKI_LANGUAGES = Object.freeze([
  'bash', 'css', 'html', 'java', 'javascript', 'json', 'jsx', 'markdown',
  'shellscript', 'sql', 'typescript', 'tsx', 'yaml'
]);
const highlighter = await createHighlighter({
  themes: Object.values(SHIKI_THEMES),
  langs: SHIKI_LANGUAGES
});

const ADMONITION_TYPES = new Set(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION']);

function admonitions(markdown) {
  markdown.core.ruler.after('block', 'gala_admonitions', (state) => {
    for (let index = 0; index < state.tokens.length - 2; index += 1) {
      const open = state.tokens[index];
      const inline = state.tokens[index + 2];
      if (open.type !== 'blockquote_open' || inline?.type !== 'inline') continue;

      const match = inline.content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)](?:\n|$)/);
      if (!match || !ADMONITION_TYPES.has(match[1])) continue;

      open.tag = 'aside';
      open.attrSet('class', `admonition admonition-${match[1].toLowerCase()}`);
      open.attrSet('role', 'note');
      inline.content = inline.content.slice(match[0].length);
      if (inline.children?.[0]?.type === 'text') {
        inline.children[0].content = inline.children[0].content.replace(
          /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)](?:\n|$)/,
          ''
        );
      }

      let depth = 1;
      for (let cursor = index + 1; cursor < state.tokens.length; cursor += 1) {
        if (state.tokens[cursor].type === 'blockquote_open') depth += 1;
        if (state.tokens[cursor].type === 'blockquote_close') depth -= 1;
        if (depth === 0) {
          state.tokens[cursor].tag = 'aside';
          break;
        }
      }
    }
  });
}

function headingAnchors(markdown) {
  markdown.core.ruler.push('gala_heading_anchors', (state) => {
    const slugger = new GithubSlugger();
    const toc = [];
    for (let index = 0; index < state.tokens.length - 1; index += 1) {
      const open = state.tokens[index];
      if (open.type !== 'heading_open') continue;
      const inline = state.tokens[index + 1];
      const id = slugger.slug(inline.content);
      open.attrSet('id', id);
      if (open.tag === 'h2' || open.tag === 'h3') toc.push({ id, text: inline.content });
    }
    state.env.galaToc = toc.length >= 3 ? toc : [];
  });
}

function fixtureEmbed(url, environment) {
  for (const provider of embedFixture.providers) {
    for (const pattern of provider.patterns) {
      const match = new RegExp(pattern).exec(url);
      if (!match) continue;
      const replaceCaptures = (template) => template.replace(/\{([1-9])}/g,
        (_placeholder, index) => match[Number(index)] ?? '');
      return {
        provider: provider.id,
        source: url,
        label: provider.label ?? replaceCaptures(provider.labelTemplate),
        activation: provider.status === 'verified-iframe'
          ? replaceCaptures(provider.activationTemplate)
          : null
      };
    }
  }
  environment.galaWarnings ??= [];
  environment.galaWarnings.push(`Unsupported embed provider: ${url}`);
  return null;
}

function safeEmbedLink(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.username === '' && parsed.password === '';
  } catch {
    return false;
  }
}

function embedFacade(embed) {
  const provider = markdown.utils.escapeHtml(embed.provider);
  const source = markdown.utils.escapeHtml(embed.source);
  const label = markdown.utils.escapeHtml(embed.label);
  if (embed.activation == null) {
    return `<figure class="gala-embed gala-embed--${provider}"><span class="gala-embed__icon" aria-hidden="true"></span><a href="${source}" rel="noopener noreferrer">${label}</a></figure>`;
  }
  const activation = markdown.utils.escapeHtml(embed.activation);
  return `<figure class="gala-embed gala-embed--${provider}" data-gala-embed="${provider}"><span class="gala-embed__icon" aria-hidden="true"></span><button type="button" data-gala-embed-load="${provider}" data-gala-embed-src="${activation}">${label}</button><figcaption><a href="${source}" rel="noopener noreferrer">Open directly on ${provider === 'youtube' ? 'YouTube' : 'CodePen'}</a></figcaption></figure>`;
}

function embeds(markdown) {
  markdown.block.ruler.before('paragraph', 'gala_embed', (state, startLine, _endLine, silent) => {
    const start = state.bMarks[startLine] + state.tShift[startLine];
    const end = state.eMarks[startLine];
    const match = state.src.slice(start, end).match(/^\{%\s+embed\s+(https:\/\/\S+)\s+%}$/);
    if (!match) return false;
    if (silent) return true;
    const resolved = fixtureEmbed(match[1], state.env);
    if (resolved == null) {
      const token = state.push('paragraph_open', 'p', 1);
      token.map = [startLine, startLine + 1];
      const inline = state.push('inline', '', 0);
      inline.content = safeEmbedLink(match[1])
        ? `[${match[1]}](${match[1]})`
        : `\`${match[1].replaceAll('`', '\\`')}\``;
      inline.children = [];
      state.push('paragraph_close', 'p', -1);
    } else {
      const placeholder = randomBytes(18).toString('hex');
      state.env.galaEmbeds ??= new Map();
      state.env.galaEmbeds.set(placeholder, embedFacade(resolved));
      const token = state.push('html_block', '', 0);
      token.content = `<div class="gala-embed-placeholder" data-embed-token="${placeholder}"></div>`;
      token.map = [startLine, startLine + 1];
    }
    state.line = startLine + 1;
    return true;
  });
}

function rejectRawHtmlMedia(markdown) {
  markdown.core.ruler.after('inline', 'gala_reject_raw_html_media', (state) => {
    const media = /<(?:img|audio|video|source|picture)\b/i;
    for (const token of state.tokens) {
      if ((token.type === 'html_block' || token.type === 'html_inline') && media.test(token.content)) {
        throw new TypeError('Raw HTML media is not allowed; use Markdown image syntax');
      }
      for (const child of token.children ?? []) {
        if (child.type === 'html_inline' && media.test(child.content)) {
          throw new TypeError('Raw HTML media is not allowed; use Markdown image syntax');
        }
      }
    }
  });
}

const markdown = new MarkdownIt({ html: true, linkify: true, typographer: false })
  .use(footnote)
  .use(admonitions)
  .use(headingAnchors)
  .use(embeds)
  .use(rejectRawHtmlMedia);

const defaultImage = markdown.renderer.rules.image
  ?? ((tokens, index, options, _environment, self) => self.renderToken(tokens, index, options));
markdown.renderer.rules.image = (tokens, index, options, environment, self) => {
  const token = randomBytes(18).toString('hex');
  const image = defaultImage(tokens, index, options, environment, self);
  environment.galaImages ??= new Map();
  environment.galaImages.set(token, sanitizeHtml(image, {
    allowedTags: ['img'],
    allowedAttributes: { img: ['src', 'alt', 'title'] },
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false
  }));
  return `<span class="gala-image-placeholder" data-image-token="${token}"></span>`;
};

const defaultFence = markdown.renderer.rules.fence.bind(markdown.renderer.rules);
markdown.renderer.rules.fence = (tokens, index, options, environment, self) => {
  const language = tokens[index].info.trim().split(/\s+/, 1)[0].toLowerCase();
  if (!SHIKI_LANGUAGES.includes(language)) {
    return defaultFence(tokens, index, options, environment, self);
  }
  const highlights = environment.galaHighlights ??= [];
  const token = randomBytes(18).toString('hex');
  highlights.push(highlighter.codeToHtml(tokens[index].content, {
    lang: language,
    themes: SHIKI_THEMES,
    defaultColor: false
  }));
  const tokensByIndex = environment.galaHighlightTokens ??= [];
  tokensByIndex.push(token);
  return `<div class="gala-highlight-placeholder" data-highlight-token="${token}"></div>`;
};

const sanitizeOptions = {
  allowedTags: [
    'a', 'abbr', 'aside', 'blockquote', 'br', 'code', 'del', 'div', 'em',
    'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr',
    'li', 'mark', 'ol', 'p', 'pre', 'span', 'strong', 'sub', 'sup', 'table',
    'tbody', 'td', 'th', 'thead', 'tr', 'ul'
  ],
  allowedAttributes: {
    a: ['href', 'title', 'rel'],
    aside: ['class', 'role'],
    code: ['class'],
    div: ['class', 'id', 'data-highlight-token', 'data-embed-token'],
    h1: ['id'],
    h2: ['id'],
    h3: ['id'],
    h4: ['id'],
    h5: ['id'],
    h6: ['id'],
    li: ['id'],
    ol: ['class'],
    span: ['class', 'data-image-token'],
    sup: ['class'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan', 'scope']
  },
  allowedClasses: {
    aside: [
      'admonition', 'admonition-note', 'admonition-tip', 'admonition-important',
      'admonition-warning', 'admonition-caution'
    ],
    div: ['gala-highlight-placeholder', 'gala-embed-placeholder'],
    code: [/^language-[a-z0-9_-]+$/],
    ol: ['footnotes-list'],
    span: ['footnote-backref', 'gala-image-placeholder'],
    sup: ['footnote-ref']
  },
  allowedSchemes: ['https', 'mailto'],
  allowedSchemesByTag: { a: ['https', 'mailto'] },
  allowProtocolRelative: false,
  enforceHtmlBoundary: true
};

function render(source, inline, suppliedEnvironment) {
  const environment = suppliedEnvironment ?? {};
  environment.galaHighlights = [];
  environment.galaHighlightTokens = [];
  environment.galaEmbeds = new Map();
  environment.galaImages = new Map();
  environment.galaWarnings = [];
  const unsafe = inline
    ? markdown.renderInline(source, environment)
    : markdown.render(source, environment);
  let safe = sanitizeHtml(unsafe, sanitizeOptions);
  for (let index = 0; index < environment.galaHighlights.length; index += 1) {
    safe = safe.replace(
      `<div class="gala-highlight-placeholder" data-highlight-token="${environment.galaHighlightTokens[index]}"></div>`,
      environment.galaHighlights[index]
    );
  }
  for (const [token, facade] of environment.galaEmbeds) {
    safe = safe.replace(
      `<div class="gala-embed-placeholder" data-embed-token="${token}"></div>`,
      facade
    );
  }
  for (const [token, image] of environment.galaImages) {
    safe = safe.replace(
      `<span class="gala-image-placeholder" data-image-token="${token}"></span>`,
      image
    );
  }
  return safe;
}

export function renderMarkdown(source) {
  if (typeof source !== 'string') throw new TypeError('Markdown source must be a string');
  return render(source, false);
}

export function renderMarkdownDocument(source) {
  if (typeof source !== 'string') throw new TypeError('Markdown source must be a string');
  const environment = {};
  const html = render(source, false, environment);
  return Object.freeze({
    html,
    tableOfContents: Object.freeze(environment.galaToc ?? []),
    warnings: Object.freeze(environment.galaWarnings ?? [])
  });
}

export const markdownLibrary = Object.assign(Object.create(markdown), {
  render(source, environment) {
    return render(source, false, environment);
  },
  renderInline(source, environment) {
    return render(source, true, environment);
  }
});
