#!/usr/bin/env bun
/**
 * Newsletter Business Analyzer
 *
 * Analyzes Chris Koerner's newsletter archive to find business opportunities
 * that match your criteria for a physical-world, solo-operable business
 * that an AI agent can help operate.
 *
 * Usage:
 *   bun run analyze              # Full pipeline (scrape, extract, score, output)
 *   bun run analyze --no-scrape  # Skip scraping, use cached data
 *   bun run analyze --no-extract # Skip extraction, use cached ideas
 */

import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { scrapeNewsletter, loadCachedArchive } from './scraper.js';
import { extractAllIdeas, loadCachedIdeas } from './extractor.js';
import { scoreAllIdeas } from './scorer.js';
import { writeRecommendations } from './output.js';

const OUTPUT_DIR = path.join(import.meta.dirname, '../output');

interface Options {
  scrape: boolean;
  extract: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  return {
    scrape: !args.includes('--no-scrape'),
    extract: !args.includes('--no-extract'),
  };
}

async function main() {
  const options = parseArgs();

  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Newsletter Business Analyzer             ║');
  console.log('║   Finding your next opportunity...         ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    await mkdir(OUTPUT_DIR, { recursive: true });
  }

  // Step 1: Scrape newsletter
  console.log('📰 Step 1: Newsletter Scraping');
  console.log('─'.repeat(40));

  let archive = await loadCachedArchive();

  if (options.scrape || !archive) {
    if (!options.scrape && !archive) {
      console.log('No cached archive found, scraping required...');
    }
    archive = await scrapeNewsletter();
  } else {
    console.log(`Using cached archive (${archive.posts.length} posts from ${archive.scraped_at})`);
  }

  console.log(`\n✓ ${archive.posts.length} newsletter posts available\n`);

  // Step 2: Extract business ideas
  console.log('🔍 Step 2: Business Idea Extraction');
  console.log('─'.repeat(40));

  let ideas = await loadCachedIdeas();

  if (options.extract || !ideas) {
    if (!options.extract && !ideas) {
      console.log('No cached ideas found, extraction required...');
    }
    ideas = await extractAllIdeas();
  } else {
    console.log(`Using cached ideas (${ideas.length} ideas)`);
  }

  console.log(`\n✓ ${ideas.length} business ideas extracted\n`);

  // Step 3: Score and rank
  console.log('📊 Step 3: Scoring & Ranking');
  console.log('─'.repeat(40));

  const scored = await scoreAllIdeas();
  console.log(`\n✓ ${scored.length} ideas scored and ranked\n`);

  // Step 4: Generate output
  console.log('📝 Step 4: Generating Recommendations');
  console.log('─'.repeat(40));

  const outputPath = await writeRecommendations(scored);

  // Print summary
  console.log('\n' + '═'.repeat(44));
  console.log('Analysis Complete!');
  console.log('═'.repeat(44));
  console.log(`\nTop 5 Recommendations:\n`);

  scored.slice(0, 5).forEach((idea, i) => {
    const emoji = idea.score >= 80 ? '🟢' : idea.score >= 60 ? '🟡' : '🟠';
    console.log(`  ${i + 1}. ${emoji} [${idea.score}] ${idea.name}`);
    console.log(`     ${idea.description.substring(0, 80)}...`);
    console.log();
  });

  console.log(`Full report: ${outputPath}`);
  console.log(`\nRun with --no-scrape to skip re-scraping (uses cached data)`);
  console.log(`Run with --no-extract to skip re-extraction (uses cached ideas)`);
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
