// src/resources/index.ts
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  type Resource,
} from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { getServerConfigResource, readServerConfig } from './server-config.js';
import { getSessionStatusResource, readSessionStatus } from './session-status.js';

export const RESOURCES: Resource[] = [
  getServerConfigResource(),
  getSessionStatusResource(),
];

export function setupResourceHandlers(server: Server): void {
  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: RESOURCES,
  }));

  // Read specific resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;

    if (uri === 'config://server') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(readServerConfig(), null, 2),
          },
        ],
      };
    }

    if (uri === 'session://status') {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(await readSessionStatus(), null, 2),
          },
        ],
      };
    }

    throw new Error(`Unknown resource: ${uri}`);
  });
}

export { getServerConfigResource, readServerConfig } from './server-config.js';
export { getSessionStatusResource, readSessionStatus } from './session-status.js';
