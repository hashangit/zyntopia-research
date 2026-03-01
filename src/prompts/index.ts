// src/prompts/index.ts
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  type Prompt,
} from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  RESEARCH_PROMPTS,
  getPromptContent,
} from './research-templates.js';

export const PROMPTS: Prompt[] = RESEARCH_PROMPTS.map(p => ({
  name: p.name,
  description: p.description,
  arguments: p.arguments,
}));

export function setupPromptHandlers(server: Server): void {
  // List available prompts
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPTS,
  }));

  // Get specific prompt
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const promptName = request.params.name;
    const args = request.params.arguments || {};

    const content = getPromptContent(promptName, args as Record<string, string>);

    if (!content) {
      throw new Error(`Unknown prompt: ${promptName}`);
    }

    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: content,
          },
        },
      ],
    };
  });
}

export { RESEARCH_PROMPTS, getPromptContent } from './research-templates.js';
