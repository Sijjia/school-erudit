import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'vacancy',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'hr', 'secretary'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'hr'],
  createFields: ['title', 'department', 'count', 'status'],
  intFields: ['count'],
  orderBy: { createdAt: 'desc' },
  filterableParams: ['status'],
});
