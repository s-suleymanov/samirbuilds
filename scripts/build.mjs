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
  // Include the font bytes in the HTML so rendering needs no separate font request.
  let fontStyles = await readFile(path.join(root, 'fonts/fonts.css'), 'utf8');
  const fontFiles = [...new Set([...fontStyles.matchAll(/url\(([\w.-]+\.woff2)\)/g)].map(match => match[1]))];
  for (const file of fontFiles) {
    const bytes = await readFile(path.join(root, 'fonts', file));
    fontStyles = fontStyles.replaceAll(`url(${file})`, `url(data:font/woff2;base64,${bytes.toString('base64')})`);
  }
  const files = (await readdir(path.join(root, 'posts'))).filter(f => f.endsWith('.md')).sort();
  const posts = (await Promise.all(files.map(async file => parsePost(await readFile(path.join(root, 'posts', file), 'utf8'), file))))
    .filter(post => includeDrafts || !post.draft).sort((a, b) => b.date - a.date || a.slug.localeCompare(b.slug));
  const noteDirectory = path.join(root, 'content/notes');
  const noteFiles = (await readdir(noteDirectory)).filter(file => file.endsWith('.md'));
  const notes = (await Promise.all(noteFiles.map(async file => parsePost(await readFile(path.join(noteDirectory, file), 'utf8'), file))))
    .filter(note => includeDrafts || !note.draft).sort((a, b) => b.date - a.date || a.slug.localeCompare(b.slug));
  const projects = JSON.parse(await readFile(path.join(root, 'content/projects.json'), 'utf8'));
  const shell = (content, active, title = profile.name, description = profile.tagline) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="${esc(description)}"><title>${esc(title)}</title><meta name="theme-color" content="#fafaf8">
<style data-embedded-fonts>${fontStyles}</style>
${active === 'home' ? `<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="https://samirbuilds.com/">
<meta property="og:type" content="profile"><meta property="og:title" content="${esc(profile.name)}"><meta property="og:description" content="${esc(profile.tagline)}"><meta property="og:url" content="https://samirbuilds.com/">
<meta property="og:image" content="${esc(new URL(profile.photo, 'https://samirbuilds.com/').href)}"><meta property="og:image:alt" content="Portrait of ${esc(profile.name)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(new URL(profile.photo, 'https://samirbuilds.com/').href)}">
<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': [ { '@type': 'ProfilePage', '@id': 'https://samirbuilds.com/#profile', url: 'https://samirbuilds.com/', name: profile.name, primaryImageOfPage: { '@id': 'https://samirbuilds.com/#portrait' }, mainEntity: { '@id': 'https://samirbuilds.com/#person' } }, { '@type': 'Person', '@id': 'https://samirbuilds.com/#person', name: profile.name, url: 'https://samirbuilds.com/', image: { '@id': 'https://samirbuilds.com/#portrait' } }, { '@type': 'ImageObject', '@id': 'https://samirbuilds.com/#portrait', contentUrl: new URL(profile.photo, 'https://samirbuilds.com/').href, caption: 'Portrait of ' + profile.name } ] }).replaceAll('<', '\u003c')}</script>` : ''}
${active === 'notes' ? '<script src="/assets/notes.js" defer></script>' : ''}
<link rel="stylesheet" href="/assets/styles.css"><link rel="icon" href="/assets/favicon.svg?v=circle-5" type="image/svg+xml" sizes="any"></head>
<body><a class="skip" href="#main">Skip to content</a><div class="site${active === 'projects' ? ' site-projects' : ''}"><header>
<a class="wordmark" href="/" aria-label="${esc(profile.name)} — home">${esc(profile.initials)}<span>.</span></a>
<nav aria-label="Main navigation"><a href="/"${active === 'home' ? ' aria-current="page"' : ''}>Home</a><a href="/projects/"${active === 'projects' ? ' aria-current="page"' : ''}>Projects</a><a href="/writing/"${active === 'writing' ? ' aria-current="page"' : ''}>Writing</a><a href="/notes/"${active === 'notes' ? ' aria-current="page"' : ''}>Notes</a></nav>
</header><main id="main">${content}</main><footer><span>© ${new Date().getFullYear()} ${esc(profile.name)}</span><a href="/">samirbuilds.com</a></footer></div></body></html>`;
  const portrait = profile.photo ? `<span class="portrait-frame" data-profile-photo><img class="portrait" src="${esc(safeUrl(profile.photo))}" alt="Portrait of ${esc(profile.name)}" draggable="false"></span>` : `<div class="portrait monogram" role="img" aria-label="${esc(profile.initials)} initials; portrait placeholder">${esc(profile.initials)}</div>`;
  const sections = profile.sections.map(section => `<section class="profile-row"><h2>${esc(section.label)}</h2><div>${section.items.map(item => `<div class="entry${item.placeholder ? ' placeholder' : ''}"><div class="entry-title">${(() => { const label = safeUrl(item.logo) ? `<img class="entry-logo" src="${esc(safeUrl(item.logo))}" alt="${esc(item.title)}" loading="lazy">` : esc(item.title); return safeUrl(item.url) ? `<a href="${esc(safeUrl(item.url))}">${label}</a>` : label; })()}</div>${item.detail ? `<p>${esc(item.detail)}</p>` : ''}</div>`).join('')}</div></section>`).join('');
  const links = profile.links.map(link => safeUrl(link.url) ? `<a href="${esc(safeUrl(link.url))}">${esc(link.label)}</a>` : `<span class="unset-link">${esc(link.label)}</span>`).join('');
  const interests = profile.interests?.length ? `<section class="profile-row"><h2>Interests</h2><p class="interests">${profile.interests.map(interest => `<span class="interest">${esc(interest)}</span>`).join(' · ')}</p></section>` : '';
  const home = `<section class="identity">${portrait}<div><h1>${esc(profile.name)}</h1><p class="tagline">${esc(profile.tagline)}</p></div></section>
<div class="profile">${sections}<section class="profile-row"><h2>Links</h2><div class="socials">${links}</div></section>${interests}</div>`;
  const projectsPage = `<section class="page-intro"><h1>Projects</h1></section>
<section class="project-list" aria-label="Projects">${projects.map(project => `<article class="project-card"><div class="project-image">${safeUrl(project.video) ? `<video autoplay muted loop playsinline preload="metadata" poster="${esc(safeUrl(project.image))}" aria-label="${esc(project.name)} project video"><source src="${esc(safeUrl(project.video))}" type="video/mp4"></video>` : safeUrl(project.image) ? `<img src="${esc(safeUrl(project.image))}" alt="${esc(project.name)}" loading="lazy">` : `<span class="project-image-placeholder project-dots" role="img" aria-label="No image yet"><span></span><span></span><span></span></span>`}</div><div class="project-caption"><h2>${safeUrl(project.url) ? `<a href="${esc(safeUrl(project.url))}">${esc(project.name)} <span aria-hidden="true">↗</span></a>` : esc(project.name)}</h2>${project.status ? `<p class="project-description">${esc(project.status)}</p>` : ''}${project.description ? `<p class="project-description">${esc(project.description)}</p>` : ''}</div></article>`).join('')}</section>`;
  const writing = `<section class="page-intro"><h1>Writing</h1></section>
<section class="post-list" aria-label="Writing">${posts.length ? posts.map(post => `<a class="post-card" href="/writing/${post.slug}/"><h2>${esc(post.title)}</h2><p>${esc(post.description)}</p></a>`).join('') : '<p class="no-posts">No posts yet.</p>'}</section>`;
  const notesPage = `<section class="page-intro"><h1>Notes</h1></section>
<section class="notes-grid" aria-label="Notes">${notes.length ? notes.map(note => `<article class="note-card" id="${esc(note.slug)}" aria-label="${esc(note.title)}"><div class="note-body" id="body-${esc(note.slug)}">${note.html}</div><button class="note-toggle" type="button" aria-expanded="false" aria-controls="body-${esc(note.slug)}" hidden>See more</button><a class="note-date" href="#${esc(note.slug)}" aria-label="Link to ${esc(note.title)}"><time datetime="${esc(note.isoDate)}">${note.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}</time></a></article>`).join('') : '<p class="no-posts">No notes yet. Check back soon.</p>'}</section>`;
  // Clear only generated output, never the author's source files.
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(path.join(root, 'public'), output, { recursive: true });
  await writeFile(path.join(output, 'index.html'), shell(home, 'home'));
  await mkdir(path.join(output, 'projects'), { recursive: true });
  await writeFile(path.join(output, 'projects/index.html'), shell(projectsPage, 'projects', `Projects — ${profile.name}`, 'Projects by Samir Suleymanov.'));
  await mkdir(path.join(output, 'writing'), { recursive: true });
  await writeFile(path.join(output, 'writing/index.html'), shell(writing, 'writing', `Writing — ${profile.name}`));
  await mkdir(path.join(output, 'notes'), { recursive: true });
  await writeFile(path.join(output, 'notes/index.html'), shell(notesPage, 'notes', `Notes — ${profile.name}`, 'Quick thoughts, reminders, and things I’m learning.'));
  for (const post of posts) {
    const directory = path.join(output, 'writing', post.slug);
    await mkdir(directory, { recursive: true });
    const content = `<div class="article-head"><h1>${esc(post.title)}</h1>${post.description ? `<p class="article-subheading">${esc(post.description)}</p>` : ''}</div><article class="article">${post.html}</article>`;
    await writeFile(path.join(directory, 'index.html'), shell(content, 'writing', `${post.title} — ${profile.name}`, post.description));
  }
  return posts.length;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = await build();
  console.log(`Built dist/ with ${count} published post${count === 1 ? '' : 's'}. Drafts excluded.`);
}
