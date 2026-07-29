# Newsletter Business Analyzer

Analyzes [Chris Koerner's newsletter](https://newsletter.chrisjkoerner.com/) archive to find business opportunities that match your criteria for a physical-world, solo-operable business that an AI agent can help operate.

## Quick Start

```bash
# Install dependencies (from monorepo root)
bun install

# Install Playwright browser
npx playwright install chromium

# Run the full pipeline
cd packages/agents/newsletter-analyzer
ANTHROPIC_API_KEY=your-key bun run analyze
```

## Commands

| Command | Description |
|---------|-------------|
| `bun run analyze` | Full pipeline: scrape → extract → score → output |
| `bun run analyze --no-scrape` | Skip scraping, use cached newsletter data |
| `bun run analyze --no-extract` | Skip extraction, use cached business ideas |
| `bun run scrape` | Only scrape newsletter posts |
| `bun run extract` | Only extract business ideas from posts |
| `bun run score` | Only score and rank ideas |

## Pipeline

1. **Scraper** (`src/scraper.ts`) - Uses Playwright to fetch all newsletter posts, handling "Load more" pagination
2. **Extractor** (`src/extractor.ts`) - Uses Claude API to extract structured business ideas from each post
3. **Scorer** (`src/scorer.ts`) - Scores ideas against weighted criteria, filters required attributes
4. **Output** (`src/output.ts`) - Generates ranked markdown recommendations

## Scoring Criteria

**Required filters (pass/fail):**
- `physical_world: true` - Must involve physical goods, locations, or in-person services
- `solo_operable: true` - Can be run with contractors, no W-2 employees

**Weighted scoring:**
| Factor | Weight | Preference |
|--------|--------|------------|
| Time to First Revenue | 9 | <90 days |
| Capital Required | 8 | <$10K |
| Decision Complexity | 7 | Low (AI-assistable) |
| Revenue Type | 6 | Recurring |
| Location | 5 | Flexible or Bay Area viable |

## Data Schema

```typescript
interface BusinessIdea {
  id: string;
  name: string;
  source_url: string;
  source_date: string;
  description: string;
  model_type: 'service' | 'product' | 'arbitrage' | 'rental' | 'other';
  physical_world: boolean;
  capital_required_estimate: number;
  time_to_first_revenue_days: number;
  revenue_type: 'recurring' | 'project' | 'transactional';
  solo_operable: boolean;
  location_dependent: boolean;
  location_notes: string;
  decision_complexity: 'low' | 'medium' | 'high';
  raw_notes: string;
}
```

## Output

Results are saved to `output/recommendations.md` - a ranked list of business opportunities with:
- Score breakdown by criteria
- 2-3 sentence rationale
- Source link to original newsletter post

## Environment Variables

- `ANTHROPIC_API_KEY` - Required for the extraction step (Claude API)
