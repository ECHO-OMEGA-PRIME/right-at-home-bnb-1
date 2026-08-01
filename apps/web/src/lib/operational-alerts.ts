/**
 * The operational alert store, on Postgres.
 *
 * Replaces the `cleaner_alerts` and `system_alerts` Firestore collections with
 * the `OperationalAlert` table the rest of operations already uses.
 *
 * The reason this is its own module rather than inlined in each monitor is the
 * lookup contract below. Both monitors de-duplicate before alerting, both phone
 * a real human when they alert, and both previously treated "the store did not
 * answer" as "there is no existing alert" -- which turns one outage into a call
 * every 15 minutes, per subject, for as long as it lasts, with no record that
 * any of it happened.
 */

import prisma from '@/lib/prisma';

/**
 * Returned when we could not determine whether an alert already exists.
 *
 * Distinct from `null` ("confirmed: none") on purpose. A caller must treat this
 * as "do not alert" -- staying silent during an outage risks a missed
 * notification, while assuming none exists guarantees a repeated one. Between a
 * possible miss and a certain flood aimed at somebody's phone, silence is the
 * safer failure.
 */
export const ALERT_LOOKUP_UNKNOWN = Symbol('alert-lookup-unknown');

export type AlertLookup<T> = T | null | typeof ALERT_LOOKUP_UNKNOWN;

export interface StoredAlert {
  id: string;
  alertType: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  propertyId: string | null;
  dedupeKey: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  notifiedAt: Date | null;
  resolvedAt: Date | null;
}

const SELECT = {
  id: true,
  alertType: true,
  severity: true,
  status: true,
  title: true,
  message: true,
  propertyId: true,
  dedupeKey: true,
  metadata: true,
  createdAt: true,
  notifiedAt: true,
  resolvedAt: true,
} as const;

/** Alert metadata is a JSON string column; one bad row must not break a sweep. */
function parseMetadata(raw: string | null, alertId: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    console.error('[operational-alerts] malformed metadata JSON', { alertId });
    return {};
  }
}

function toStored(row: {
  id: string;
  alertType: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  propertyId: string | null;
  dedupeKey: string | null;
  metadata: string | null;
  createdAt: Date;
  notifiedAt: Date | null;
  resolvedAt: Date | null;
}): StoredAlert {
  return { ...row, metadata: parseMetadata(row.metadata, row.id) };
}

/** Anything not resolved is still live for de-duplication purposes. */
const OPEN_STATUSES = ['OPEN', 'ACKNOWLEDGED'];

/**
 * Find the most recent unresolved alert for `dedupeKey`.
 *
 * Returns `null` only for a SUCCESSFUL query that matched nothing -- that is a
 * fact. A failure returns ALERT_LOOKUP_UNKNOWN, never null.
 */
export async function findOpenAlert(dedupeKey: string): Promise<AlertLookup<StoredAlert>> {
  try {
    const row = await prisma.operationalAlert.findFirst({
      where: { dedupeKey, status: { in: OPEN_STATUSES } },
      orderBy: { createdAt: 'desc' },
      select: SELECT,
    });
    return row ? toStored(row) : null;
  } catch (error) {
    console.error('[operational-alerts] lookup failed', { dedupeKey, error });
    return ALERT_LOOKUP_UNKNOWN;
  }
}

export interface CreateAlertInput {
  alertType: string;
  title: string;
  message: string;
  severity?: string;
  dedupeKey?: string;
  propertyId?: string | null;
  bookingId?: string | null;
  assignedToUserId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Record a new alert.
 *
 * Deliberately THROWS when the write fails rather than returning a
 * phantom object. The Firestore version returned an unsaved alert when the
 * store was unavailable, so callers went on to phone somebody about an alert
 * that existed nowhere -- and the next run, finding nothing, phoned again.
 */
export async function createAlert(input: CreateAlertInput): Promise<StoredAlert> {
  const row = await prisma.operationalAlert.create({
    data: {
      alertType: input.alertType,
      title: input.title,
      message: input.message,
      severity: input.severity ?? 'NORMAL',
      status: 'OPEN',
      dedupeKey: input.dedupeKey ?? null,
      propertyId: input.propertyId ?? null,
      bookingId: input.bookingId ?? null,
      assignedToUserId: input.assignedToUserId ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
    select: SELECT,
  });
  return toStored(row);
}

/** Merge additional detail into an alert's metadata, preserving what is there. */
export async function mergeAlertMetadata(
  alertId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const existing = await prisma.operationalAlert.findUnique({
    where: { id: alertId },
    select: { metadata: true },
  });
  if (!existing) return;

  await prisma.operationalAlert.update({
    where: { id: alertId },
    data: { metadata: JSON.stringify({ ...parseMetadata(existing.metadata, alertId), ...patch }) },
  });
}

/** Raise an alert's severity and record why, without losing prior metadata. */
export async function escalateAlert(
  alertId: string,
  severity: string,
  patch: Record<string, unknown> = {},
): Promise<void> {
  await prisma.operationalAlert.update({ where: { id: alertId }, data: { severity } });
  await mergeAlertMetadata(alertId, { ...patch, escalatedAt: new Date().toISOString() });
}

export async function markNotified(alertId: string, patch: Record<string, unknown> = {}) {
  await prisma.operationalAlert.update({
    where: { id: alertId },
    data: { notifiedAt: new Date() },
  });
  if (Object.keys(patch).length) await mergeAlertMetadata(alertId, patch);
}

/**
 * Acknowledge an alert without resolving it.
 *
 * ACKNOWLEDGED still counts as open for de-duplication (see OPEN_STATUSES):
 * somebody has SEEN the problem, which is not the same as the problem having
 * gone away. Treating it as closed would let the next sweep raise a fresh alert
 * for a condition that is still live and already being worked.
 */
export async function acknowledgeAlert(
  alertId: string,
  acknowledgedBy: string,
): Promise<boolean> {
  try {
    await prisma.operationalAlert.update({
      where: { id: alertId },
      data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
    });
    await mergeAlertMetadata(alertId, { acknowledgedBy });
    return true;
  } catch (error) {
    console.error('[operational-alerts] acknowledge failed', { alertId, error });
    return false;
  }
}

export async function resolveAlert(
  alertId: string,
  resolvedBy: string,
  notes?: string,
): Promise<boolean> {
  try {
    await prisma.operationalAlert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy,
      },
    });
    if (notes) await mergeAlertMetadata(alertId, { resolutionNotes: notes });
    return true;
  } catch (error) {
    console.error('[operational-alerts] resolve failed', { alertId, error });
    return false;
  }
}

/**
 * Every unresolved alert of a kind.
 *
 * Lets a store failure THROW rather than returning []. An empty array rendered
 * during an outage reads as "nothing is wrong", which is the most dangerous
 * thing an alerts screen can say.
 */
export async function listOpenAlerts(alertType?: string): Promise<StoredAlert[]> {
  const rows = await prisma.operationalAlert.findMany({
    where: {
      status: { in: OPEN_STATUSES },
      ...(alertType ? { alertType } : {}),
    },
    orderBy: { createdAt: 'desc' },
    select: SELECT,
  });
  return rows.map(toStored);
}
