import React, { useState, useEffect } from 'react';
import './InvoiceTemplate.css';
import { numberToWords } from '../utils/numberToWords';
import { supabase } from '../lib/supabaseClient';

export function formatDateDMY(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr === 'string') {
    const trimmed = dateStr.trim();
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
      return trimmed;
    }
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}.${match[2]}.${match[1]}`;
    }
  }
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  } catch {
    return String(dateStr);
  }
}

export default function InvoiceTemplate({ data = {}, type = 'invoice' }) {
  const isQuotation = type === 'quotation';
  const isChallan = type === 'challan';

  const [companyEmail, setCompanyEmail] = useState(
    data.company_email || data.company_profile?.email || 'krishnaengg1966@gmail.com'
  );

  useEffect(() => {
    let isMounted = true;

    if (data.company_email || data.company_profile?.email) {
      setCompanyEmail(data.company_email || data.company_profile?.email);
      return;
    }

    async function fetchCompanyEmail() {
      try {
        const { data: profile, error } = await supabase
          .from('company_profile')
          .select('email')
          .limit(1)
          .maybeSingle();

        if (!error && profile?.email && isMounted) {
          setCompanyEmail(profile.email);
        }
      } catch (err) {
        console.warn('Could not load company_profile email:', err);
      }
    }

    fetchCompanyEmail();

    return () => {
      isMounted = false;
    };
  }, [data.company_email, data.company_profile?.email]);

  // Buyer client resolution (supports both object or array relation)
  const client = Array.isArray(data.clients) ? data.clients[0] : (data.clients || {});
  const buyerName = client.name || data.client_name || '';
  const buyerAddress = client.address || data.client_address || '';
  const buyerGstin = client.gstin || data.client_gstin || '';

  // Line items (supports invoice_items, quotation_items, or delivery_challan_items)
  const lineItems = data.delivery_challan_items || data.invoice_items || data.quotation_items || data.items || [];
  const isFewItems = lineItems.length <= 2;

  const taxableSubtotal = lineItems.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const disc = parseFloat(item.discount) || 0;
    const amt = item.amount !== undefined && item.amount !== null && Number(item.amount) !== 0 
      ? Number(item.amount) 
      : qty * rate * (1 - disc / 100);
    return sum + amt;
  }, 0);

  const cgstAmt = data.cgst_amount !== undefined && data.cgst_amount !== null
    ? Number(data.cgst_amount)
    : taxableSubtotal * 0.09;

  const sgstAmt = data.sgst_amount !== undefined && data.sgst_amount !== null
    ? Number(data.sgst_amount)
    : taxableSubtotal * 0.09;

  const grandTotal = data.total_amount !== undefined && data.total_amount !== null
    ? Number(data.total_amount)
    : Math.round(taxableSubtotal + cgstAmt + sgstAmt);

  const roundedOff = data.rounded_off !== undefined && data.rounded_off !== null
    ? Number(data.rounded_off)
    : grandTotal - (taxableSubtotal + cgstAmt + sgstAmt);

  const totalTax = cgstAmt + sgstAmt;
  const totalQty = lineItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const primaryUnit = (lineItems[0]?.per || 'NOS').toUpperCase();

  // Group by HSN for Tax Summary table
  const hsnMap = {};
  lineItems.forEach((item) => {
    const hsn = item.hsn_sac || item.hsn || '8302';
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const disc = parseFloat(item.discount) || 0;
    const amt = item.amount !== undefined && item.amount !== null && Number(item.amount) !== 0
      ? Number(item.amount)
      : qty * rate * (1 - disc / 100);

    if (!hsnMap[hsn]) {
      hsnMap[hsn] = {
        hsn,
        taxableValue: 0,
        cgstRate: 9,
        sgstRate: 9
      };
    }
    hsnMap[hsn].taxableValue += amt;
  });

  let hsnGroups = Object.values(hsnMap);
  if (hsnGroups.length === 0) {
    hsnGroups = [{
      hsn: '8302',
      taxableValue: taxableSubtotal,
      cgstRate: 9,
      sgstRate: 9
    }];
  }

  // Dynamic single-page fit scaling based on line item count
  const pageFitClass = lineItems.length > 12 
    ? 'super-compact-table' 
    : (lineItems.length > 7 ? 'ultra-compact-table' : (lineItems.length > 4 ? 'compact-table' : ''));

  // Helper for 2 decimals
  const fmt = (num) => (typeof num === 'number' ? num : parseFloat(num) || 0).toFixed(2);

  // Document Title
  const docTitle = isChallan ? 'DELIVERY CHALLAN' : (isQuotation ? 'QUOTATION' : 'TAX INVOICE');
  const numberLabel = isChallan ? 'Challan No.' : (isQuotation ? 'Quotation No.' : 'Invoice No.');
  const docNumber = data.challan_no || data.invoice_no || data.quotation_no || '';
  const docDate = data.challan_date || data.invoice_date || data.quotation_date;

  return (
    <div className={`invoice ${pageFitClass} ${isChallan ? 'challan-mode' : ''}`}>

      {/* ================= HEADER ================= */}
      <div className="invoice-title">
        <span>{docTitle}</span>
        {!isChallan && (
          <span className="original-copy">
            {isQuotation ? 'ORIGINAL' : 'ORIGINAL FOR RECIPIENT'}
          </span>
        )}
      </div>

      {/* ================= COMPANY + INVOICE/CHALLAN DETAILS ================= */}
      <div className="top-section">

        {/* Supplier */}
        <div className="supplier-box">

          <div className="company-logo">
            <img src="/logo.png" alt="Krishna Engineering" className="template-logo-img" />
          </div>

          <div className="company-details">
            <h2>KRISHNA ENGINEERING</h2>

            <p>
              137/OM SAKTHI NAGAR,<br />
              CHINNAVEDAMPATTI,<br />
              COIMBATORE - 641049.
            </p>
          </div>

          <div className="company-contact">
            <strong>GSTIN/UIN:</strong> 33AKDPD9814C1ZN
            <br />
            <strong>CONTACT:</strong> 9443821192, 8122813780
            <br />
            <strong>EMAIL:</strong> {companyEmail}
          </div>

        </div>

        {/* Invoice / Challan Meta: 3 compact rows without empty gaps */}
        <div className="invoice-meta">

          <div className="meta-row">
            <div className="meta-label">{numberLabel}</div>
            <div className="meta-value">{docNumber}</div>
          </div>

          <div className="meta-row">
            <div className="meta-label">Dated</div>
            <div className="meta-value">{formatDateDMY(docDate)}</div>
          </div>

          <div className="meta-row">
            <div className="meta-label">{isChallan ? 'Purpose' : 'Mode/Terms of Payment'}</div>
            <div className="meta-value">
              {isChallan 
                ? (data.purpose || 'Job Work') 
                : (data.payment_mode || (isQuotation ? '30 Days Net' : 'Cheque'))}
            </div>
          </div>

        </div>

      </div>

      {/* ================= BUYER + DISPATCH ================= */}
      <div className="buyer-section">

        <div className="buyer-details">

          <div className="section-label">{isChallan ? 'Consignee / Buyer' : 'Buyer'}</div>

          <h3>{buyerName || 'CUSTOMER / BUYER'}</h3>

          <p style={{ whiteSpace: 'pre-line' }}>
            {buyerAddress || 'Address on file'}
          </p>

          <strong>GSTIN/UIN:</strong>
          {buyerGstin ? ` ${buyerGstin}` : ' UNREGISTERED'}

        </div>

        <div className="buyer-meta">

          <div className="meta-row">
            <div className="meta-label">Buyer's Order No.</div>
            <div className="meta-value">{data.buyer_order_no || ''}</div>
          </div>

          <div className="meta-row">
            <div className="meta-label">Dated</div>
            <div className="meta-value">{formatDateDMY(data.buyer_order_date)}</div>
          </div>

          <div className="meta-row">
            <div className="meta-label">{isChallan ? 'Vehicle No.' : 'Dispatch Document No.'}</div>
            <div className="meta-value">{isChallan ? (data.vehicle_no || '-') : (data.dispatch_doc_no || '')}</div>
          </div>

          <div className="meta-row">
            <div className="meta-label">{isChallan ? 'Dispatch Date' : 'Delivery Note Date'}</div>
            <div className="meta-value">
              {formatDateDMY(data.delivery_note_date || docDate)}
            </div>
          </div>

          <div className="meta-row">
            <div className="meta-label">Dispatch through</div>
            <div className="meta-value">{data.dispatch_through || 'ROAD'}</div>
          </div>

          <div className="meta-row">
            <div className="meta-label">Destination</div>
            <div className="meta-value">{data.destination || 'COIMBATORE'}</div>
          </div>

        </div>

      </div>

      {/* ================= ITEM TABLE ================= */}
      {isChallan ? (
        /* Challan Line Items Table: No Rate, Disc%, or Amount */
        <table className="items-table challan-items-table">
          <thead>
            <tr>
              <th className="sl" style={{ width: '8%' }}>Sl<br />No.</th>
              <th className="description" style={{ width: '40%' }}>Description of Goods</th>
              <th className="hsn" style={{ width: '14%' }}>HSN/SAC</th>
              <th className="qty" style={{ width: '14%' }}>Quantity</th>
              <th className="unit" style={{ width: '10%' }}>per</th>
              <th className="remarks" style={{ width: '14%' }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => {
              const qty = parseFloat(item.quantity) || 0;
              const isLast = index === lineItems.length - 1;
              const rowClass = `item-row ${isFewItems && isLast ? 'last-item-padded' : ''}`;

              return (
                <tr key={item.id || index} className={rowClass}>
                  <td style={{ textAlign: 'center' }}>{index + 1}</td>
                  <td>{item.description}</td>
                  <td style={{ textAlign: 'center' }}>{item.hsn_sac || item.hsn || '-'}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(qty)}</td>
                  <td style={{ textAlign: 'center' }}>{(item.per || 'NOS').toUpperCase()}</td>
                  <td style={{ textAlign: 'center' }}>{item.remarks || '-'}</td>
                </tr>
              );
            })}

            {/* Total Quantity Row */}
            <tr className="total-row">
              <td></td>
              <td>Total Quantity</td>
              <td></td>
              <td style={{ textAlign: 'right' }}>{fmt(totalQty)}</td>
              <td style={{ textAlign: 'center' }}>{primaryUnit}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      ) : (
        /* Standard Invoice / Quotation Items Table */
        <table className="items-table">
          <thead>
            <tr>
              <th className="sl">Sl<br />No.</th>
              <th className="description">{isQuotation ? 'Description of Goods / Scope' : 'Description of Goods'}</th>
              <th className="hsn">HSN/SAC</th>
              <th className="qty">Quantity</th>
              <th className="rate">Rate</th>
              <th className="unit">per</th>
              <th className="discount">Disc %</th>
              <th className="amount">Amount</th>
            </tr>
          </thead>

          <tbody>
            {lineItems.map((item, index) => {
              const qty = parseFloat(item.quantity) || 0;
              const rate = parseFloat(item.rate) || 0;
              const disc = parseFloat(item.discount) || 0;
              const itemAmt = item.amount !== undefined && item.amount !== null && Number(item.amount) !== 0
                ? Number(item.amount)
                : qty * rate * (1 - disc / 100);

              const isLast = index === lineItems.length - 1;
              const rowClass = `item-row ${isFewItems && isLast ? 'last-item-padded' : ''}`;

              return (
                <tr key={item.id || index} className={rowClass}>
                  <td>{index + 1}</td>
                  <td>{item.description}</td>
                  <td>{item.hsn_sac || item.hsn || ''}</td>
                  <td>{fmt(qty)}</td>
                  <td>{fmt(rate)}</td>
                  <td>{(item.per || 'NOS').toUpperCase()}</td>
                  <td>{disc > 0 ? `${disc}%` : ''}</td>
                  <td>{fmt(itemAmt)}</td>
                </tr>
              );
            })}

            {/* Tax rows */}
            <tr className="tax-row">
              <td colSpan={7} className="tax-label">CGST</td>
              <td>{fmt(cgstAmt)}</td>
            </tr>

            <tr className="tax-row">
              <td colSpan={7} className="tax-label">SGST</td>
              <td>{fmt(sgstAmt)}</td>
            </tr>

            <tr className="round-row">
              <td colSpan={7} className="round-label">Rounded off-</td>
              <td>{roundedOff && Math.abs(roundedOff) >= 0.005 ? fmt(roundedOff) : ''}</td>
            </tr>

            {/* Total */}
            <tr className="total-row">
              <td></td>
              <td>Total</td>
              <td></td>
              <td>{fmt(totalQty)}</td>
              <td></td>
              <td>{primaryUnit}</td>
              <td></td>
              <td>{fmt(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      )}

      {/* ================= CHALLAN PURPOSE / TAX SUMMARY SECTION ================= */}
      {isChallan ? (
        /* Challan Goods Dispatch Notice & Purpose Box */
        <div className="challan-info-box">
          <div className="challan-purpose-row">
            <div>
              <strong>Goods Sent For:</strong>{' '}
              <span className="purpose-badge">{data.purpose || 'Job Work'}</span>
            </div>
            {data.vehicle_no && (
              <div>
                <strong>Vehicle No:</strong>{' '}
                <span className="font-mono font-bold">{data.vehicle_no}</span>
              </div>
            )}
          </div>
          <div className="challan-notice">
            Not for Sale — Delivery Challan Only (Issued under Rule 55 of CGST Rules, 2017)
          </div>
        </div>
      ) : (
        /* Invoice / Quotation Amount in Words & Tax Summary */
        <>
          <div className="amount-words">
            <div>
              <strong>Amount Chargeable (in words)</strong>
              <p>
                {numberToWords(grandTotal)}
              </p>
            </div>

            <div className="eoe">
              E. &amp; O.E.
            </div>
          </div>

          <table className="tax-summary">
            <thead>
              <tr>
                <th rowSpan={2}>HSN / SAC</th>
                <th rowSpan={2}>Taxable<br />Value</th>
                <th colSpan={2}>Central Tax</th>
                <th colSpan={2}>State Tax</th>
                <th rowSpan={2}>Total<br />Tax</th>
              </tr>
              <tr>
                <th>Rate</th>
                <th>Amount</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {hsnGroups.map((grp) => {
                const grpCgst = hsnGroups.length === 1 ? cgstAmt : grp.taxableValue * (grp.cgstRate / 100);
                const grpSgst = hsnGroups.length === 1 ? sgstAmt : grp.taxableValue * (grp.sgstRate / 100);
                const grpTax = grpCgst + grpSgst;

                return (
                  <tr key={grp.hsn}>
                    <td>{grp.hsn}</td>
                    <td>{fmt(grp.taxableValue)}</td>
                    <td>{grp.cgstRate.toFixed(2)}%</td>
                    <td>{fmt(grpCgst)}</td>
                    <td>{grp.sgstRate.toFixed(2)}%</td>
                    <td>{fmt(grpSgst)}</td>
                    <td>{grpTax.toFixed(2)}</td>
                  </tr>
                );
              })}

              <tr className="tax-total">
                <td>Total</td>
                <td>{fmt(taxableSubtotal)}</td>
                <td></td>
                <td>{fmt(cgstAmt)}</td>
                <td></td>
                <td>{fmt(sgstAmt)}</td>
                <td>{fmt(totalTax)}</td>
              </tr>
            </tbody>
          </table>

          <div className="tax-words">
            <strong>Tax Amount (in words):</strong>{' '}
            <span style={{ textTransform: 'uppercase' }}>
              {numberToWords(totalTax)}
            </span>
          </div>
        </>
      )}

      {/* ================= DECLARATION + SIGNATURE ================= */}
      <div className="bottom-section">

        <div className="declaration">

          <h4>Declaration</h4>

          <p>
            {isChallan
              ? 'We declare that the above-mentioned goods are dispatched as per the details given above.'
              : (isQuotation
                ? 'We declare that this quotation shows the estimated price and scope of goods/services described and that all particulars are true and correct.'
                : 'We declare that this invoice shows the actual price of the Services/goods described and that all particulars are true and correct.')}
          </p>

        </div>

        <div className="signature">

          <strong>for Krishna Engineering</strong>

          <div className="signature-space">
            <span>Authorized<br />Signatory</span>
          </div>

          <div className="stamp">
            COMPANY<br />
            STAMP
          </div>

          <strong className="signatory-label">
            Authorised Signatory
          </strong>

        </div>

      </div>

      {/* ================= FOOTER ================= */}
      <div className="invoice-footer">

        <p>Subject to Coimbatore Jurisdiction</p>

        {isChallan ? (
          <>
            <p style={{ fontWeight: 700 }}>Not for Sale — Delivery Challan Only</p>
            <p>This is a Computer Generated Delivery Challan</p>
          </>
        ) : (
          <p>{isQuotation ? 'This is a Computer Generated Quotation' : 'This is a Computer Generated Invoice'}</p>
        )}

      </div>

    </div>
  );
}
