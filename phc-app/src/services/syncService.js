import { getAllSyncItems, removeSyncItem, updateSyncItem } from '../db/indexedDB';

const API_BASE_URL = 'http://localhost:8000/api/v1';

export const syncQueue = async () => {
  if (!navigator.onLine) return;

  const items = await getAllSyncItems();
  if (items.length === 0) return;

  console.log(`Attempting to sync ${items.length} items...`);
  const pausedEndpoints = new Set();

  for (const item of items) {
    try {
      let endpoint = '';
      let payload = {};

      if (item.update_type === 'Medicine') {
        endpoint = `${API_BASE_URL}/inventory/update`;
        payload = {
          phc_id: item.phc_id,
          medicine_name: item.medicine_name,
          quantity: item.quantity,
          timestamp: item.timestamp,
        };
      } else if (item.update_type === 'Beds') {
        // Flagging schema mismatch: This endpoint doesn't exist in API_CONTRACT.md
        endpoint = `${API_BASE_URL}/facility/beds`;
        payload = {
          phc_id: item.phc_id,
          available_beds: item.available_beds,
          timestamp: item.timestamp,
        };
      } else if (item.update_type === 'Attendance') {
        // Flagging schema mismatch: This endpoint doesn't exist in API_CONTRACT.md
        endpoint = `${API_BASE_URL}/facility/attendance`;
        payload = {
          phc_id: item.phc_id,
          doctors_present: item.doctors_present,
          timestamp: item.timestamp,
        };
      } else {
        // Fallback for older items before update_type was added
        endpoint = `${API_BASE_URL}/inventory/update`;
        payload = {
          phc_id: item.phc_id,
          medicine_name: item.medicine_name,
          quantity: Number(item.quantity),
          timestamp: item.timestamp,
        };
      }

      if (pausedEndpoints.has(endpoint)) {
        console.log(`Skipping item ${item.id} because endpoint ${endpoint} is paused.`);
        continue;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await removeSyncItem(item.id);
        console.log(`Processed item ${item.id} successfully (Status: ${response.status}).`);
      } else if (response.status === 404) {
        // Medicine name mismatch or endpoint not found — stale data, discard
        console.warn(`Discarding stale item ${item.id} (404): medicine or endpoint not found. Removing from queue.`);
        await removeSyncItem(item.id);
      } else {
        console.error(`Failed to sync item ${item.id} (Status: ${response.status}):`, await response.text());
        item.status = 'pending_retry';
        await updateSyncItem(item);
        // Continue to next item instead of blocking the queue
      }
    } catch (error) {
      console.error(`Network error while syncing item ${item.id}:`, error);
      item.status = 'pending_retry';
      await updateSyncItem(item);
      // Stop syncing on network error to retain order and try again later
      break;
    }
  }
};
