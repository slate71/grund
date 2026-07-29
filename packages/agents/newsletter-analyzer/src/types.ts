export interface BusinessIdea {
  id: string;
  name: string;
  source_url: string;
  source_date: string;
  description: string;
  model_type: 'service' | 'product' | 'arbitrage' | 'rental' | 'other';
  physical_world: boolean;
  capital_required_estimate: number; // USD
  time_to_first_revenue_days: number;
  revenue_type: 'recurring' | 'project' | 'transactional';
  solo_operable: boolean; // can run with contractors, no employees
  location_dependent: boolean;
  location_notes: string;
  decision_complexity: 'low' | 'medium' | 'high'; // can an agent reason about ops decisions?
  raw_notes: string;
}

export interface ScoredIdea extends BusinessIdea {
  score: number;
  score_breakdown: {
    capital: number;
    time_to_revenue: number;
    revenue_type: number;
    location: number;
    complexity: number;
  };
  rationale: string;
}

export interface NewsletterPost {
  url: string;
  title: string;
  date: string;
  content: string;
}

export interface ScrapedArchive {
  scraped_at: string;
  posts: NewsletterPost[];
}

export const SCORING_WEIGHTS = {
  capital: 8,
  time_to_revenue: 9,
  revenue_type: 6,
  location: 5,
  complexity: 7,
} as const;

// Thresholds for scoring
export const SCORING_THRESHOLDS = {
  capital: {
    excellent: 5000, // < $5K = 10 points
    good: 10000, // < $10K = 7 points
    fair: 25000, // < $25K = 4 points
    // else = 1 point
  },
  time_to_revenue: {
    excellent: 30, // < 30 days = 10 points
    good: 60, // < 60 days = 7 points
    fair: 90, // < 90 days = 4 points
    // else = 1 point
  },
} as const;
