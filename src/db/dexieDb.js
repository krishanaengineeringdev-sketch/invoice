import Dexie from 'dexie';

/**
 * Dexie local database for Krishna Engineering GST Application.
 * Synchronizes delivery challans and provides offline-capable storage.
 */
export const db = new Dexie('KrishnaEngineeringGST');

db.version(1).stores({
  delivery_challans: 'id, challan_no, challan_date, client_id, status, purpose, total_manual, total_text, created_at',
  delivery_challan_items: 'id, challan_id, description, hsn_sac, quantity, per, remarks'
});

/**
 * Sync a delivery challan record and its items into Dexie
 */
export async function syncChallanToDexie(challan, items = []) {
  try {
    if (!challan || !challan.id) return;

    await db.transaction('rw', [db.delivery_challans, db.delivery_challan_items], async () => {
      await db.delivery_challans.put({
        id: challan.id,
        challan_no: challan.challan_no,
        challan_date: challan.challan_date,
        client_id: challan.client_id,
        buyer_order_no: challan.buyer_order_no,
        dispatch_through: challan.dispatch_through,
        destination: challan.destination,
        vehicle_no: challan.vehicle_no,
        purpose: challan.purpose,
        status: challan.status,
        total_manual: Boolean(challan.total_manual),
        total_text: challan.total_text || null,
        created_at: challan.created_at || new Date().toISOString()
      });

      if (items && items.length > 0) {
        // Clear previous items for this challan
        await db.delivery_challan_items.where('challan_id').equals(challan.id).delete();
        // Insert current items
        const itemsToPut = items.map((it, idx) => ({
          id: it.id || `${challan.id}_${idx}`,
          challan_id: challan.id,
          description: it.description,
          hsn_sac: it.hsn_sac,
          quantity: it.quantity,
          per: it.per,
          remarks: it.remarks
        }));
        await db.delivery_challan_items.bulkPut(itemsToPut);
      }
    });
  } catch (err) {
    console.warn('Dexie syncChallanToDexie:', err);
  }
}

/**
 * Retrieve delivery challan record with items from Dexie
 */
export async function getChallanFromDexie(id) {
  try {
    if (!id) return null;
    const challan = await db.delivery_challans.get(id);
    if (!challan) return null;
    const items = await db.delivery_challan_items.where('challan_id').equals(id).toArray();
    return { ...challan, delivery_challan_items: items };
  } catch (err) {
    console.warn('Dexie getChallanFromDexie:', err);
    return null;
  }
}

/**
 * Retrieve all delivery challans from Dexie
 */
export async function getAllChallansFromDexie() {
  try {
    return await db.delivery_challans.toArray();
  } catch (err) {
    console.warn('Dexie getAllChallansFromDexie:', err);
    return [];
  }
}

