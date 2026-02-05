# Career Ops Agent Data

This directory contains the structured data for the Career Ops Agent.

## Files

- `pipeline.json` - Job opportunity tracking (committed, example data)
- `network.json` - Contact relationship management (committed, example data)
- `index.ts` - TypeScript types and helper functions

## Local Data Management

For real data with sensitive information:

1. Copy the templates to local versions:
   ```bash
   cp pipeline.json pipeline.local.json
   cp network.json network.local.json
   ```

2. Update `index.ts` to load local files if they exist:
   ```typescript
   // Check for local version first, fallback to template
   const pipelineFile = existsSync('pipeline.local.json')
     ? 'pipeline.local.json'
     : 'pipeline.json'
   ```

3. Edit the `.local.json` files with real data - these are gitignored

## Data Structure

### Pipeline Stages
- `identified` → `researched` → `outreach` → `conversation` → `interview` → `offer` → `closed-won`/`closed-lost`

### Network Relationship Tiers
- `target` → `warm` → `active` → `advocate`

### Signal Strength
1-10 scale evaluating fit with target profile (10 = perfect fit)