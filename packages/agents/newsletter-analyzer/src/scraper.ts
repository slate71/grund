import { chromium, type Page } from 'playwright';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NewsletterPost, ScrapedArchive } from './types.js';

const ARCHIVE_URL = 'https://newsletter.chrisjkoerner.com/archive';
const DATA_DIR = path.join(import.meta.dirname, '../data');
const POSTS_DIR = path.join(DATA_DIR, 'posts');
const ARCHIVE_FILE = path.join(DATA_DIR, 'archive.json');

async function ensureDirectories() {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(POSTS_DIR)) await mkdir(POSTS_DIR, { recursive: true });
}

async function loadMorePosts(page: Page): Promise<number> {
  let totalLoaded = 0;
  let loadMoreButton = page.locator('button:has-text("Load more")');

  while ((await loadMoreButton.count()) > 0) {
    const currentCount = await page.locator('article, [data-testid="post"]').count();
    await loadMoreButton.first().click();
    await page.waitForTimeout(1500); // Wait for content to load

    const newCount = await page.locator('article, [data-testid="post"]').count();
    if (newCount <= currentCount) break; // No more posts loaded

    totalLoaded = newCount;
    console.log(`Loaded ${newCount} posts...`);

    // Re-query the button in case DOM changed
    loadMoreButton = page.locator('button:has-text("Load more")');
  }

  return totalLoaded;
}

async function getPostUrls(page: Page): Promise<string[]> {
  // Substack archive pages typically have posts as links
  const urls = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/p/"]');
    const uniqueUrls = new Set<string>();
    links.forEach((link) => {
      const href = (link as HTMLAnchorElement).href;
      if (href && href.includes('/p/')) {
        uniqueUrls.add(href.split('?')[0]); // Remove query params
      }
    });
    return Array.from(uniqueUrls);
  });

  return urls;
}

async function scrapePost(page: Page, url: string): Promise<NewsletterPost | null> {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(1000);

    const post = await page.evaluate(() => {
      // Get title
      const titleEl =
        document.querySelector('h1.post-title') ||
        document.querySelector('h1') ||
        document.querySelector('[data-testid="post-title"]');
      const title = titleEl?.textContent?.trim() || 'Untitled';

      // Get date
      const dateEl =
        document.querySelector('time') ||
        document.querySelector('[data-testid="post-date"]') ||
        document.querySelector('.post-date');
      const dateAttr = dateEl?.getAttribute('datetime');
      const dateText = dateEl?.textContent?.trim();
      const date = dateAttr || dateText || new Date().toISOString();

      // Get content - try multiple selectors for Substack
      const contentEl =
        document.querySelector('.post-content') ||
        document.querySelector('[data-testid="post-content"]') ||
        document.querySelector('.body') ||
        document.querySelector('article');

      // Get text content, preserving some structure
      let content = '';
      if (contentEl) {
        // Remove script and style elements
        const clone = contentEl.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('script, style, nav, footer').forEach((el) => el.remove());
        content = clone.textContent?.trim() || '';
      }

      return { title, date, content };
    });

    return {
      url,
      title: post.title,
      date: post.date,
      content: post.content,
    };
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error);
    return null;
  }
}

export async function scrapeNewsletter(): Promise<ScrapedArchive> {
  await ensureDirectories();

  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    console.log(`Navigating to ${ARCHIVE_URL}...`);
    await page.goto(ARCHIVE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    console.log('Loading all posts...');
    await loadMorePosts(page);

    console.log('Collecting post URLs...');
    const urls = await getPostUrls(page);
    console.log(`Found ${urls.length} posts`);

    const posts: NewsletterPost[] = [];
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`Scraping post ${i + 1}/${urls.length}: ${url}`);

      const post = await scrapePost(page, url);
      if (post) {
        posts.push(post);

        // Save individual post
        const filename = url.split('/p/')[1]?.replace(/[^a-z0-9-]/gi, '_') || `post_${i}`;
        await writeFile(path.join(POSTS_DIR, `${filename}.json`), JSON.stringify(post, null, 2));
      }

      // Be respectful with rate limiting
      await page.waitForTimeout(500);
    }

    const archive: ScrapedArchive = {
      scraped_at: new Date().toISOString(),
      posts,
    };

    await writeFile(ARCHIVE_FILE, JSON.stringify(archive, null, 2));
    console.log(`Saved ${posts.length} posts to ${ARCHIVE_FILE}`);

    return archive;
  } finally {
    await browser.close();
  }
}

export async function loadCachedArchive(): Promise<ScrapedArchive | null> {
  if (!existsSync(ARCHIVE_FILE)) return null;

  try {
    const data = await readFile(ARCHIVE_FILE, 'utf-8');
    return JSON.parse(data) as ScrapedArchive;
  } catch {
    return null;
  }
}

// Run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scrapeNewsletter()
    .then((archive) => {
      console.log(`\nScraping complete! ${archive.posts.length} posts saved.`);
    })
    .catch(console.error);
}
