import puppeteer from 'puppeteer';
import { Feed } from 'feed';
import fs from 'fs';

const url = 'https://www.doctorwho.tv/news-and-features';

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

await page.goto(url, { waitUntil: 'networkidle2' });
await page.waitForSelector('article');

const articles = await page.evaluate(() => {
  const results = [];

  document.querySelectorAll('a.read-and-watch').forEach(a => {
    const href = a.getAttribute('href');
    const titleEl = a.querySelector('h3');
    const dateEl = a.querySelector('.read-and-watch__date');
    const summaryEl = a.querySelector('p:nth-of-type(2)');

    const title = titleEl?.innerText?.trim();
    const summary = summaryEl?.innerText?.trim();

    let date = null;
    if (dateEl) {
      const [day, month, year] = dateEl.innerText
        .trim()
        .split(/\s+/);
        // Return ISO date string instead of a Date object
        if (day && month && year) {
          date = `${day} ${month} ${year}`; // Return as string
        }
    }

    if (title && href) {
      results.push({
        title,
        href,
        date,
        summary
      });
    }
  });

  return results;
});

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

