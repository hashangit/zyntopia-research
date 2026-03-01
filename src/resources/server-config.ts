// src/resources/server-config.ts
import type { Resource } from '@modelcontextprotocol/sdk/types.js';

export interface ServerConfig {
  name: string;
  version: string;
  mcpSpecVersion: string;
  sdkVersion: string;
  capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
  };
  tools: Array<{
    name: string;
    title: string;
    description: string;
    readOnly: boolean;
  }>;
}

export function getServerConfigResource(): Resource {
  return {
    uri: 'config://server',
    name: 'Server Configuration',
    description: 'Server capabilities, version info, and available tools',
    mimeType: 'application/json',
  };
}

export function readServerConfig(): ServerConfig {
  return {
    name: 'web-search',
    version: '0.3.0',
    mcpSpecVersion: '2025-11-25',
    sdkVersion: '1.27.1',
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
    },
    tools: [
      {
        name: 'search',
        title: 'Web Search',
        description: 'Search the web using Google (no API key required)',
        readOnly: true,
      },
      {
        name: 'extract',
        title: 'Content Extraction',
        description: 'Extract structured content from web pages with multiple output formats',
        readOnly: true,
      },
      {
        name: 'research',
        title: 'Automated Research',
        description: 'Search, auto-browse relevant results, and return structured findings',
        readOnly: true,
      },
    ],
  };
}
