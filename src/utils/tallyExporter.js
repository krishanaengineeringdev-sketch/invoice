import * as XLSX from 'xlsx';

/**
 * Formats date string into DD-MM-YYYY format expected by Tally
 */
export const formatTallyDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateStr;
  }
};

/**
 * Transforms detailed invoices list with items into Tally Excel format and downloads file
 * @param {Array} invoicesData List of fetched invoices with joined clients & invoice_items
 */
export const exportInvoicesToTally = (invoicesData) => {
  if (!invoicesData || invoicesData.length === 0) {
    throw new Error('No invoice data available to export.');
  }

  const rows = [];

  invoicesData.forEach((inv) => {
    const invNo = inv.invoice_no || inv.id || '';
    const dateStr = formatTallyDate(inv.invoice_date || inv.created_at);
    const partyName = inv.clients?.name || inv.client_name || inv.buyer_name || 'Cash Sales';
    const partyGstin = inv.clients?.gstin || inv.client_gstin || 'URP';
    const totalAmt = parseFloat(inv.total_amount) || 0;
    const items = inv.invoice_items || [];

    if (items.length > 0) {
      items.forEach((item) => {
        const qty = parseFloat(item.quantity) || 0;
        const rate = parseFloat(item.rate) || 0;
        const disc = parseFloat(item.discount) || 0;
        const amt = item.amount !== undefined && item.amount !== null && Number(item.amount) !== 0
          ? parseFloat(item.amount)
          : qty * rate * (1 - disc / 100);

        const itemCgst = parseFloat((amt * 0.09).toFixed(2));
        const itemSgst = parseFloat((amt * 0.09).toFixed(2));

        rows.push({
          'Voucher Type': 'Sales',
          'Invoice No.': invNo,
          'Date': dateStr,
          'Party Name': partyName,
          'Party GSTIN': partyGstin,
          'Item Name': item.description || item.name || 'Material Item',
          'HSN/SAC': item.hsn_sac || item.hsn || '',
          'Quantity': qty,
          'Rate': rate,
          'Discount %': disc,
          'Amount': parseFloat(amt.toFixed(2)),
          'CGST Amount': itemCgst,
          'SGST Amount': itemSgst,
          'Total Amount': parseFloat(totalAmt.toFixed(2)),
        });
      });
    } else {
      const subtotal = parseFloat(inv.taxable_subtotal) || parseFloat(inv.subtotal) || (totalAmt / 1.18);
      const cgst = parseFloat(inv.cgst_amount) || parseFloat((subtotal * 0.09).toFixed(2));
      const sgst = parseFloat(inv.sgst_amount) || parseFloat((subtotal * 0.09).toFixed(2));

      rows.push({
        'Voucher Type': 'Sales',
        'Invoice No.': invNo,
        'Date': dateStr,
        'Party Name': partyName,
        'Party GSTIN': partyGstin,
        'Item Name': 'General Material Supply',
        'HSN/SAC': '',
        'Quantity': 1,
        'Rate': parseFloat(subtotal.toFixed(2)),
        'Discount %': 0,
        'Amount': parseFloat(subtotal.toFixed(2)),
        'CGST Amount': cgst,
        'SGST Amount': sgst,
        'Total Amount': parseFloat(totalAmt.toFixed(2)),
      });
    }
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Invoices');

  const fileName = 'Krishna_Engineering_Invoices_' + new Date().toISOString().split('T')[0] + '.xlsx';
  XLSX.writeFile(wb, fileName);
};
