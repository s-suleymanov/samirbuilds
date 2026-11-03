# Samir Suleymanov — personal website

A formal profile and a Markdown blog for samirbuilds.com.

## Start the local Node server

Use Node.js 22 or later. In this folder's VS Code terminal:

```sh
npm ci
node server.js
```

Open **http://localhost:3005**. Edit your profile or posts and press **Command-S** to save. The browser updates automatically after saved changes. A white dot beside a VS Code tab means changes are unsaved; the server cannot read those until you save.

`npm start` also starts the server. `npm run dev` runs it with automatic restart for changes to the server code itself. If your website is already running, the command prints its URL instead of launching a duplicate server.

If 3005 is busy with another application, run `PORT=3006 node server.js`. Stop the server with Control-C.

## Edit your profile

Edit `content/profile.json` to replace the placeholders. Add or remove entries and sections as needed. Set an entry's `placeholder` to `false` when you add your own information.

To replace your portrait, replace `public/assets/profile.png`, or place another image in `public/assets/` and update the `photo` path. Fill in the `url` fields for your social links; use `mailto:you@example.com` for email. Empty links appear as text without opening a fake destination.

Edit `content/profile.json`, files in `posts/`, and assets in `public/`. The `.preview/` and `dist/` folders are generated output and should not be edited.

## Profile photo indexing and copying

`public/robots.txt` asks crawlers not to crawl the profile photo, and the homepage uses Google's `noimageindex` and `max-image-preview:none` directives. The photo cannot be dragged normally; its image context menu and iOS touch callout are disabled. The image keeps accessible alt text.

These measures are not access control. Any photo shown on a public page can still be downloaded through developer tools or captured in a screenshot. A private image requires restricting access or removing it from the public page. The site is currently localhost-only. When deployed, `robots.txt` and the homepage directives will be published with it. If you change the photo URL, update its matching rule in `public/robots.txt`.

## Embedded fonts

DM Sans and Libre Caslon Display are bundled in `fonts/` with their licenses. The build embeds the compressed font bytes directly in each page; visitors do not contact Google Fonts or download a separate font file. Font rendering briefly waits for these embedded fonts instead of first showing a fallback typeface.

## Write a blog post without touching HTML

In VS Code, choose **Terminal → Run Task → New blog post** and enter a title. Or run:

```sh
npm run new-post -- "My next post"
```

Open the new file in `posts/` and write below the metadata block:

```md
---
title: My next post
date: 2026-10-12
description: A one-sentence summary.
draft: true
---

Write your paragraphs here.

## A heading

**Bold**, *italics*, [links](https://example.com), lists, images,
quotes, and code blocks all work.
```

The local server includes drafts on **http://localhost:3005/writing/**. The production build excludes drafts. When ready, change `draft: true` to `draft: false` and commit/push to GitHub after deployment is connected. Article pages and the Writing list are generated automatically, newest first. Dates are used for sorting but are not shown on the pages.

`posts/first-post.md` is an editable draft example. Remove it or replace it with your first post. Only `.md` files in `posts/` are used as articles. Metadata is a simple one-line-per-field format; keep `title`, `date`, `description`, and `draft` on their own lines. Use lowercase filenames with letters, numbers, and hyphens.

## Render deployment settings

- Service type: Static Site
- Branch: `main`
- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- Auto-deploy: on commit

Run `npm run build` to generate the production website. Never edit `dist/`; it is rebuilt from your source.

Cloudflare's root (`@`) and `www` CNAME records should point to the eventual Render hostname. Keep them DNS-only until Render verifies the domain and issues its HTTPS certificate.

The local website is ready. GitHub/Render deployment and Cloudflare nameserver activation still need completion; running the local server does not publish the site.

## Add a quick note

Choose **Terminal → Run Task → New note** in VS Code, or run:

```sh
npm run new-note -- "A quick thought"
```

Edit the new Markdown file in `content/notes/`. Write your snippet below the metadata block. The title labels the note for accessibility; the card displays the text and date. Notes appear newest first at `/notes/`, and clicking a date links to that card. Local preview includes drafts; change `draft: true` to `draft: false` to include a note in the production build. Delete its Markdown file to remove a note. Save with Command-S to refresh the local preview.

## Update Showcase

Edit `content/projects.json` to add or reorder projects at `/showcase/`. Each entry has `name`, `image`, and `url` fields, plus an optional `video` path for a muted, autoplaying loop. Store project media in `public/assets/projects/`. Leave `url` empty until a real project link is ready. Save and refresh the preview; run `npm run build` for production.
