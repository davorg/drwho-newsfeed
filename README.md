# Doctor Who Newsfeed RSS Generator

(Insert rant about the death of web feeds)

This script fetches the latest articles fromi
[doctorwho.tv/news-and-features](https://www.doctorwho.tv/news-and-features)
and generates an RSS feed (`doctorwho.xml`) using Puppeteer.

## Requirements

- Node.js 18+ (tested with Node.js 20.19.3)
- npm

## Setup

1️⃣ Clone this repo or place the script (`doctorwho_feed.mjs`) in a folder.

2️⃣ Install dependencies:

```bash
npm install puppeteer feed
```

This will create `node_modules` and `package-lock.json`.

## Usage

Run the script:

```bash
node doctorwho_feed.mjs
```

On success, it will generate:

```
✔ Feed written to doctorwho.xml with X items and real dates.
```

and create:

```
docs/doctorwho.xml
```

which contains the RSS feed.

## Debugging

- To see the browser window (for debugging), edit `doctorwho_feed.mjs`:

```js
const browser = await puppeteer.launch({
  headless: false,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});
```

- Add extra `console.log()` lines in the script to trace progress.

## Notes

- If running on Linux/macOS and you hit permissions issues, try:

```bash
sudo node doctorwho_feed.mjs
```

- If you see a `TimeoutError: Waiting for selector`, check if the website structure has changed (e.g., update your selectors).
