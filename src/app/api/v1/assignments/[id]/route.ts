import { createCrudId } from '@/shared/lib/crud';

/** PUT/DELETE назначения журнала (переименовать, изменить очки/дату, удалить). */
export const { GET, PUT, DELETE } = createCrudId({
  model: 'assignment',
  writeRoles: ['teacher', 'curator', 'zavuch', 'super_admin'],
});
