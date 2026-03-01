// src/prompts/research-templates.ts
import type { PromptArgument } from '@modelcontextprotocol/sdk/types.js';

export interface ResearchPrompt {
  name: string;
  description: string;
  arguments: PromptArgument[];
  template: (args: Record<string, string>) => string;
}

export const RESEARCH_PROMPTS: ResearchPrompt[] = [
  {
    name: 'deep-research',
    description: 'Conduct deep research on a topic with multiple sources and comprehensive analysis',
    arguments: [
      { name: 'topic', description: 'The topic to research', required: true },
      { name: 'depth', description: 'Research depth level (1=basic, 2=standard, 3=comprehensive)', required: false },
    ],
    template: (args) => {
      const topic = args.topic;
      const depth = args.depth || '2';
      const maxPages = depth === '3' ? 20 : depth === '2' ? 10 : 5;

      return `Conduct a depth-${depth} research on: "${topic}"

Instructions:
1. Use the research tool with the following parameters:
   - query: "${topic}"
   - focus_topics: ["${topic}", "overview", "latest developments", "analysis"]
   - max_pages: ${maxPages}
   - extract_facts: true
   - follow_links: ${depth !== '1'}

2. After gathering results, synthesize the findings into:
   - Executive summary
   - Key findings with citations
   - Different perspectives if available
   - Conclusions and recommendations

3. If the topic requires more depth, use additional searches with refined queries.`;
    },
  },
  {
    name: 'compare-sources',
    description: 'Compare information across multiple sources to identify consensus and disagreements',
    arguments: [
      { name: 'query', description: 'The search query to compare sources for', required: true },
      { name: 'sources', description: 'Number of sources to compare (default: 5)', required: false },
    ],
    template: (args) => {
      const query = args.query;
      const sources = args.sources || '5';

      return `Compare sources on: "${query}"

Instructions:
1. Use the search tool to find ${sources} different sources:
   - query: "${query}"
   - limit: ${sources}

2. Use the extract tool on each unique domain to get full content

3. Create a comparison matrix including:
   - Source name and credibility indicators
   - Main claims made
   - Supporting evidence
   - Areas of agreement
   - Areas of disagreement
   - Notable omissions

4. Provide an analysis of:
   - Which claims have consensus
   - Which claims are disputed
   - What might explain differences
   - Recommended next steps for verification`;
    },
  },
  {
    name: 'fact-check',
    description: 'Verify a claim by searching for supporting and contradicting evidence',
    arguments: [
      { name: 'claim', description: 'The claim to verify', required: true },
      { name: 'context', description: 'Additional context about the claim', required: false },
    ],
    template: (args) => {
      const claim = args.claim;
      const context = args.context ? `Context: ${args.context}\n\n` : '';

      return `${context}Fact-check this claim: "${claim}"

Instructions:
1. Use the research tool with:
   - query: "${claim}"
   - focus_topics: ["evidence", "source", "verification", "debunk"]
   - max_pages: 10
   - extract_facts: true

2. Search for both supporting AND contradicting evidence

3. Evaluate findings based on:
   - Source credibility (primary vs secondary, expertise, bias)
   - Recency of information
   - Corroboration across independent sources
   - Methodology if research-based

4. Provide a verdict:
   - VERIFIED: Strong supporting evidence, no credible contradictions
   - PARTIALLY TRUE: Some support but with important caveats
   - DISPUTED: Significant contradictory evidence exists
   - UNVERIFIABLE: Insufficient reliable sources
   - FALSE: Strong contradicting evidence

5. Include citations for all evidence used.`;
    },
  },
];

export function getPromptContent(name: string, args: Record<string, string>): string | null {
  const prompt = RESEARCH_PROMPTS.find(p => p.name === name);
  if (!prompt) {
    return null;
  }
  return prompt.template(args);
}
