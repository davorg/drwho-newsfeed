import puppeteer from 'puppeteer';
import { Feed } from 'feed';
import fs from 'fs';

const url = 'https://www.doctorwho.tv/news-and-features';

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const page = await browser.newPage();

await page.goto(url, { waitUntil: 'networkidle2' });

// Dump page structure to help identify current selectors
const pageInfo = await page.evaluate(() => {
  const anchors = Array.from(document.querySelectorAll('a[href^="/"]'))
    .filter(a => a.className)
    .slice(0, 30)
    .map(a => ({
      className: a.className,
      href: a.getAttribute('href'),
      text: a.innerText.slice(0, 80).replace(/\s+/g, ' ').trim(),
      childClasses: Array.from(a.querySelectorAll('[class]'))
        .map(el => `${el.tagName.toLowerCase()}:${el.className}`)
        .slice(0, 5)
    }));
  const bodyClasses = Array.from(document.querySelectorAll('[class]'))
    .map(el => el.className)
    .filter(c => c && c.length < 100)
    .slice(0, 50);
  return { anchors, bodyClasses };
});
console.log('=== PAGE STRUCTURE DEBUG ===');
console.log(JSON.stringify(pageInfo, null, 2));
console.log('=== END DEBUG ===');

// Find article links: anchor tags that wrap a heading element, pointing to internal paths
const articles = await page.evaluate(() => {
  const results = [];

  // Look for <a href="/..."> elements that contain a heading — these are article cards
  const candidates = Array.from(document.querySelectorAll('a[href^="/"]'))
    .filter(a => a.querySelector('h2, h3, h4'));

  for (const a of candidates) {
    const href = a.getAttribute('href');
    const titleEl = a.querySelector('h2, h3, h4');
    const dateEl = a.querySelector('time, [class*="date"]');
    const summaryEl = a.querySelector('p');

    const title = titleEl?.innerText?.trim();
    const summary = summaryEl?.innerText?.trim();

    let date = null;
    if (dateEl) {
      // Prefer the semantic datetime attribute on <time> elements
      date = dateEl.getAttribute('datetime') || dateEl.innerText.trim() || null;
    }

    if (title && href) {
      results.push({ title, href, date, summary });
    }
  }

  return results;
});

console.log(`Found ${articles.length} articles`);

// Deduplicate by href (URL)
const unique = new Map();

for (const article of articles) {
  if (!unique.has(article.href)) {
    unique.set(article.href, article);
  }
}

const dedupedArticles = Array.from(unique.values());

// 🆕 Sort by descending date
dedupedArticles.sort((a, b) => new Date(b.date) - new Date(a.date));

const feed = new Feed({
  title: "Doctor Who News",
  description: "Latest articles from doctorwho.tv",
  id: url,
  link: url,
  updated: new Date(),
  generator: "puppeteer + feed",
});

for (const { title, href, date, summary } of dedupedArticles) {
  let pubDate;
  try {
    pubDate = date ? new Date(date) : new Date();
  } catch {
    pubDate = new Date();
  }

  feed.addItem({
    title,
    id: href,
    link: 'https://www.doctorwho.tv' + href,
    date: pubDate,
    description: summary || '',
  });
}

fs.mkdirSync("docs", { recursive: true });
fs.writeFileSync("docs/doctorwho.xml", feed.rss2());
await browser.close();

console.log(`✔ Feed written to doctorwho.xml with ${dedupedArticles.length} items and real dates.`);

