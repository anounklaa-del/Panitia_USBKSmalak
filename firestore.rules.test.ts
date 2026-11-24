/**
 * Security Rules Verification Spec for Portal Panitia PAS SMA Negeri 1 Alalak.
 * Documents the 12 Dirty Dozen adversarial cases verified against firestore.rules.
 */
export interface SecurityTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED' | 'ALLOW';
}

export const DIRTY_DOZEN_CASES: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unspecified collection read blocked by default-deny net',
    operation: 'get',
    path: '/secret_collection/doc',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Collection list query on pas_accounts denied to prevent hash scraping',
    operation: 'list',
    path: '/pas_accounts',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Recreating already-initialized pas_accounts/admin denied',
    operation: 'create',
    path: '/pas_accounts/admin',
    payload: { usernameKey: 'admin', role: 'admin', active: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Deactivating or demoting pas_accounts/admin denied',
    operation: 'update',
    path: '/pas_accounts/admin',
    payload: { active: false, role: 'panitia' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Deleting built-in admin or panitia account denied',
    operation: 'delete',
    path: '/pas_accounts/admin',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Creating custom account with escalated admin role denied',
    operation: 'create',
    path: '/pas_accounts/attacker',
    payload: { usernameKey: 'attacker', role: 'admin', active: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Shadow update injecting ghost field into pas_datasets denied',
    operation: 'update',
    path: '/pas_datasets/students',
    payload: { ghostField: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Client-forged timestamp not matching request.time denied',
    operation: 'create',
    path: '/pas_datasets/students',
    payload: { createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Invalid dataset ID outside allowlist denied',
    operation: 'create',
    path: '/pas_datasets/arbitrary_doc',
    payload: { datasetType: 'arbitrary_doc' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Oversized ID poisoning (>128 chars) denied',
    operation: 'get',
    path: `/pas_datasets/${'a'.repeat(160)}`,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Blanket list query on pas_datasets collection denied',
    operation: 'list',
    path: '/pas_datasets',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Non-hex saltHex/hashHex rejected by schema validation',
    operation: 'create',
    path: '/pas_accounts/siti.aminah',
    payload: { usernameKey: 'siti.aminah', saltHex: 'not-hex!', hashHex: 'xyz' },
    expected: 'PERMISSION_DENIED',
  },
];
