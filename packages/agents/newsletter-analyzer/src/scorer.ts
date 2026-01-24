import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { BusinessIdea, ScoredIdea } from './types.js';
import { SCORING_WEIGHTS, SCORING_THRESHOLDS } from './types.js';

const DATA_DIR = path.join(import.meta.dirname, '../data');
const IDEAS_FILE = path.join(DATA_DIR, 'ideas.json');
const SCORED_FILE = path.join(DATA_DIR, 'scored.json');

function scoreCapital(amount: number): number {
  if (amount <= SCORING_THRESHOLDS.capital.excellent) return 10;
  if (amount <= SCORING_THRESHOLDS.capital.good) return 7;
  if (amount <= SCORING_THRESHOLDS.capital.fair) return 4;
  return 1;
}

function scoreTimeToRevenue(days: number): number {
  if (days <= SCORING_THRESHOLDS.time_to_revenue.excellent) return 10;
  if (days <= SCORING_THRESHOLDS.time_to_revenue.good) return 7;
  if (days <= SCORING_THRESHOLDS.time_to_revenue.fair) return 4;
  return 1;
}

function scoreRevenueType(type: BusinessIdea['revenue_type']): number {
  switch (type) {
    case 'recurring':
      return 10;
    case 'transactional':
      return 6;
    case 'project':
      return 4;
    default:
      return 5;
  }
}

function scoreLocation(dependent: boolean, notes: string): number {
  if (!dependent) return 10;
  // Check if Bay Area is mentioned as viable
  const bayAreaViable = /bay\s*area|san\s*francisco|sf|oakland|silicon\s*valley/i.test(notes);
  return bayAreaViable ? 7 : 3;
}

function scoreComplexity(complexity: BusinessIdea['decision_complexity']): number {
  switch (complexity) {
    case 'low':
      return 10;
    case 'medium':
      return 6;
    case 'high':
      return 2;
    default:
      return 5;
  }
}

function generateRationale(idea: BusinessIdea, breakdown: ScoredIdea['score_breakdown']): string {
  const pros: string[] = [];
  const cons: string[] = [];

  // Capital
  if (idea.capital_required_estimate <= 5000) {
    pros.push('very low capital requirement');
  } else if (idea.capital_required_estimate <= 10000) {
    pros.push('reasonable startup cost');
  } else {
    cons.push(`requires $${idea.capital_required_estimate.toLocaleString()} to start`);
  }

  // Time to revenue
  if (idea.time_to_first_revenue_days <= 30) {
    pros.push('can generate revenue within a month');
  } else if (idea.time_to_first_revenue_days <= 60) {
    pros.push('relatively quick path to revenue');
  } else {
    cons.push(`${idea.time_to_first_revenue_days} days to first revenue`);
  }

  // Revenue type
  if (idea.revenue_type === 'recurring') {
    pros.push('recurring revenue model');
  }

  // Location
  if (!idea.location_dependent) {
    pros.push('location-independent');
  } else if (idea.location_notes) {
    cons.push(idea.location_notes);
  }

  // Complexity
  if (idea.decision_complexity === 'low') {
    pros.push('simple operations suitable for AI assistance');
  } else if (idea.decision_complexity === 'high') {
    cons.push('complex decision-making required');
  }

  let rationale = idea.description;
  if (pros.length > 0) {
    rationale += ` Strengths: ${pros.join(', ')}.`;
  }
  if (cons.length > 0) {
    rationale += ` Considerations: ${cons.join(', ')}.`;
  }

  return rationale;
}

export function scoreIdea(idea: BusinessIdea): ScoredIdea {
  // Apply filters - these are required, not scored
  if (!idea.physical_world || !idea.solo_operable) {
    // Return with score 0 to filter out
    return {
      ...idea,
      score: 0,
      score_breakdown: { capital: 0, time_to_revenue: 0, revenue_type: 0, location: 0, complexity: 0 },
      rationale: idea.physical_world
        ? 'Filtered: Not solo-operable'
        : 'Filtered: Not physical-world business',
    };
  }

  const breakdown = {
    capital: scoreCapital(idea.capital_required_estimate),
    time_to_revenue: scoreTimeToRevenue(idea.time_to_first_revenue_days),
    revenue_type: scoreRevenueType(idea.revenue_type),
    location: scoreLocation(idea.location_dependent, idea.location_notes),
    complexity: scoreComplexity(idea.decision_complexity),
  };

  // Calculate weighted score (normalized to 0-100)
  const totalWeight =
    SCORING_WEIGHTS.capital +
    SCORING_WEIGHTS.time_to_revenue +
    SCORING_WEIGHTS.revenue_type +
    SCORING_WEIGHTS.location +
    SCORING_WEIGHTS.complexity;

  const weightedSum =
    breakdown.capital * SCORING_WEIGHTS.capital +
    breakdown.time_to_revenue * SCORING_WEIGHTS.time_to_revenue +
    breakdown.revenue_type * SCORING_WEIGHTS.revenue_type +
    breakdown.location * SCORING_WEIGHTS.location +
    breakdown.complexity * SCORING_WEIGHTS.complexity;

  const score = Math.round((weightedSum / (totalWeight * 10)) * 100);

  return {
    ...idea,
    score,
    score_breakdown: breakdown,
    rationale: generateRationale(idea, breakdown),
  };
}

export async function scoreAllIdeas(): Promise<ScoredIdea[]> {
  if (!existsSync(IDEAS_FILE)) {
    throw new Error(`Ideas file not found. Run extractor first: bun run extract`);
  }

  const ideas: BusinessIdea[] = JSON.parse(await readFile(IDEAS_FILE, 'utf-8'));
  console.log(`Scoring ${ideas.length} ideas...`);

  const scored = ideas.map(scoreIdea);

  // Filter out ideas that didn't pass required filters, then sort by score
  const validIdeas = scored.filter((idea) => idea.score > 0).sort((a, b) => b.score - a.score);

  const filteredCount = scored.length - validIdeas.length;
  console.log(`Filtered out ${filteredCount} ideas (not physical-world or not solo-operable)`);

  await writeFile(SCORED_FILE, JSON.stringify(validIdeas, null, 2));
  console.log(`Scored ${validIdeas.length} ideas, saved to ${SCORED_FILE}`);

  return validIdeas;
}

export async function loadScoredIdeas(): Promise<ScoredIdea[] | null> {
  if (!existsSync(SCORED_FILE)) return null;

  try {
    const data = await readFile(SCORED_FILE, 'utf-8');
    return JSON.parse(data) as ScoredIdea[];
  } catch {
    return null;
  }
}

// Run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scoreAllIdeas()
    .then((ideas) => {
      console.log(`\nScoring complete! Top 5 ideas:`);
      ideas.slice(0, 5).forEach((idea, i) => {
        console.log(`${i + 1}. [${idea.score}] ${idea.name}`);
      });
    })
    .catch(console.error);
}
