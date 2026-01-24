import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { BusinessIdea, NewsletterPost, ScrapedArchive } from './types.js';

const DATA_DIR = path.join(import.meta.dirname, '../data');
const ARCHIVE_FILE = path.join(DATA_DIR, 'archive.json');
const IDEAS_FILE = path.join(DATA_DIR, 'ideas.json');

const client = new Anthropic();

const EXTRACTION_PROMPT = `You are analyzing a newsletter post about business opportunities. Extract any concrete business ideas mentioned.

For each business idea found, provide the following in JSON format:
- name: A concise name for the business idea
- description: 2-3 sentences describing what the business does
- model_type: One of "service", "product", "arbitrage", "rental", or "other"
- physical_world: boolean - Does this involve physical goods, locations, or in-person services?
- capital_required_estimate: Estimated USD to start (be conservative, include equipment, inventory, etc.)
- time_to_first_revenue_days: Realistic estimate of days to first dollar
- revenue_type: One of "recurring", "project", or "transactional"
- solo_operable: boolean - Can one person run this with contractors (no W-2 employees)?
- location_dependent: boolean - Must operate in a specific location?
- location_notes: Brief note about location requirements or flexibility
- decision_complexity: "low", "medium", or "high" - How complex are daily operational decisions?
- raw_notes: Any additional context or caveats from the newsletter

If the post doesn't contain any actionable business ideas, return an empty array.

Focus on ideas that are:
- Concrete and actionable (not vague concepts)
- Real businesses someone could start (not stocks/investments)
- Mentioned with enough detail to understand the model

Return ONLY valid JSON array, no markdown code blocks or other text.`;

async function extractIdeasFromPost(post: NewsletterPost): Promise<Omit<BusinessIdea, 'id'>[]> {
  // Truncate content if too long (Claude has context limits)
  const maxContentLength = 15000;
  const content =
    post.content.length > maxContentLength
      ? post.content.substring(0, maxContentLength) + '...[truncated]'
      : post.content;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `${EXTRACTION_PROMPT}

Newsletter Post Title: ${post.title}
Published: ${post.date}
URL: ${post.url}

Content:
${content}`,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  try {
    // Try to parse the response as JSON
    const parsed = JSON.parse(responseText.trim());
    const ideas = Array.isArray(parsed) ? parsed : [parsed];

    // Add source info to each idea
    return ideas.map((idea: Omit<BusinessIdea, 'id' | 'source_url' | 'source_date'>) => ({
      ...idea,
      source_url: post.url,
      source_date: post.date,
    }));
  } catch (error) {
    console.error(`Failed to parse response for ${post.title}:`, responseText.substring(0, 200));
    return [];
  }
}

function generateId(idea: Omit<BusinessIdea, 'id'>): string {
  const slug = idea.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .substring(0, 30);
  const hash = Buffer.from(idea.source_url + idea.name)
    .toString('base64')
    .substring(0, 6);
  return `${slug}-${hash}`;
}

export async function extractAllIdeas(): Promise<BusinessIdea[]> {
  if (!existsSync(ARCHIVE_FILE)) {
    throw new Error(`Archive file not found. Run scraper first: bun run scrape`);
  }

  const archive: ScrapedArchive = JSON.parse(await readFile(ARCHIVE_FILE, 'utf-8'));
  console.log(`Processing ${archive.posts.length} posts...`);

  const allIdeas: BusinessIdea[] = [];

  for (let i = 0; i < archive.posts.length; i++) {
    const post = archive.posts[i];
    console.log(`[${i + 1}/${archive.posts.length}] Extracting from: ${post.title}`);

    try {
      const ideas = await extractIdeasFromPost(post);

      for (const idea of ideas) {
        const fullIdea: BusinessIdea = {
          ...idea,
          id: generateId(idea),
        };
        allIdeas.push(fullIdea);
        console.log(`  Found: ${fullIdea.name}`);
      }

      // Rate limiting for API
      if (i < archive.posts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`  Error processing post:`, error);
    }
  }

  // Deduplicate by ID
  const uniqueIdeas = Array.from(new Map(allIdeas.map((idea) => [idea.id, idea])).values());

  await writeFile(IDEAS_FILE, JSON.stringify(uniqueIdeas, null, 2));
  console.log(`\nExtracted ${uniqueIdeas.length} unique ideas, saved to ${IDEAS_FILE}`);

  return uniqueIdeas;
}

export async function loadCachedIdeas(): Promise<BusinessIdea[] | null> {
  if (!existsSync(IDEAS_FILE)) return null;

  try {
    const data = await readFile(IDEAS_FILE, 'utf-8');
    return JSON.parse(data) as BusinessIdea[];
  } catch {
    return null;
  }
}

// Run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  extractAllIdeas()
    .then((ideas) => {
      console.log(`\nExtraction complete! ${ideas.length} ideas found.`);
    })
    .catch(console.error);
}
