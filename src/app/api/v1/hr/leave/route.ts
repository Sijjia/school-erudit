import { createCrud } from '@/shared/lib/crud';

export const { GET, POST, DELETE } = createCrud({
  model: 'leaveRecord',
  listRoles: ['super_admin', 'analyst', 'zavuch', 'hr'],
  writeRoles: ['super_admin', 'analyst', 'zavuch', 'hr'],
  createFields: ['staffId', 'type', 'startDate', 'endDate', 'note'],
  dateFields: ['startDate', 'endDate'],
  orderBy: { startDate: 'desc' },
  filterableParams: ['staffId', 'type'],
});
