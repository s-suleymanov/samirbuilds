import { readFile, readdir, mkdir, rm, cp, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { marked } from 'marked';

export const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
export const output = path.join(root, 'dist');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = value => {
  const url = String(value || '').trim();
  if (/^(https?:\/\/|mailto:)/i.test(url) || (/^(\/|#|\.\/|\.\.\/)/.test(url) && !url.startsWith('//'))) return url;
  return '';
};
const markdownUrl = value => safeUrl(value) || (!/^[a-z][a-z\d+.-]*:/i.test(value) && !value.startsWith('//') ? value : '');
marked.use({ renderer: {
  html({ text }) { return esc(text); },
  link({ href, title, tokens }) { const url = markdownUrl(href); const label = this.parser.parseInline(tokens); return url ? `<a href="${esc(url)}"${title ? ` title="${esc(title)}"` : ''}>${label}</a>` : label; },
  image({ href, text }) { const url = markdownUrl(href); return url ? `<img src="${esc(url)}" alt="${esc(text)}" loading="lazy">` : esc(text); }
}});

function parsePost(text, file) {
  const match = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`${file}: start with the title/date/description/draft block from the example.`);
  const meta = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const pair = line.match(/^([a-z]+):\s*(.*)$/);
    if (!pair) throw new Error(`${file}: invalid metadata line: ${line}`);
    let value = pair[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = JSON.parse(value);
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    meta[pair[1]] = value;
  }
  const date = new Date(`${meta.date}T12:00:00Z`);
  if (!meta.title || !/^\d{4}-\d{2}-\d{2}$/.test(meta.date || '') || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== meta.date) throw new Error(`${file}: a title and valid YYYY-MM-DD date are required.`);
  if (meta.draft !== undefined && !['true', 'false'].includes(meta.draft)) throw new Error(`${file}: draft must be true or false.`);
  const slug = file.slice(0, -3);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) throw new Error(`${file}: use a lowercase filename with letters, numbers, and hyphens.`);
  return { ...meta, date, isoDate: meta.date, draft: meta.draft !== 'false', slug, html: marked.parse(match[2]) };
}

export async function build({ includeDrafts = false, outputDir = path.join(root, 'dist') } = {}) {
  const output = outputDir;
  const profile = JSON.parse(await readFile(path.join(root, 'content/profile.json'), 'utf8'));
  const files = (await readdir(path.join(root, 'posts'))).filter(f => f.endsWith('.md')).sort();
  const posts = (await Promise.all(files.map(async file => parsePost(await readFile(path.join(root, 'posts', file), 'utf8'), file))))
    .filter(post => includeDrafts || !post.draft).sort((a, b) => b.date - a.date || a.slug.localeCompare(b.slug));
  const shell = (content, active, title = profile.name, description = profile.tagline) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(description)}"><title>${esc(title)}</title><meta name="theme-color" content="#fafaf8">
${active === 'home' ? '<meta name="robots" content="noimageindex, max-image-preview:none"><script src="/assets/profile-controls.js" defer></script>' : ''}
<link rel="stylesheet" href="/assets/styles.css"><link rel="icon" href="/assets/favicon.svg?v=s-4" type="image/svg+xml" sizes="any"></head>
<body><a class="skip" href="#main">Skip to content</a><div class="site"><header>
<a class="wordmark" href="/" aria-label="${esc(profile.name)} — home">${esc(profile.initials)}<span>.</span></a>
<nav aria-label="Main navigation"><a href="/"${active === 'home' ? ' aria-current="page"' : ''}>Home</a><a href="/writing/"${active === 'writing' ? ' aria-current="page"' : ''}>Writing</a></nav>
</header><main id="main">${content}</main><footer><span>© ${new Date().getFullYear()} ${esc(profile.name)}</span><a href="/">samirbuilds.com</a></footer></div></body></html>`;
  const portrait = profile.photo ? `<span class="portrait-frame" data-profile-photo><img class="portrait" src="${esc(safeUrl(profile.photo))}" alt="Portrait of ${esc(profile.name)}" draggable="false"></span>` : `<div class="portrait monogram" role="img" aria-label="${esc(profile.initials)} initials; portrait placeholder">${esc(profile.initials)}</div>`;
  const sections = profile.sections.map(section => `<section class="profile-row"><h2>${esc(section.label)}</h2><div>${section.items.map(item => `<div class="entry${item.placeholder ? ' placeholder' : ''}"><div class="entry-title">${safeUrl(item.url) ? `<a href="${esc(safeUrl(item.url))}">${esc(item.title)}</a>` : esc(item.title)}</div>${item.detail ? `<p>${esc(item.detail)}</p>` : ''}</div>`).join('')}</div></section>`).join('');
  const links = profile.links.map(link => safeUrl(link.url) ? `<a href="${esc(safeUrl(link.url))}">${esc(link.label)}</a>` : `<span class="unset-link">${esc(link.label)}</span>`).join('');
  const home = `<section class="identity">${portrait}<div><h1>${esc(profile.name)}</h1><p class="tagline">${esc(profile.tagline)}</p></div></section>
<div class="profile">${sections}<section class="profile-row"><h2>Links</h2><div class="socials">${links}</div></section></div>`;
  const writing = `<section class="post-list" aria-label="Writing">${posts.length ? posts.map(post => `<a class="post-card" href="/writing/${post.slug}/"><h2>${esc(post.title)}</h2><p>${esc(post.description)}</p></a>`).join('') : '<p class="no-posts">No posts yet.</p>'}</section>`;
  // Clear only generated output, never the author's source files.
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(path.join(root, 'public'), output, { recursive: true });
  await writeFile(path.join(output, 'index.html'), shell(home, 'home'));
  await mkdir(path.join(output, 'writing'), { recursive: true });
  await writeFile(path.join(output, 'writing/index.html'), shell(writing, 'writing', `Writing — ${profile.name}`));
  for (const post of posts) {
    const directory = path.join(output, 'writing', post.slug);
    await mkdir(directory, { recursive: true });
    const content = `<div class="article-head"><a class="text-link" href="/writing/">← All writing</a><h1>${esc(post.title)}</h1></div><article class="article">${post.html}</article>`;
    await writeFile(path.join(directory, 'index.html'), shell(content, 'writing', `${post.title} — ${profile.name}`, post.description));
  }
  return posts.length;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await build();
  console.log(`Built dist/ with ${count} published post${count === 1 ? '' : 's'}. Drafts excluded.`);
}
