import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const title = process.argv.slice(2).join(' ').trim();
if (!title) { console.error('Usage: npm run new-post -- "My post title"'); process.exit(1); }
const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const slug = title.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'new-post';
const file = path.resolve(fileURLToPath(new URL('../posts/', import.meta.url)), `${date}-${slug}.md`);
const text = `---\ntitle: ${JSON.stringify(title)}\ndate: ${date}\ndescription: A short description of your post.\ndraft: true\n---\n\nStart writing here.\n`;
try { await writeFile(file, text, { flag: 'wx' }); console.log(`Created ${file}\nOpen it in VS Code and write in Markdown. Change draft to false when ready to publish.`); }
catch (error) { if (error.code === 'EEXIST') { console.error('A post with that date and title already exists. Choose another title.'); process.exit(1); } throw error; }
