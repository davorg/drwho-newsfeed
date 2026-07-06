import assert from 'node:assert/strict';
import test from 'node:test';
import puppeteer from 'puppeteer';

import { extractArticlesFromPage, parseFeedDate } from './doctorwho_feed.mjs';

test('extractArticlesFromPage finds stories from article containers', async (t) => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  t.after(async () => {
    await browser.close();
  });

  const page = await browser.newPage();
  await page.setContent(`
    <main>
      <nav>
        <a href="/about">About</a>
      </nav>
      <article>
        <a href="https://www.doctorwho.tv/news-and-features/story-one">
          <img src="story-one.jpg" alt="Story One" />
        </a>
        <div class="card-body">
          <div class="storyTitle">Story One</div>
          <time datetime="2026-07-01T12:00:00.000Z">1 July 2026</time>
          <p>Summary for story one.</p>
        </div>
      </article>
      <article>
        <h3>
          <a href="/news-and-features/story-two">Story Two</a>
        </h3>
        <p>Summary for story two.</p>
      </article>
    </main>
  `);

  const articles = await page.evaluate(extractArticlesFromPage, 'https://www.doctorwho.tv/news-and-features');

  assert.deepEqual(articles, [
    {
      title: 'Story One',
      href: '/news-and-features/story-one',
      date: '2026-07-01T12:00:00.000Z',
      summary: 'Summary for story one.',
    },
    {
      title: 'Story Two',
      href: '/news-and-features/story-two',
      date: null,
      summary: 'Summary for story two.',
    },
  ]);
});

test('parseFeedDate falls back when given an invalid date', () => {
  const parsedDate = parseFeedDate('not-a-date');

  assert.ok(parsedDate instanceof Date);
  assert.ok(!Number.isNaN(parsedDate.getTime()));
});
