export const ROLES = ['owner', 'catalog_manager', 'order_manager', 'tailor', 'support'] as const;
export type Role = (typeof ROLES)[number];
export const PERMISSIONS = [
  'catalog.read',
  'catalog.write',
  'catalog.publish',
  'settings.write',
  'suppliers.read',
  'suppliers.write',
  'orders.read',
  'orders.measurements.read',
  'orders.fulfillment.write',
  'orders.hold',
  'orders.notes.write',
  'orders.notifications.retry',
  'reviews.read',
  'reviews.decide',
  'customers.read',
  'staff.manage',
  'audit.read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  catalog_manager: [
    'catalog.read',
    'catalog.write',
    'catalog.publish',
    'suppliers.read',
    'suppliers.write',
  ],
  order_manager: [
    'catalog.read',
    'suppliers.read',
    'suppliers.write',
    'orders.read',
    'orders.measurements.read',
    'orders.fulfillment.write',
    'orders.hold',
    'orders.notes.write',
    'orders.notifications.retry',
    'reviews.read',
    'customers.read',
  ],
  tailor: [
    'catalog.read',
    'orders.read',
    'orders.measurements.read',
    'orders.hold',
    'orders.notes.write',
    'reviews.read',
    'reviews.decide',
  ],
  support: [
    'catalog.read',
    'orders.read',
    'orders.notes.write',
    'orders.notifications.retry',
    'customers.read',
  ],
};
export const permissionsFor = (roles: readonly Role[]) =>
  PERMISSIONS.filter((p) => roles.some((r) => ROLE_PERMISSIONS[r].includes(p)));
export const hasPermission = (roles: readonly Role[], permission: Permission) =>
  roles.some((r) => ROLE_PERMISSIONS[r].includes(permission));
