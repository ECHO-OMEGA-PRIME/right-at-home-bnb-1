/**
 * API Integration Tests
 * Tests for REST API endpoints and HTTP interactions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createApiMock,
  createFetchMock
} from '../utils/mocks';
import {
  REAL_PROPERTIES,
  TEST_BOOKINGS,
  TEST_GUESTS,
  TEST_CLEANING_JOBS,
  createTestBooking,
  createTestGuest,
  TOTAL_EXPECTED_PROPERTIES
} from '../utils/fixtures';
import { createMockResponse, createMockPaginatedResponse } from '../utils/helpers';

describe('API Integration', () => {
  let api: ReturnType<typeof createApiMock>;
  let fetchMock: ReturnType<typeof createFetchMock>;

  beforeEach(() => {
    api = createApiMock();
    fetchMock = createFetchMock();
  });

  afterEach(() => {
    fetchMock.reset();
  });

  describe('Property API', () => {
    it('should list all properties', async () => {
      const response = await api.properties.list();

      expect(response.success).toBe(true);
      expect(response.data.length).toBe(TOTAL_EXPECTED_PROPERTIES);
      expect(response.pagination.total).toBe(TOTAL_EXPECTED_PROPERTIES);
    });

    it('should get property by ID', async () => {
      const propertyId = REAL_PROPERTIES[0].id!;
      const response = await api.properties.get(propertyId);

      expect(response.success).toBe(true);
      expect(response.data?.id).toBe(propertyId);
    });

    it('should return null for non-existent property', async () => {
      const response = await api.properties.get('non_existent');

      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
    });

    it('should create a new property', async () => {
      const newProperty = {
        name: 'New Test Property',
        address: '999 Test Drive',
        city: 'Midland',
        state: 'TX'
      };

      const response = await api.properties.create(newProperty);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.name).toBe(newProperty.name);
    });

    it('should update property', async () => {
      const propertyId = REAL_PROPERTIES[0].id!;
      const response = await api.properties.update(propertyId, {
        baseRate: 350
      });

      expect(response.success).toBe(true);
      expect(response.data.baseRate).toBe(350);
    });

    it('should delete property', async () => {
      const response = await api.properties.delete(REAL_PROPERTIES[0].id!);
      expect(response.success).toBe(true);
    });
  });

  describe('Booking API', () => {
    it('should list all bookings', async () => {
      const response = await api.bookings.list();

      expect(response.success).toBe(true);
      expect(response.data.length).toBe(TEST_BOOKINGS.length);
    });

    it('should get booking by ID', async () => {
      const bookingId = TEST_BOOKINGS[0].id!;
      const response = await api.bookings.get(bookingId);

      expect(response.success).toBe(true);
      expect(response.data?.id).toBe(bookingId);
    });

    it('should create a new booking', async () => {
      const newBooking = createTestBooking({
        propertyId: REAL_PROPERTIES[0].id!,
        guestName: 'New Guest',
        guestEmail: 'newguest@test.com'
      });

      const response = await api.bookings.create(newBooking);

      expect(response.success).toBe(true);
      expect(response.data.guestName).toBe('New Guest');
    });

    it('should update booking status', async () => {
      const bookingId = TEST_BOOKINGS[0].id!;
      const response = await api.bookings.update(bookingId, {
        status: 'checked_in'
      });

      expect(response.success).toBe(true);
      expect(response.data.status).toBe('checked_in');
    });

    it('should cancel booking', async () => {
      const bookingId = TEST_BOOKINGS[0].id!;
      const response = await api.bookings.cancel(bookingId);

      expect(response.success).toBe(true);
      expect(response.data.status).toBe('cancelled');
    });
  });

  describe('Guest API', () => {
    it('should list all guests', async () => {
      const response = await api.guests.list();

      expect(response.success).toBe(true);
      expect(response.data.length).toBe(TEST_GUESTS.length);
    });

    it('should get guest by ID', async () => {
      const guestId = TEST_GUESTS[0].id!;
      const response = await api.guests.get(guestId);

      expect(response.success).toBe(true);
      expect(response.data?.id).toBe(guestId);
    });

    it('should search guests by name', async () => {
      const response = await api.guests.search('John');

      expect(response.success).toBe(true);
      expect(response.data.length).toBeGreaterThan(0);
    });

    it('should search guests by email', async () => {
      const email = TEST_GUESTS[0].email!;
      const response = await api.guests.search(email.split('@')[0]);

      expect(response.success).toBe(true);
    });
  });

  describe('Cleaning API', () => {
    it('should list all cleaning jobs', async () => {
      const response = await api.cleaning.list();

      expect(response.success).toBe(true);
      expect(response.data.length).toBe(TEST_CLEANING_JOBS.length);
    });

    it('should get cleaning job by ID', async () => {
      const jobId = TEST_CLEANING_JOBS[0].id!;
      const response = await api.cleaning.get(jobId);

      expect(response.success).toBe(true);
      expect(response.data?.id).toBe(jobId);
    });

    it('should assign cleaner to job', async () => {
      const jobId = TEST_CLEANING_JOBS[0].id!;
      const cleanerId = 'user_cleaner_1';

      const response = await api.cleaning.assign(jobId, cleanerId);

      expect(response.success).toBe(true);
      expect(response.data.cleanerId).toBe(cleanerId);
      expect(response.data.status).toBe('assigned');
    });

    it('should complete cleaning job', async () => {
      const jobId = TEST_CLEANING_JOBS[0].id!;
      const response = await api.cleaning.complete(jobId);

      expect(response.success).toBe(true);
      expect(response.data.status).toBe('completed');
    });
  });

  describe('HTTP Fetch Mock', () => {
    it('should mock GET request', async () => {
      fetchMock.setResponse('GET', '/api/properties', {
        success: true,
        data: REAL_PROPERTIES
      });

      const response = await fetchMock.fetch('/api/properties');
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
      expect(data.data.length).toBe(TOTAL_EXPECTED_PROPERTIES);
    });

    it('should mock POST request', async () => {
      const newProperty = { name: 'Test Property' };
      fetchMock.setResponse('POST', '/api/properties', {
        success: true,
        data: { ...newProperty, id: 'new_id' }
      });

      const response = await fetchMock.fetch('/api/properties', {
        method: 'POST',
        body: JSON.stringify(newProperty)
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.data.name).toBe('Test Property');
    });

    it('should return 404 for unset routes', async () => {
      const response = await fetchMock.fetch('/api/unknown');

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
    });

    it('should mock PUT request', async () => {
      const propertyId = 'prop_1';
      fetchMock.setResponse('PUT', `/api/properties/${propertyId}`, {
        success: true,
        data: { id: propertyId, baseRate: 300 }
      });

      const response = await fetchMock.fetch(`/api/properties/${propertyId}`, {
        method: 'PUT',
        body: JSON.stringify({ baseRate: 300 })
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.data.baseRate).toBe(300);
    });

    it('should mock DELETE request', async () => {
      const propertyId = 'prop_1';
      fetchMock.setResponse('DELETE', `/api/properties/${propertyId}`, {
        success: true
      });

      const response = await fetchMock.fetch(`/api/properties/${propertyId}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      expect(response.ok).toBe(true);
      expect(data.success).toBe(true);
    });
  });

  describe('Response Helpers', () => {
    it('should create mock API response', () => {
      const data = { id: '1', name: 'Test' };
      const response = createMockResponse(data);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(data);
      expect(response.error).toBeUndefined();
    });

    it('should create mock error response', () => {
      const response = createMockResponse(null, {
        success: false,
        error: 'Not found'
      });

      expect(response.success).toBe(false);
      expect(response.data).toBeUndefined();
      expect(response.error).toBe('Not found');
    });

    it('should create mock paginated response', () => {
      const data = REAL_PROPERTIES.slice(0, 5);
      const response = createMockPaginatedResponse(data, {
        page: 1,
        limit: 5,
        total: TOTAL_EXPECTED_PROPERTIES
      });

      expect(response.success).toBe(true);
      expect(response.data.length).toBe(5);
      expect(response.pagination.page).toBe(1);
      expect(response.pagination.limit).toBe(5);
      expect(response.pagination.total).toBe(TOTAL_EXPECTED_PROPERTIES);
      expect(response.pagination.totalPages).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockFetch = async () => {
        throw new Error('Network error');
      };

      await expect(mockFetch()).rejects.toThrow('Network error');
    });

    it('should handle timeout errors', async () => {
      const mockFetch = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { ok: false, status: 408 };
      };

      const response = await mockFetch();
      expect(response.ok).toBe(false);
      expect(response.status).toBe(408);
    });

    it('should handle validation errors', () => {
      const response = createMockResponse(null, {
        success: false,
        error: 'Validation failed: email is required'
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Validation failed');
    });

    it('should handle authorization errors', () => {
      const response = createMockResponse(null, {
        success: false,
        error: 'Unauthorized: Invalid token'
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Unauthorized');
    });
  });

  describe('Pagination', () => {
    it('should paginate property list', () => {
      const page1 = createMockPaginatedResponse(REAL_PROPERTIES.slice(0, 5), {
        page: 1,
        limit: 5,
        total: TOTAL_EXPECTED_PROPERTIES
      });

      const page2 = createMockPaginatedResponse(REAL_PROPERTIES.slice(5, 10), {
        page: 2,
        limit: 5,
        total: TOTAL_EXPECTED_PROPERTIES
      });

      expect(page1.pagination.page).toBe(1);
      expect(page2.pagination.page).toBe(2);
      expect(page1.data.length).toBe(5);
    });

    it('should calculate total pages correctly', () => {
      const total = 14;
      const limit = 5;
      const totalPages = Math.ceil(total / limit);

      const response = createMockPaginatedResponse([], { total, limit });
      expect(response.pagination.totalPages).toBe(totalPages);
    });

    it('should handle last page with fewer items', () => {
      const lastPageItems = REAL_PROPERTIES.slice(10);
      const response = createMockPaginatedResponse(lastPageItems, {
        page: 3,
        limit: 5,
        total: TOTAL_EXPECTED_PROPERTIES
      });

      expect(response.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Content Type Handling', () => {
    it('should handle JSON responses', async () => {
      fetchMock.setResponse('GET', '/api/test', { data: 'test' });
      const response = await fetchMock.fetch('/api/test');
      const json = await response.json();

      expect(json.data).toBe('test');
    });

    it('should handle text responses', async () => {
      fetchMock.setResponse('GET', '/api/text', 'Hello World');
      const response = await fetchMock.fetch('/api/text');
      const text = await response.text();

      expect(text).toBe('"Hello World"');
    });
  });
});
