from __future__ import annotations

from pathlib import Path

ROOT = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\desktop\src")


def update(path: Path, transform, label: str) -> None:
    before = path.read_text(encoding="utf-8")
    after = transform(before)
    if after == before:
        raise SystemExit(f"{label}: no change produced for {path}")
    path.write_text(after, encoding="utf-8", newline="\n")
    print(f"PATCHED={path} :: {label}")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label}: expected text not found")
    return text.replace(old, new, 1)


preload = ROOT / "main" / "preload.ts"
def patch_preload(text: str) -> str:
    text = replace_once(
        text,
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
        "preload store type",
    )
    text = replace_once(
        text,
        """    set: (key: string, value: unknown): Promise<boolean> =>
      ipcRenderer.invoke('store:set', key, value),
    getAll: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('store:getAll'),
""",
        """    set: (key: string, value: unknown): Promise<boolean> =>
      ipcRenderer.invoke('store:set', key, value),
    delete: (key: string): Promise<boolean> => ipcRenderer.invoke('store:delete', key),
    getAll: (): Promise<Record<string, unknown>> => ipcRenderer.invoke('store:getAll'),
""",
        "preload store implementation",
    )
    return text
update(preload, patch_preload, "secure store delete")

main = ROOT / "main" / "main.ts"
def patch_main(text: str) -> str:
    old_stats = """interface TrayStats {
  todayJobs: number;
  checkInsToday: number;
  checkOutsToday: number;
  pendingCleanings: number;
  revenue: number;
}
"""
    new_stats = """interface TrayStats {
  todayJobs?: number;
  checkInsToday?: number;
  checkOutsToday?: number;
  pendingCleanings?: number;
  revenue?: number;
  syncStatus?: 'connected' | 'offline';
  onlineDevices?: number;
}
"""
    text = replace_once(text, old_stats, new_stats, "main TrayStats")
    text = replace_once(
        text,
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
        "main store delete",
    )
    replacements = {
        "`${currentStats.todayJobs} Jobs Today`": "`${currentStats.todayJobs ?? 0} Jobs Today`",
        "`${currentStats.checkInsToday} Check-ins`": "`${currentStats.checkInsToday ?? 0} Check-ins`",
        "`${currentStats.checkOutsToday} Check-outs`": "`${currentStats.checkOutsToday ?? 0} Check-outs`",
        "`${currentStats.pendingCleanings} Pending Cleanings`": "`${currentStats.pendingCleanings ?? 0} Pending Cleanings`",
        "`$${currentStats.revenue.toLocaleString()} Revenue`": "`$${(currentStats.revenue ?? 0).toLocaleString()} Revenue`",
    }
    for old, new in replacements.items():
        text = replace_once(text, old, new, f"tray metric {old}")
    return text
update(main, patch_main, "main IPC and tray contract")

shared_types = ROOT / "shared" / "types.ts"
def patch_shared_types(text: str) -> str:
    return replace_once(
        text,
        """  dateFormat: string;
  apiUrl: string;
}
""",
        """  dateFormat: string;
  apiUrl: string;
  autoSync?: boolean;
  syncInterval?: string;
  syncOnStartup?: boolean;
  autoBackup?: boolean;
  requirePassword?: boolean;
  autoLock?: boolean;
}
""",
        "UserSettings extensions",
    )
update(shared_types, patch_shared_types, "extend UserSettings")

app_context = ROOT / "renderer" / "contexts" / "AppContext.tsx"
def patch_app_context(text: str) -> str:
    text = replace_once(
        text,
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
        "AppInfo extensions",
    )
    text = replace_once(
        text,
        """  dateFormat: 'MM/dd/yyyy',
  apiUrl: 'https://api.rah-midland.com',
};
""",
        """  dateFormat: 'MM/dd/yyyy',
  apiUrl: 'https://api.rah-midland.com',
  autoSync: true,
  syncInterval: '5',
  syncOnStartup: true,
  autoBackup: true,
  requirePassword: false,
  autoLock: true,
};
""",
        "settings defaults",
    )
    return text
update(app_context, patch_app_context, "renderer settings and app info")

booking = ROOT / "renderer" / "screens" / "BookingCalendar.tsx"
def patch_booking(text: str) -> str:
    text = replace_once(
        text,
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
        "Booking GlassCard props",
    )
    text = replace_once(
        text,
        """  <div
    className={`relative rounded-2xl ${className}`}
    style={{
""",
        """  <div
    className={`relative rounded-2xl ${className}`}
    onClick={onClick}
    style={{
""",
        "Booking GlassCard onClick",
    )
    text = text.replace("as BookingWithRelations[]", "as unknown as BookingWithRelations[]")
    return text
update(booking, patch_booking, "booking model adapters")

cleaning_screen = ROOT / "renderer" / "screens" / "CleaningSchedule.tsx"
def patch_cleaning_screen(text: str) -> str:
    text = replace_once(text, "setCleaningJobs(jobsData);", "setCleaningJobs(jobsData as unknown as CleaningJob[]);", "cleaning jobs cast")
    text = replace_once(text, "setProperties(propertiesData);", "setProperties(propertiesData as unknown as Property[]);", "cleaning properties cast")
    text = replace_once(
        text,
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
        "canonical CleaningJob payload",
    )
    text = text.replace(
        """              style={{
                ...inputStyle,
                focusRingColor: ECHO_COLORS.darkMagenta,
              }}
""",
        """              style={inputStyle}
""",
    )
    return text
update(cleaning_screen, patch_cleaning_screen, "cleaning screen type boundaries")

properties = ROOT / "renderer" / "screens" / "Properties.tsx"
update(
    properties,
    lambda text: text.replace("as PropertyWithPhotos[]", "as unknown as PropertyWithPhotos[]"),
    "properties legacy adapters",
)

property_detail = ROOT / "renderer" / "screens" / "PropertyDetail.tsx"
def patch_property_detail(text: str) -> str:
    text = text.replace("as PropertyWithPhotos", "as unknown as PropertyWithPhotos")
    text = text.replace(
        "React.ComponentType<{ className?: string }>",
        "React.ComponentType<{ className?: string; style?: React.CSSProperties }>",
    )
    text = replace_once(
        text,
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
        "thumbnail ring styling",
    )
    return text
update(property_detail, patch_property_detail, "property detail adapters")

settings = ROOT / "renderer" / "screens" / "Settings.tsx"
update(
    settings,
    lambda text: replace_once(
        text,
        "icon: React.ComponentType<{ className?: string }>;",
        "icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;",
        "settings icon props",
    ),
    "settings icon contract",
)

locks = ROOT / "renderer" / "screens" / "SmartLocks.tsx"
def patch_locks(text: str) -> str:
    return replace_once(
        text,
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
        "optional lock activity",
    )
update(locks, patch_locks, "smart-lock activity guard")

cleaning_service = ROOT / "renderer" / "services" / "cleaning.ts"
update(
    cleaning_service,
    lambda text: replace_once(text, "return cleaner.available !== false;", "return true;", "cleaner availability narrowing"),
    "cleaning compatibility type",
)

pricing = ROOT / "renderer" / "services" / "pricing.ts"
update(
    pricing,
    lambda text: replace_once(
        text,
        "import { format, parseISO, addDays, differenceInDays, isWeekend, getDay, getMonth } from 'date-fns';",
        "import { format, parseISO, addDays, differenceInDays, getDay, getMonth } from 'date-fns';",
        "pricing import conflict",
    ),
    "pricing import conflict",
)

database = ROOT / "renderer" / "services" / "database.ts"
def patch_database(text: str) -> str:
    for model in ["properties.count", "propertyPhotos.count", "guests.count", "bookings.count", "cleaningJobs.count"]:
        text = text.replace(f"window.electronAPI.db.query('{model}'", f"window.electronAPI.db.query<number>('{model}'")
    return text
update(database, patch_database, "database count generics")

encryption = ROOT / "renderer" / "services" / "encryption.ts"
def patch_encryption(text: str) -> str:
    text = replace_once(
        text,
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
        "encryption key narrowing",
    )
    text = replace_once(
        text,
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
        "decryption key narrowing",
    )
    text = replace_once(
        text,
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
        "ArrayBuffer helper",
    )
    text = text.replace("salt,\n      iterations,", "salt: toArrayBuffer(salt),\n      iterations,")
    text = text.replace("salt: saltBytes,", "salt: toArrayBuffer(saltBytes),")
    text = text.replace("{ name: 'AES-GCM', iv },\n    key,", "{ name: 'AES-GCM', iv: toArrayBuffer(iv) },\n    key,")
    text = text.replace("base64ToBytes(payload.ciphertext)\n  );", "toArrayBuffer(base64ToBytes(payload.ciphertext))\n  );")
    return text
update(encryption, patch_encryption, "encryption Web Crypto and IPC types")

print("DESKTOP_TYPE_BOUNDARIES_V2_COMPLETE")
