export type DashboardRole = 'owner' | 'worker' | 'guest';
export type WorkerType =
  | 'CLEANER'
  | 'MAINTENANCE'
  | 'YARD'
  | 'POOL'
  | 'CONTRACTOR'
  | 'MANAGER'
  | 'GENERAL';

export type OperationalAction =
  | 'CREATE_WORK_ORDER'
  | 'AUTO_DISPATCH_WORKER'
  | 'SEND_GUEST_MESSAGE'
  | 'PROVISION_GUEST_ACCESS'
  | 'REVOKE_GUEST_ACCESS'
  | 'CREATE_INVOICE'
  | 'CALL_STEVEN'
  | 'CALL_GUEST'
  | 'ORDER_SUPPLIES'
  | 'SEND_PAYMENT'
  | 'ISSUE_REFUND'
  | 'REMOTE_UNLOCK'
  | 'CHANGE_RATE'
  | 'CANCEL_BOOKING';

export interface ActionPolicy {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  autoExecutable: boolean;
  ownerApprovalRequired: boolean;
}

const ACTION_POLICIES: Record<OperationalAction, ActionPolicy> = {
  CREATE_WORK_ORDER: { riskLevel: 'LOW', autoExecutable: true, ownerApprovalRequired: false },
  AUTO_DISPATCH_WORKER: { riskLevel: 'MEDIUM', autoExecutable: true, ownerApprovalRequired: false },
  SEND_GUEST_MESSAGE: { riskLevel: 'MEDIUM', autoExecutable: true, ownerApprovalRequired: false },
  PROVISION_GUEST_ACCESS: { riskLevel: 'HIGH', autoExecutable: true, ownerApprovalRequired: false },
  REVOKE_GUEST_ACCESS: { riskLevel: 'HIGH', autoExecutable: true, ownerApprovalRequired: false },
  CREATE_INVOICE: { riskLevel: 'MEDIUM', autoExecutable: true, ownerApprovalRequired: false },
  CALL_STEVEN: { riskLevel: 'MEDIUM', autoExecutable: true, ownerApprovalRequired: false },
  CALL_GUEST: { riskLevel: 'MEDIUM', autoExecutable: true, ownerApprovalRequired: false },
  ORDER_SUPPLIES: { riskLevel: 'HIGH', autoExecutable: false, ownerApprovalRequired: true },
  SEND_PAYMENT: { riskLevel: 'CRITICAL', autoExecutable: false, ownerApprovalRequired: true },
  ISSUE_REFUND: { riskLevel: 'CRITICAL', autoExecutable: false, ownerApprovalRequired: true },
  REMOTE_UNLOCK: { riskLevel: 'CRITICAL', autoExecutable: false, ownerApprovalRequired: true },
  CHANGE_RATE: { riskLevel: 'HIGH', autoExecutable: false, ownerApprovalRequired: true },
  CANCEL_BOOKING: { riskLevel: 'HIGH', autoExecutable: false, ownerApprovalRequired: true },
};

export function getActionPolicy(action: OperationalAction): ActionPolicy {
  return ACTION_POLICIES[action];
}

export function dashboardForRole(role: string): DashboardRole {
  if (role === 'owner' || role === 'admin') return 'owner';
  if (role === 'worker') return 'worker';
  return 'guest';
}

export function normalizeWorkerType(value: string | null | undefined): WorkerType {
  const normalized = String(value || 'GENERAL').trim().toUpperCase();
  const aliases: Record<string, WorkerType> = {
    CLEANING: 'CLEANER',
    CLEANER: 'CLEANER',
    MAINTENANCE: 'MAINTENANCE',
    PLUMBER: 'CONTRACTOR',
    ELECTRICIAN: 'CONTRACTOR',
    HVAC: 'CONTRACTOR',
    YARD: 'YARD',
    LAWN: 'YARD',
    OUTDOOR: 'YARD',
    POOL: 'POOL',
    CONTRACTOR: 'CONTRACTOR',
    THIRD_PARTY: 'CONTRACTOR',
    MANAGER: 'MANAGER',
    GENERAL: 'GENERAL',
  };
  return aliases[normalized] || 'GENERAL';
}

export function serviceWorkerTypes(serviceType: string): WorkerType[] {
  const type = serviceType.trim().toUpperCase();
  if (['CLEANING', 'TURNOVER', 'LINEN', 'TOWELS', 'INSPECTION'].includes(type)) {
    return ['CLEANER', 'GENERAL'];
  }
  if (['YARD', 'LAWN', 'IRRIGATION', 'LANDSCAPING'].includes(type)) {
    return ['YARD', 'CONTRACTOR', 'GENERAL'];
  }
  if (['POOL', 'HOT_TUB'].includes(type)) {
    return ['POOL', 'CONTRACTOR', 'MAINTENANCE'];
  }
  if (['PLUMBING', 'ELECTRICAL', 'HVAC', 'APPLIANCE'].includes(type)) {
    return ['CONTRACTOR', 'MAINTENANCE'];
  }
  return ['MAINTENANCE', 'CONTRACTOR', 'GENERAL'];
}
