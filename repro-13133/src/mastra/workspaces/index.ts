/**
 * CloudDocs Workspace — Dynamic Filesystem
 *
 * One workspace instance serves different folders and permissions
 * based on the role in requestContext:
 *
 *   admin  → data/admin  (read + write)
 *   viewer → data/viewer  (read only)
 *   guest  → data/guest   (read only)
 */

import path from 'node:path';
import { Workspace, LocalFilesystem } from '@mastra/core/workspace';
import type { RequestContext } from '@mastra/core/request-context';

const DATA_ROOT = path.resolve(import.meta.dirname, '../../../data');

export const cloudDocsWorkspace = new Workspace({
  id: 'clouddocs-workspace',
  name: 'CloudDocs Support Workspace',

  filesystem: ({ requestContext }: { requestContext: RequestContext }) => {
    const role = (requestContext.get('role') as string) || 'guest';

    const roleConfig: Record<string, { folder: string; readOnly: boolean }> = {
      admin: { folder: 'admin', readOnly: false },
      viewer: { folder: 'viewer', readOnly: true },
      guest: { folder: 'guest', readOnly: true },
    };

    const config = roleConfig[role] || roleConfig['guest']!;

    console.log(`  [Workspace] role="${role}" → folder=data/${config.folder}, readOnly=${config.readOnly}`);

    return new LocalFilesystem({
      basePath: path.join(DATA_ROOT, config.folder),
      readOnly: config.readOnly,
    });
  },
});
