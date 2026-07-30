from pathlib import Path

path = Path(r"C:\ECHO_OMEGA_PRIME\WEBSITES\right-at-home-bnb\apps\mobile\src\services\database.ts")
text = path.read_text(encoding="utf-8")

anchor = "const DB_NAME = 'rightathome.db';\n"
insert = """const DB_NAME = 'rightathome.db';

function requireValue<T>(value: T | null | undefined, field: string): T {
  if (value === null || value === undefined) {
    throw new Error(`Missing required database field: ${field}`);
  }
  return value;
}

function sqlValue(value: string | number | null | undefined): string | number | null {
  return value ?? null;
}
"""
if anchor not in text:
    raise SystemExit("Database constant anchor not found")
text = text.replace(anchor, insert, 1)

old_property = """    const now = Date.now();
    await this.db.runAsync(
      `INSERT OR REPLACE INTO properties
       (id, name, address, city, state, zip, lat, lng, type, bedrooms, bathrooms,
        maxGuests, amenities, photos, description, baseRate, cleaningFee, status,
        lastSynced, locallyModified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        property.id,
        property.name,
        property.address,
        property.city,
        property.state,
        property.zip,
        property.lat,
        property.lng,
        property.type,
        property.bedrooms,
        property.bathrooms,
        property.maxGuests,
        property.amenities,
        property.photos,
        property.description,
        property.baseRate,
        property.cleaningFee,
        property.status || 'active',
        property.lastSynced || now,
        property.locallyModified || 1,
      ]
    );

    await this.addToSyncQueue('properties', property.id!, 'upsert', property);"""
new_property = """    const now = Date.now();
    const propertyId = requireValue(property.id, 'property.id');
    const propertyName = requireValue(property.name, 'property.name');
    await this.db.runAsync(
      `INSERT OR REPLACE INTO properties
       (id, name, address, city, state, zip, lat, lng, type, bedrooms, bathrooms,
        maxGuests, amenities, photos, description, baseRate, cleaningFee, status,
        lastSynced, locallyModified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        propertyId,
        propertyName,
        sqlValue(property.address),
        sqlValue(property.city),
        sqlValue(property.state),
        sqlValue(property.zip),
        sqlValue(property.lat),
        sqlValue(property.lng),
        sqlValue(property.type),
        sqlValue(property.bedrooms),
        sqlValue(property.bathrooms),
        sqlValue(property.maxGuests),
        sqlValue(property.amenities),
        sqlValue(property.photos),
        sqlValue(property.description),
        sqlValue(property.baseRate),
        sqlValue(property.cleaningFee),
        property.status ?? 'active',
        property.lastSynced ?? now,
        property.locallyModified ?? 1,
      ]
    );

    await this.addToSyncQueue('properties', propertyId, 'upsert', property);"""
if old_property not in text:
    raise SystemExit("Property save block not found")
text = text.replace(old_property, new_property, 1)

old_booking = """    const now = Date.now();
    await this.db.runAsync(
      `INSERT OR REPLACE INTO bookings
       (id, propertyId, guestName, guestEmail, guestPhone, checkIn, checkOut,
        guests, total, status, source, notes, lastSynced, locallyModified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        booking.id,
        booking.propertyId,
        booking.guestName,
        booking.guestEmail,
        booking.guestPhone,
        booking.checkIn,
        booking.checkOut,
        booking.guests,
        booking.total,
        booking.status || 'pending',
        booking.source || 'direct',
        booking.notes,
        booking.lastSynced || now,
        booking.locallyModified || 1,
      ]
    );

    await this.addToSyncQueue('bookings', booking.id!, 'upsert', booking);"""
new_booking = """    const now = Date.now();
    const bookingId = requireValue(booking.id, 'booking.id');
    const propertyId = requireValue(booking.propertyId, 'booking.propertyId');
    const guestName = requireValue(booking.guestName, 'booking.guestName');
    const checkIn = requireValue(booking.checkIn, 'booking.checkIn');
    const checkOut = requireValue(booking.checkOut, 'booking.checkOut');
    await this.db.runAsync(
      `INSERT OR REPLACE INTO bookings
       (id, propertyId, guestName, guestEmail, guestPhone, checkIn, checkOut,
        guests, total, status, source, notes, lastSynced, locallyModified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        bookingId,
        propertyId,
        guestName,
        sqlValue(booking.guestEmail),
        sqlValue(booking.guestPhone),
        checkIn,
        checkOut,
        sqlValue(booking.guests),
        sqlValue(booking.total),
        booking.status ?? 'pending',
        booking.source ?? 'direct',
        sqlValue(booking.notes),
        booking.lastSynced ?? now,
        booking.locallyModified ?? 1,
      ]
    );

    await this.addToSyncQueue('bookings', bookingId, 'upsert', booking);"""
if old_booking not in text:
    raise SystemExit("Booking save block not found")
text = text.replace(old_booking, new_booking, 1)

old_job = """    const now = Date.now();
    await this.db.runAsync(
      `INSERT OR REPLACE INTO cleaning_jobs
       (id, propertyId, bookingId, cleanerId, scheduledDate, scheduledTime,
        status, priority, rate, lastSynced, locallyModified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        job.propertyId,
        job.bookingId,
        job.cleanerId,
        job.scheduledDate,
        job.scheduledTime,
        job.status || 'scheduled',
        job.priority || 'normal',
        job.rate,
        job.lastSynced || now,
        job.locallyModified || 1,
      ]
    );

    await this.addToSyncQueue('cleaning_jobs', job.id!, 'upsert', job);"""
new_job = """    const now = Date.now();
    const jobId = requireValue(job.id, 'job.id');
    const propertyId = requireValue(job.propertyId, 'job.propertyId');
    const scheduledDate = requireValue(job.scheduledDate, 'job.scheduledDate');
    await this.db.runAsync(
      `INSERT OR REPLACE INTO cleaning_jobs
       (id, propertyId, bookingId, cleanerId, scheduledDate, scheduledTime,
        status, priority, rate, lastSynced, locallyModified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        jobId,
        propertyId,
        sqlValue(job.bookingId),
        sqlValue(job.cleanerId),
        scheduledDate,
        sqlValue(job.scheduledTime),
        job.status ?? 'scheduled',
        job.priority ?? 'normal',
        sqlValue(job.rate),
        job.lastSynced ?? now,
        job.locallyModified ?? 1,
      ]
    );

    await this.addToSyncQueue('cleaning_jobs', jobId, 'upsert', job);"""
if old_job not in text:
    raise SystemExit("Cleaning job save block not found")
text = text.replace(old_job, new_job, 1)

path.write_text(text, encoding="utf-8", newline="\n")
print(f"PATCHED={path}")
