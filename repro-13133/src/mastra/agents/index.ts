/**
 * CloudDocs Support Agent
 *
 * Single agent — adapts behavior based on caller's role.
 * Workspace tools (read_file, write_file, list_files, etc.)
 * are auto-injected by Mastra when a workspace is attached.
 */

import { Agent } from '@mastra/core/agent';
import { cloudDocsWorkspace } from '../workspaces/index.js';

export const supportAgent = new Agent({
  id: 'clouddocs-support',
  name: 'CloudDocs Support Agent',

  model: 'anthropic/claude-haiku-4-5-20251001',

  instructions: ({ requestContext }) => {
    const role = requestContext.get('role') || 'guest';
    const userName = requestContext.get('userName') || 'User';

    const base = `You are the CloudDocs support assistant. You are talking to ${userName} (role: ${role}).
You help users with their files stored in CloudDocs.

You have workspace tools to interact with files:
- Use mastra_workspace_list_files to see what files exist
- Use mastra_workspace_read_file to read file contents
- Use mastra_workspace_write_file to create/overwrite files (if you have write access)
- Use mastra_workspace_edit_file to modify parts of a file (if you have write access)
- Use mastra_workspace_delete to delete files (if you have write access)

Always list files first so you know what's available.
Be helpful and concise.`;

    if (role === 'admin') {
      return base + '\n\nYou have ADMIN access. You can read AND write files — update configs, create reports, etc.';
    }
    if (role === 'viewer') {
      return base + '\n\nYou have VIEWER access. You can only READ files. If asked to write/edit/delete, politely explain you cannot.';
    }
    return base + '\n\nYou have GUEST access. You can only read the welcome page. Suggest signing up for more.';
  },

  workspace: cloudDocsWorkspace,
});
