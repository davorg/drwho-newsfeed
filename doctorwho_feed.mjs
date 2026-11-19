import puppeteer from 'puppeteer';
import { Feed } from 'feed';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const url = 'https://www.doctorwho.tv/news-and-features';

export function extractArticlesFromPage(pageUrl) {
  const pageLocation = new URL(pageUrl, window.location.href);
  const titleSelector = 'h1, h2, h3, h4, h5, h6, [class*="title"], [class*="Title"], [class*="heading"], [class*="Heading"]';
  const getText = (element) => element?.innerText?.replace(/\s+/g, ' ').trim() || '';
  const normaliseHref = (rawHref) => {
    try {
      const resolvedUrl = new URL(rawHref, pageLocation);

      if (resolvedUrl.origin !== pageLocation.origin || resolvedUrl.pathname === pageLocation.pathname) {
        return null;
      }

      if (!resolvedUrl.pathname.includes('/news-and-features/')) {
        return null;
      }

      return resolvedUrl.pathname + resolvedUrl.search + resolvedUrl.hash;
    } catch {
      return null;
    }
  };

  const articleLinks = Array.from(document.querySelectorAll('article'))
    .flatMap((article) => Array.from(article.querySelectorAll('a[href]')).map((link) => ({ container: article, link })));

  const candidates = articleLinks.length > 0
    ? articleLinks
    : Array.from(document.querySelectorAll('main a[href], a[href]'))
        .map((link) => ({ container: link.closest('article, section, li, div') || link, link }));

  const results = [];

  for (const { container, link } of candidates) {
    const href = normaliseHref(link.getAttribute('href'));
    if (!href) {
      continue;
    }

    const title =
      getText(link.querySelector(titleSelector)) ||
      getText(container.querySelector(titleSelector)) ||
      link.getAttribute('aria-label')?.trim() ||
      getText(link);

    if (!title) {
      continue;
    }

    const dateEl = container.querySelector('time, [datetime], [class*="date"], [class*="Date"]');
    const date = dateEl
      ? dateEl.getAttribute('datetime') || dateEl.getAttribute('content') || getText(dateEl) || null
      : null;

    const summary = getText(
      Array.from(container.querySelectorAll('p')).find((paragraph) => {
        const text = getText(paragraph);
        return text && text !== title;
      })
    );

    results.push({ title, href, date, summary });
  }

  return results;
}

export function parseFeedDate(date) {
  const parsedDate = date ? new Date(date) : new Date();
  return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
}

export async function generateFeed({
  pageUrl = url,
  outputPath = 'docs/doctorwho.xml',
} = {}) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('a[href*="/news-and-features/"]', { timeout: 10000 }).catch(() => {});

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const articles = await page.evaluate(extractArticlesFromPage, pageUrl);
    console.log(`Found ${articles.length} articles`);

    const unique = new Map();
    for (const article of articles) {
      if (!unique.has(article.href)) {
        unique.set(article.href, article);
      }
    }

    const dedupedArticles = Array.from(unique.values());
    dedupedArticles.sort((a, b) => parseFeedDate(b.date) - parseFeedDate(a.date));

    const feed = new Feed({
      title: 'Doctor Who News',
      description: 'Latest articles from doctorwho.tv',
      id: pageUrl,
      link: pageUrl,
      updated: new Date(),
      generator: 'puppeteer + feed',
    });

    for (const { title, href, date, summary } of dedupedArticles) {
      feed.addItem({
        title,
        id: href,
        link: 'https://www.doctorwho.tv' + href,
        date: parseFeedDate(date),
        description: summary || '',
      });
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, feed.rss2());

    return dedupedArticles.length;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const itemCount = await generateFeed();
  console.log(`✔ Feed written to doctorwho.xml with ${itemCount} items and real dates.`);
}
