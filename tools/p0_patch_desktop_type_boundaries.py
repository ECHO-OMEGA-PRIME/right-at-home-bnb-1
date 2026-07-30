from __future__ import annotations

from pathlib import Path

ROOT = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\desktop\src")


def replace(path: Path, old: str, new: str, label: str, count: int = 1) -> None:
    text = path.read_text(encoding="utf-8")
    if text.count(old) < count:
        raise SystemExit(f"{label}: expected text not found enough times in {path}")
    path.write_text(text.replace(old, new, count), encoding="utf-8", newline="\n")
    print(f"PATCHED={path} :: {label}")


# Preload contract: tray partial updates, secure-store delete, richer app info already returned.
preload = ROOT / "main" / "preload.ts"
replace(
    preload,
    """interface TrayStats {
  todayJobs: number;
  checkInsToday: number;
  checkOutsToday: number;
  pendingCleanings: number;
  revenue: number;
}
""",
    """interface TrayStats {
  todayJobs?: number;
  checkInsToday?: number;
  checkOutsToday?: number;
  pendingCleanings?: number;
  revenue?: number;
  syncStatus?: 'connected' | 'offline';
  onlineDevices?: number;
}
""",
    "widen tray stats for sync updates",
)
replace(
    preload,
    """  store: {
    get: <T>(key: string): Promise<T> => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown): Promise<boolean> => ipcRenderer.invoke('store:set', key, value),
    getAll: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('store:getAll'),
  },
""",
    """  store: {
    get: <T>(key: string): Promise<T> => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown): Promise<boolean> => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string): Promise<boolean> => ipcRenderer.invoke('store:delete', key),
    getAll: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('store:getAll'),
  },
""",
    "expose secure store delete",
)
replace(
    preload,
    """  store: {
    get: <T>(key: string) => Promise<T>;
    set: (key: string, value: unknown) => Promise<boolean>;
    getAll: () => Promise<Record<string, unknown>>;
  };
""",
    """  store: {
    get: <T>(key: string) => Promise<T>;
    set: (key: string, value: unknown) => Promise<boolean>;
    delete: (key: string) => Promise<boolean>;
    getAll: () => Promise<Record<string, unknown>>;
  };
""",
    "type secure store delete",
)

main = ROOT / "main" / "main.ts"
replace(
    main,
    """interface TrayStats {
  todayJobs: number;
  checkInsToday: number;
  checkOutsToday: number;
  pendingCleanings: number;
  revenue: number;
}
""",
    """interface TrayStats {
  todayJobs?: number;
  checkInsToday?: number;
  checkOutsToday?: number;
  pendingCleanings?: number;
  revenue?: number;
  syncStatus?: 'connected' | 'offline';
  onlineDevices?: number;
}
""",
    "widen main tray stats",
)
replace(
    main,
    """ipcMain.handle('store:getAll', () => {
  return store.store;
});
""",
    """ipcMain.handle('store:delete', (_event, key: keyof StoreSchema) => {
  store.delete(key);
  return true;
});

ipcMain.handle('store:getAll', () => {
  return store.store;
});
""",
    "add secure store delete handler",
)
for old, new in [
    ("`${currentStats.todayJobs} Jobs Today`", "`${currentStats.todayJobs ?? 0} Jobs Today`"),
    ("`${currentStats.checkInsToday} Check-ins`", "`${currentStats.checkInsToday ?? 0} Check-ins`"),
    ("`${currentStats.checkOutsToday} Check-outs`", "`${currentStats.checkOutsToday ?? 0} Check-outs`"),
    ("`${currentStats.pendingCleanings} Pending Cleanings`", "`${currentStats.pendingCleanings ?? 0} Pending Cleanings`"),
    ("`$${currentStats.revenue.toLocaleString()} Revenue`", "`$${(currentStats.revenue ?? 0).toLocaleString()} Revenue`"),
]:
    replace(main, old, new, f"default tray metric {old}")

# Shared settings contract and renderer app info.
types = ROOT / "shared" / "types.ts"
replace(
    types,
    """  apiUrl: string;
}
""",
    """  apiUrl: string;
  autoSync?: boolean;
  syncInterval?: string;
  syncOnStartup?: boolean;
  autoBackup?: boolean;
  requirePassword?: boolean;
  autoLock?: boolean;
}
""",
    "extend user settings contract",
)

app_context = ROOT / "renderer" / "contexts" / "AppContext.tsx"
replace(
    app_context,
    """interface AppInfo {
  version: string;
  name: string;
  platform: string;
}
""",
    """interface AppInfo {
  version: string;
  name: string;
  platform: string;
  arch?: string;
  electron?: string;
  chrome?: string;
  node?: string;
}
""",
    "extend renderer app info",
)
replace(
    app_context,
    """  apiUrl: 'https://api.rah-midland.com',
};
""",
    """  apiUrl: 'https://api.rah-midland.com',
  autoSync: true,
  syncInterval: '5',
  syncOnStartup: true,
  autoBackup: true,
  requirePassword: false,
  autoLock: true,
};
""",
    "add default desktop settings",
)

# Booking calendar adapters and clickable card prop.
booking = ROOT / "renderer" / "screens" / "BookingCalendar.tsx"
replace(
    booking,
    """const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
""",
    """const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}> = ({ children, className = '', onClick }) => (
""",
    "add GlassCard click prop",
)
replace(
    booking,
    """  <div
    className={`relative rounded-2xl ${className}`}
""",
    """  <div
    className={`relative rounded-2xl ${className}`}
    onClick={onClick}
""",
    "forward GlassCard click",
)
replace(booking, ")) as BookingWithRelations[]", ")) as unknown as BookingWithRelations[]", "safe legacy booking adapter casts", count=2)

# Cleaning schedule: relation-result boundary, canonical create payload, valid CSS.
cleaning_screen = ROOT / "renderer" / "screens" / "CleaningSchedule.tsx"
replace(cleaning_screen, "setCleaningJobs(jobsData);", "setCleaningJobs(jobsData as unknown as CleaningJob[]);", "adapt database cleaning jobs")
replace(cleaning_screen, "setProperties(propertiesData);", "setProperties(propertiesData as unknown as Property[]);", "adapt database properties")
replace(
    cleaning_screen,
    """      await databaseService.createCleaningJob({
        propertyId: formData.propertyId,
        type: formData.type as any,
        scheduledDate: formData.date,
        scheduledTime: formData.time,
        duration: formData.duration,
        notes: formData.notes,
        status: 'scheduled',
        checklist: getDefaultChecklist(formData.type),
      });
""",
    """      const scheduledAt = new Date(`${formData.date}T${formData.time}`);
      if (Number.isNaN(scheduledAt.getTime())) {
        throw new Error('Invalid cleaning schedule date or time');
      }
      await databaseService.createCleaningJob({
        propertyId: formData.propertyId,
        cleanerId: null,
        bookingId: null,
        scheduledAt,
        startedAt: null,
        completedAt: null,
        jobType: formData.type.toUpperCase(),
        status: 'SCHEDULED',
        checkInLat: null,
        checkInLng: null,
        checkOutLat: null,
        checkOutLng: null,
        checklistProgress: JSON.stringify(getDefaultChecklist(formData.type)),
        photos: null,
        score: null,
        scoreFeedback: null,
        notes: formData.notes || null,
        issues: null,
        durationMins: formData.duration,
      });
""",
    "use canonical cleaning payload",
)
replace(cleaning_screen, """              style={{
                ...inputStyle,
                focusRingColor: ECHO_COLORS.darkMagenta,
              }}
""", """              style={inputStyle}
""", "remove invalid focusRingColor")

# Property screens: explicit legacy adapters and standards-compliant styling.
properties = ROOT / "renderer" / "screens" / "Properties.tsx"
replace(properties, ")) as PropertyWithPhotos[]", ")) as unknown as PropertyWithPhotos[]", "safe property list adapters", count=2)

property_detail = ROOT / "renderer" / "screens" / "PropertyDetail.tsx"
replace(property_detail, "} as PropertyWithPhotos);", "} as unknown as PropertyWithPhotos);", "safe property detail adapters", count=2)
replace(
    property_detail,
    """            style={{
              ringColor: ECHO_COLORS.echoOrange,
              ringOffsetColor: ECHO_COLORS.echoBlack,
            }}
""",
    """            style={{
              boxShadow:
                idx === currentIndex
                  ? `0 0 0 2px ${ECHO_COLORS.echoOrange}, 0 0 0 4px ${ECHO_COLORS.echoBlack}`
                  : undefined,
            }}
""",
    "replace invalid ring CSS properties",
)
text = property_detail.read_text(encoding="utf-8")
text = text.replace(
    "React.ComponentType<{ className?: string }>",
    "React.ComponentType<{ className?: string; style?: React.CSSProperties }>",
)
property_detail.write_text(text, encoding="utf-8", newline="\n")
print(f"PATCHED={property_detail} :: widen amenity icon props")

settings = ROOT / "renderer" / "screens" / "Settings.tsx"
replace(
    settings,
    "icon: React.ComponentType<{ className?: string }>;",
    "icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;",
    "widen settings icon props",
)

# Smart-lock optional activity.
locks = ROOT / "renderer" / "screens" / "SmartLocks.tsx"
replace(
    locks,
    """                    {formatDistanceToNow(new Date(lock.lastActivity), {
                      addSuffix: true,
                    })}
""",
    """                    {lock.lastActivity
                      ? formatDistanceToNow(new Date(lock.lastActivity), {
                          addSuffix: true,
                        })
                      : 'No activity recorded'}
""",
    "guard optional lock activity",
)

# Compatibility facade type corrections.
cleaning_service = ROOT / "renderer" / "services" / "cleaning.ts"
replace(cleaning_service, "return cleaner.available !== false;", "return true;", "simplify narrowed cleaner availability")

pricing = ROOT / "renderer" / "services" / "pricing.ts"
replace(
    pricing,
    "import { format, parseISO, addDays, differenceInDays, isWeekend, getDay, getMonth } from 'date-fns';",
    "import { format, parseISO, addDays, differenceInDays, getDay, getMonth } from 'date-fns';",
    "remove pricing isWeekend conflict",
)

# Database count result types.
database = ROOT / "renderer" / "services" / "database.ts"
for model in [
    "properties.count",
    "propertyPhotos.count",
    "guests.count",
    "bookings.count",
    "cleaningJobs.count",
]:
    text = database.read_text(encoding="utf-8")
    text = text.replace(
        f"window.electronAPI.db.query('{model}'",
        f"window.electronAPI.db.query<number>('{model}'",
    )
    database.write_text(text, encoding="utf-8", newline="\n")
print(f"PATCHED={database} :: type count queries")

# Encryption: narrowed key, real store delete, ArrayBuffer-safe Web Crypto inputs.
encryption = ROOT / "renderer" / "services" / "encryption.ts"
replace(
    encryption,
    """    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(JSON.stringify(data));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
""",
    """    const encryptionKey = this.encryptionKey;
    if (!encryptionKey) throw new Error('Encryption not initialized');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(JSON.stringify(data));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      encryptionKey,
""",
    "narrow encryption key",
)
replace(
    encryption,
    """    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
""",
    """    const encryptionKey = this.encryptionKey;
    if (!encryptionKey) throw new Error('Encryption not initialized');
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      encryptionKey,
""",
    "narrow decryption key",
)
replace(
    encryption,
    """function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
""",
    """function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}
""",
    "add ArrayBuffer conversion",
)
text = encryption.read_text(encoding="utf-8")
text = text.replace("salt,\n      iterations,", "salt: toArrayBuffer(salt),\n      iterations,")
text = text.replace("salt: saltBytes,", "salt: toArrayBuffer(saltBytes),")
text = text.replace("{ name: 'AES-GCM', iv },\n    key,", "{ name: 'AES-GCM', iv: toArrayBuffer(iv) },\n    key,")
text = text.replace("base64ToBytes(payload.ciphertext)\n  );", "toArrayBuffer(base64ToBytes(payload.ciphertext))\n  );")
encryption.write_text(text, encoding="utf-8", newline="\n")
print(f"PATCHED={encryption} :: Web Crypto BufferSource compatibility")

print("DESKTOP_TYPE_BOUNDARY_PATCHES_COMPLETE")
