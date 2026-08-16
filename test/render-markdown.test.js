import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { renderMarkdown, renderMarkdownDocument } from '../lib/render-markdown.js';
import { xssPayloads } from './fixtures/xss-payloads.js';

test('sanitizes after Markdown conversion', () => {
  const rendered = renderMarkdown(`
# Safe heading

[safe](https://example.com) [mail](mailto:user@example.com)

<script>alert(1)</script>
<style>body { display: none }</style>
<iframe src="https://example.com"></iframe>
<form><input name="secret"></form>
`);

  assert.match(rendered, /<h1 id="safe-heading">Safe heading<\/h1>/);
  assert.match(rendered, /href="https:\/\/example\.com"/);
  assert.doesNotMatch(rendered, /onerror|script|style|iframe|form|input/);
});

test('rejects raw HTML media while preserving sanitized Markdown images', () => {
  assert.throws(
    () => renderMarkdown('<img src="media/photo.png" alt="Photo">'),
    /Raw HTML media is not allowed/
  );
  const rendered = renderMarkdown('![A & B](media/photo.png "Local")');
  assert.match(rendered, /<img src="media\/photo\.png" alt="A &amp; B" title="Local" \/>/);
  assert.doesNotMatch(rendered, /gala-image-placeholder/);
});

test('removes unsafe and protocol-relative URLs while retaining relative URLs', () => {
  const rendered = renderMarkdown(`
[javascript](javascript:alert(1))
[http](http://example.com)
[protocol-relative](//example.com)
[relative](../article/)
`);
  assert.doesNotMatch(rendered, /href="(?:javascript:|http:\/\/|\/\/)/);
  assert.match(rendered, /href="\.\.\/article\/"/);
});

test('renders footnotes and GitHub admonitions', () => {
  const rendered = renderMarkdown(`
> [!NOTE]
> Important context.

Claim.[^1]

[^1]: Supporting detail.
`);
  assert.match(rendered, /<aside class="admonition admonition-note" role="note">/);
  assert.match(rendered, /Important context/);
  assert.match(rendered, /class="footnote-ref"/);
  assert.match(rendered, /Supporting detail/);
});

test('rejects the maintained OWASP-derived XSS regression corpus', () => {
  for (const payload of xssPayloads) {
    let rendered;
    try {
      rendered = renderMarkdown(payload);
    } catch (error) {
      assert.match(error.message, /Raw HTML media is not allowed/);
      continue;
    }
    assert.doesNotMatch(rendered, /<(?:script|style|iframe|svg|object|form|input)\b/i, payload);
    assert.doesNotMatch(rendered, /\son[a-z]+\s*=/i, payload);
    assert.doesNotMatch(rendered, /\sstyle\s*=/i, payload);
    assert.doesNotMatch(rendered, /(?:href|src)="(?:javascript|data|vbscript):/i, payload);
  }
});

test('retains the documented safe HTML and URL boundary', () => {
  const rendered = renderMarkdown(`
<strong>strong</strong>
<a href="https://example.com">https</a>
<a href="mailto:person@example.com">mail</a>
<a href="../relative/">relative</a>
`);

  assert.match(rendered, /<strong>strong<\/strong>/);
  assert.match(rendered, /href="https:\/\/example\.com"/);
  assert.match(rendered, /href="mailto:person@example\.com"/);
  assert.match(rendered, /href="\.\.\/relative\/"/);
});

test('highlights known fenced languages at build time with exact light and dark themes', () => {
  const rendered = renderMarkdown('```javascript\nconst answer = 42;\n```');

  assert.match(rendered, /class="shiki shiki-themes github-light github-dark"/);
  assert.match(rendered, /--shiki-light:/);
  assert.match(rendered, /--shiki-dark:/);
  assert.match(rendered, />const</);
  assert.match(rendered, /> answer</);
  assert.doesNotMatch(rendered, /gala-highlight-placeholder/);
});

test('authored placeholder-shaped HTML cannot consume a highlighted fence', () => {
  const rendered = renderMarkdown(`
<div class="gala-highlight-placeholder" data-highlight-token="authored"></div>

\`\`\`javascript
const protectedLocation = true;
\`\`\`
`);

  assert.match(rendered, /data-highlight-token="authored"/);
  assert.match(rendered, /protectedLocation/);
  assert.doesNotMatch(rendered, /data-highlight-token="[a-f0-9]{36}"/);
});

test('unknown fenced languages remain escaped plain code', () => {
  const rendered = renderMarkdown('```not-a-real-language\n<script>alert(1)</script>\n```');

  assert.match(rendered, /class="language-not-a-real-language"/);
  assert.doesNotMatch(rendered, /<script>/);
});

test('uses GitHub-compatible duplicate heading anchors and shows a ToC from three headings', () => {
  const rendered = renderMarkdownDocument('## Café!\n\n### Café!\n\n## Third heading');

  assert.match(rendered.html, /<h2 id="café">/);
  assert.match(rendered.html, /<h3 id="café-1">/);
  assert.deepEqual(rendered.tableOfContents, [
    { id: 'café', text: 'Café!' },
    { id: 'café-1', text: 'Café!' },
    { id: 'third-heading', text: 'Third heading' }
  ]);
});

test('omits the ToC below the three-heading contract threshold', () => {
  assert.deepEqual(renderMarkdownDocument('## One\n\n### Two').tableOfContents, []);
});

test('renders fixture-matched embeds without build-time network access', () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('embed rendering must not fetch'); };
  try {
    const rendered = renderMarkdown(`
{% embed https://www.youtube.com/watch?v=M7lc1UVf-VE %}

{% embed https://codepen.io/chriscoyier/pen/gfdDu %}
`);
    assert.match(rendered, /class="gala-embed gala-embed--youtube"/);
    assert.match(rendered, /data-gala-embed-src="https:\/\/www\.youtube-nocookie\.com\/embed\/M7lc1UVf-VE"/);
    assert.match(rendered, /data-gala-embed-load="youtube"/);
    assert.match(rendered, />Watch on YouTube</);
    assert.match(rendered, /class="gala-embed gala-embed--codepen"/);
    assert.match(rendered, /data-gala-embed-src="https:\/\/codepen\.io\/chriscoyier\/embed\/gfdDu"/);
    assert.match(rendered, />Run on CodePen</);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('keeps script-only providers as provider-labelled outbound facades', () => {
  const rendered = renderMarkdown(`
{% embed https://gist.github.com/octocat/6cad326836d38bd3a7ae %}

{% embed https://x.com/jack/status/20 %}
`);
  assert.match(rendered, /class="gala-embed gala-embed--gist"/);
  assert.match(rendered, />View Gist by octocat</);
  assert.match(rendered, /class="gala-embed gala-embed--x"/);
  assert.match(rendered, />View post on X</);
  assert.doesNotMatch(rendered, /data-gala-embed-load="(?:gist|x)"/);
});

test('warns and renders an ordinary safe link for an unsupported embed URL', () => {
  const document = renderMarkdownDocument('{% embed https://example.com/media/1 %}');
  assert.deepEqual(document.warnings, [
    'Unsupported embed provider: https://example.com/media/1'
  ]);
  assert.match(document.html, /href="https:\/\/example\.com\/media\/1"/);
  assert.doesNotMatch(document.html, /data-gala-embed/);
});

test('never creates a fallback link for a credential-bearing embed URL', () => {
  const document = renderMarkdownDocument('{% embed https://user:secret@example.com/media %}');
  assert.equal(document.warnings.length, 1);
  assert.doesNotMatch(document.html, /href=/);
  assert.match(document.html, /<code>https:\/\/user:secret@example\.com\/media<\/code>/);
});

test('ships the exact canonical dated provider fixture', async () => {
  const runtime = JSON.parse(await readFile(
    new URL('../lib/provider-fixtures/embeds.v1.json', import.meta.url), 'utf8'
  ));
  const canonical = JSON.parse(await readFile(
    new URL('../v1/docs/embeds.v1.json', import.meta.url), 'utf8'
  ));
  assert.deepEqual(runtime, canonical);
  assert.deepEqual(runtime.providers.map(({ id, status }) => [id, status]), [
    ['youtube', 'verified-iframe'],
    ['codepen', 'verified-iframe'],
    ['gist', 'verified-script-only'],
    ['x', 'verified-script-only']
  ]);
  for (const provider of runtime.providers) {
    assert.match(provider.source, /^https:\/\//);
    assert.equal(provider.verifiedOn, '2026-08-14');
  }
});

test('authored placeholder-shaped HTML cannot forge an iframe activation source', () => {
  const rendered = renderMarkdown(`
<div class="gala-embed-placeholder" data-embed-token="authored"></div>
<button data-gala-embed-load="youtube" data-gala-embed-src="https://evil.example/embed">Load</button>
`);
  assert.match(rendered, /data-embed-token="authored"/);
  assert.doesNotMatch(rendered, /data-gala-embed-(?:load|src)/);
  assert.doesNotMatch(rendered, /evil\.example/);
});
