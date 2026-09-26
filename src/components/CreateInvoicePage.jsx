import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Building2, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Download, 
  FileText, 
  CheckCircle2, 
  Lock, 
  HelpCircle,
  Sparkles,
  ShieldCheck,
  Calendar,
  Truck,
  UserCheck,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { numberToWords } from '../utils/numberToWords';

// Indian Financial Year calculation helper (April 1 to March 31)
function getIndianFinancialYear(dateObj = new Date()) {
  const month = dateObj.getMonth(); // 0-indexed: 0=Jan, 3=April
  const year = dateObj.getFullYear();
  let startYear = year;
  let endYear = year + 1;

  if (month < 3) {
    // January, February, March belong to previous financial year
    startYear = year - 1;
    endYear = year;
  }

  const endYearShort = String(endYear).slice(-2);
  return `${startYear}-${endYearShort}`;
}

import Navbar from './Navbar';

export default function CreateInvoicePage() {
  const navigate = useNavigate();
  const { id } = useParams(); // ID present when editing or viewing an existing invoice

  // Header Details State
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryNote, setDeliveryNote] = useState('DN-8829/2026');
  const [paymentTerms, setPaymentTerms] = useState('30 Days Net');
  const [supplierRef, setSupplierRef] = useState('');
  const [otherRef, setOtherRef] = useState('');

  // Buyer Details State
  const [buyerName, setBuyerName] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerGstin, setBuyerGstin] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerOrderNo, setBuyerOrderNo] = useState('');
  const [buyerOrderDate, setBuyerOrderDate] = useState('');

  // Dispatch Details State
  const [dispatchDocNo, setDispatchDocNo] = useState('');
  const [deliveryNoteDate, setDeliveryNoteDate] = useState('');
  const [dispatchThrough, setDispatchThrough] = useState('');
  const [destination, setDestination] = useState('');

  // Materials Catalog State for line item auto-fill
  const [materialsCatalog, setMaterialsCatalog] = useState([]);

  // Dynamic Line Items State
  const [items, setItems] = useState([
    {
      id: 1,
      mode: 'existing',
      selectedMaterialId: '',
      description: '',
      hsn: '73090090',
      quantity: 1,
      rate: 0,
      per: 'Nos',
      discount: 0,
      amount: 0,
    },
  ]);

  // Load Materials Catalog on Mount
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const { data, error } = await supabase
          .from('materials')
          .select('*')
          .order('name', { ascending: true });

        if (!error && data) {
          setMaterialsCatalog(data);
        } else {
          setMaterialsCatalog([]);
        }
      } catch (err) {
        console.warn('Notice loading materials catalog:', err);
        setMaterialsCatalog([]);
      }
    };
    fetchCatalog();
  }, []);

  // Calculations & Save States
  const [subtotal, setSubtotal] = useState(0);
  const [cgst, setCgst] = useState(0);
  const [sgst, setSgst] = useState(0);
  const [totalTax, setTotalTax] = useState(0);
  const [roundOff, setRoundOff] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [validationError, setValidationError] = useState('');

  // Effect to load existing invoice (EDIT mode) OR auto-generate incremented invoice_no (NEW mode)
  useEffect(() => {
    const initializeForm = async () => {
      if (id) {
        // EDIT / VIEW Mode: Keep existing invoice number and pre-fill form fields from Supabase
        try {
          const { data: existingData, error: loadErr } = await supabase
            .from('invoices')
            .select('*, clients(name, address, gstin), invoice_items(*)')
            .eq('id', id)
            .single();

          if (existingData) {
            if (existingData.invoice_no) setInvoiceNo(existingData.invoice_no);
            if (existingData.invoice_date) setInvoiceDate(existingData.invoice_date);
            if (existingData.payment_mode) setPaymentTerms(existingData.payment_mode);
            if (existingData.supplier_ref) setSupplierRef(existingData.supplier_ref);
            if (existingData.buyer_order_no) setBuyerOrderNo(existingData.buyer_order_no);
            if (existingData.buyer_order_date) setBuyerOrderDate(existingData.buyer_order_date);
            if (existingData.dispatch_doc_no) setDispatchDocNo(existingData.dispatch_doc_no);
            if (existingData.delivery_note_date) setDeliveryNoteDate(existingData.delivery_note_date);
            if (existingData.dispatch_through) setDispatchThrough(existingData.dispatch_through);
            if (existingData.destination) setDestination(existingData.destination);

            const cName = existingData.clients?.name || existingData.client_name || buyerName;
            setBuyerName(cName);
            if (existingData.clients?.address) setBuyerAddress(existingData.clients.address);
            if (existingData.clients?.gstin) setBuyerGstin(existingData.clients.gstin);
            if (existingData.clients?.email) setBuyerEmail(existingData.clients.email);

            if (existingData.invoice_items && existingData.invoice_items.length > 0) {
              setItems(existingData.invoice_items.map((it, idx) => {
                const qty = it.quantity !== undefined && it.quantity !== null ? it.quantity : 1;
                const rate = it.rate !== undefined && it.rate !== null ? it.rate : 0;
                const disc = it.discount !== undefined && it.discount !== null ? it.discount : 0;
                const qtyNum = parseFloat(qty);
                const rateNum = parseFloat(rate);
                const discNum = parseFloat(disc);
                const safeQty = !isNaN(qtyNum) && qtyNum >= 0 ? qtyNum : 0;
                const safeRate = !isNaN(rateNum) && rateNum >= 0 ? rateNum : 0;
                const safeDisc = !isNaN(discNum) ? Math.max(0, Math.min(100, discNum)) : 0;
                const calcAmt = safeQty * safeRate * (1 - safeDisc / 100);

                return {
                  id: it.id || idx + 1,
                  description: it.description || '',
                  hsn: it.hsn_sac || '73090090',
                  quantity: qty,
                  rate: rate,
                  per: it.per || 'Nos',
                  discount: disc,
                  amount: it.amount !== undefined && it.amount !== null && Number(it.amount) !== 0 ? Number(it.amount) : calcAmt
                };
              }));
            }
          }
        } catch (err) {
          console.error('Error fetching existing invoice for edit:', err);
        }
      } else {
        // NEW Mode: Fetch latest invoice from Supabase, parse & increment numeric part
        try {
          const { data: latestInvoices, error: fetchErr } = await supabase
            .from('invoices')
            .select('invoice_no')
            .order('created_at', { ascending: false })
            .limit(1);

          if (fetchErr) throw fetchErr;

          let nextSeq = 1;
          if (latestInvoices && latestInvoices.length > 0 && latestInvoices[0]?.invoice_no) {
            const latestNo = latestInvoices[0].invoice_no;
            // Parse leading numeric sequence e.g., '41' from '41(2026-27)'
            const match = latestNo.match(/^(\d+)/) || latestNo.match(/(\d+)/);
            if (match) {
              nextSeq = parseInt(match[0], 10) + 1;
            }
          }

          const fy = getIndianFinancialYear();
          const autoInvoiceNo = `${nextSeq}(${fy})`;
          setInvoiceNo(autoInvoiceNo);
        } catch (err) {
          console.error('Error auto-generating invoice number:', err);
          const fy = getIndianFinancialYear();
          setInvoiceNo(`1(${fy})`);
        }
      }
    };

    initializeForm();
  }, [id]);

  // Row Amount & Invoice Totals Calculations
  const computeRowAmount = (qtyVal, rateVal, discVal) => {
    const qty = parseFloat(qtyVal);
    const rate = parseFloat(rateVal);
    const disc = parseFloat(discVal);

    const safeQty = !isNaN(qty) && qty >= 0 ? qty : 0;
    const safeRate = !isNaN(rate) && rate >= 0 ? rate : 0;
    const safeDisc = !isNaN(disc) ? Math.max(0, Math.min(100, disc)) : 0;

    return safeQty * safeRate * (1 - safeDisc / 100);
  };

  // Recalculate Totals on line items update
  useEffect(() => {
    let currentSubtotal = 0;
    items.forEach((item) => {
      const amt =
        typeof item.amount === 'number' && !isNaN(item.amount)
          ? item.amount
          : computeRowAmount(item.quantity, item.rate, item.discount);
      currentSubtotal += amt;
    });

    const calculatedCgst = currentSubtotal * 0.09;
    const calculatedSgst = currentSubtotal * 0.09;
    const calculatedTax = calculatedCgst + calculatedSgst;
    const rawTotal = currentSubtotal + calculatedTax;
    const rounded = Math.round(rawTotal);
    const roundOffVal = rounded - rawTotal;

    setSubtotal(currentSubtotal);
    setCgst(calculatedCgst);
    setSgst(calculatedSgst);
    setTotalTax(calculatedTax);
    setRoundOff(roundOffVal);
    setGrandTotal(rounded);
  }, [items]);

  // Line Item Handlers
  const handleToggleRowMode = (itemId, newMode) => {
    setItems((prevItems) =>
      prevItems.map((item) => (item.id === itemId ? { ...item, mode: newMode } : item))
    );
  };

  const handleSelectMaterial = (itemId, materialId) => {
    const matched = materialsCatalog.find((m) => String(m.id) === String(materialId));

    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== itemId) return item;

        if (!matched) {
          return {
            ...item,
            selectedMaterialId: '',
            description: '',
            hsn: '73090090',
            rate: 0,
            amount: 0,
          };
        }

        const newRate = matched.default_rate !== undefined && matched.default_rate !== null ? matched.default_rate : 0;
        const newHsn = matched.hsn_sac || '73090090';
        const newPer = matched.default_unit || 'Nos';

        const newAmount = computeRowAmount(item.quantity, newRate, item.discount);

        return {
          ...item,
          selectedMaterialId: materialId,
          description: matched.name,
          hsn: newHsn,
          rate: newRate,
          per: newPer,
          amount: newAmount,
        };
      })
    );
  };

  const handleItemChange = (itemId, field, value) => {
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== itemId) return item;

        let newValue = value;

        // Validation for Disc % field (0-100, prevent malformed entries like '012')
        if (field === 'discount') {
          if (value === '' || value === undefined || value === null) {
            newValue = '';
          } else {
            const parsedDisc = parseFloat(value);
            if (isNaN(parsedDisc)) {
              newValue = '';
            } else {
              const clampedDisc = Math.max(0, Math.min(100, parsedDisc));
              if (
                typeof value === 'string' &&
                value.length > 1 &&
                value.startsWith('0') &&
                !value.startsWith('0.')
              ) {
                newValue = clampedDisc;
              } else {
                newValue = clampedDisc > 100 ? 100 : (clampedDisc < 0 ? 0 : value);
              }
            }
          }
        }

        const updatedItem = { ...item, [field]: newValue };

        // Immediately recalculate this row's amount on every change
        const newAmount = computeRowAmount(
          updatedItem.quantity,
          updatedItem.rate,
          updatedItem.discount
        );

        return {
          ...updatedItem,
          amount: newAmount,
        };
      })
    );
  };

  const handleAddItem = () => {
    const newItem = {
      id: Date.now(),
      mode: 'existing',
      selectedMaterialId: '',
      description: '',
      hsn: '73090090',
      quantity: 1,
      rate: 0,
      per: 'Nos',
      discount: 0,
      amount: 0,
    };
    setItems((prevItems) => [...prevItems, newItem]);
  };

  const handleRemoveItem = (itemId) => {
    if (items.length > 1) {
      setItems((prevItems) => prevItems.filter((item) => item.id !== itemId));
    }
  };

  // Supabase Save (CREATE vs EDIT mode router)
  const saveInvoiceToSupabase = async (isPrintAfterSave = false) => {
    setValidationError('');
    setSaveError(null);

    // Client-side Validation
    if (!buyerName.trim()) {
      setValidationError('Buyer Name is required before saving.');
      return false;
    }

    if (!invoiceNo.trim()) {
      setValidationError('Invoice No. is required before saving.');
      return false;
    }

    const validItems = items.filter(
      (item) => item.description.trim() && parseFloat(item.quantity) > 0
    );

    if (validItems.length === 0) {
      setValidationError('Please provide at least one valid line item with a description and quantity > 0.');
      return false;
    }

    setIsSaving(true);

    try {
      // Step 1: Upsert client and get client_id (with automatic retry & email fallback)
      const clientPayload = {
        name: buyerName.trim(),
        address: buyerAddress,
        gstin: buyerGstin
      };
      if (buyerEmail.trim()) {
        clientPayload.email = buyerEmail.trim();
      }

      let { data: clientData, error: clientErr } = await supabase
        .from('clients')
        .upsert(clientPayload, { onConflict: 'name' })
        .select()
        .single();

      if (clientErr && clientErr.message?.includes("'email'")) {
        delete clientPayload.email;
        const retryNoEmail = await supabase
          .from('clients')
          .upsert(clientPayload, { onConflict: 'name' })
          .select()
          .single();
        clientData = retryNoEmail.data;
        clientErr = retryNoEmail.error;
      }

      if (clientErr || !clientData) {
        // Automatic retry once after 500ms delay
        await new Promise((resolve) => setTimeout(resolve, 500));
        const retryResult = await supabase
          .from('clients')
          .upsert(clientPayload, { onConflict: 'name' })
          .select()
          .single();

        clientData = retryResult.data;
        clientErr = retryResult.error;
      }

      if (clientErr || !clientData || !clientData.id) {
        throw new Error('Network issue — please check your connection and try again');
      }

      const invoicePayload = {
        invoice_no: invoiceNo.trim(),
        invoice_date: invoiceDate,
        client_id: clientData.id,
        buyer_order_no: buyerOrderNo,
        buyer_order_date: buyerOrderDate || null,
        dispatch_doc_no: dispatchDocNo,
        delivery_note_date: deliveryNoteDate || null,
        dispatch_through: dispatchThrough,
        destination: destination,
        payment_mode: paymentTerms,
        supplier_ref: supplierRef,
        cgst_amount: cgst,
        sgst_amount: sgst,
        rounded_off: roundOff,
        total_amount: grandTotal,
        status: 'pending'
      };

      let targetInvoiceId = id;

      if (id) {
        // EDIT MODE: Update existing invoice using .eq('id', id)
        const { error: updateErr } = await supabase
          .from('invoices')
          .update(invoicePayload)
          .eq('id', id);

        if (updateErr) {
          console.error('Invoice update error:', updateErr);
          throw new Error(updateErr.message || 'Failed to update invoice in Supabase.');
        }

        // Delete previous line items first for this invoice_id
        const { error: deleteErr } = await supabase
          .from('invoice_items')
          .delete()
          .eq('invoice_id', id);

        if (deleteErr) {
          console.warn('Line items delete notice during edit:', deleteErr.message);
        }
      } else {
        // CREATE MODE: Insert new invoice record
        const { data: invoiceData, error: insertErr } = await supabase
          .from('invoices')
          .insert(invoicePayload)
          .select()
          .single();

        if (insertErr) {
          console.error('Invoice insert error:', insertErr);
          throw new Error(insertErr.message || 'Failed to save new invoice to Supabase.');
        }

        if (invoiceData && invoiceData.id) {
          targetInvoiceId = invoiceData.id;
        }
      }

      // Insert updated line items into invoice_items table
      if (targetInvoiceId) {
        const lineItemsArray = validItems.map((item) => ({
          invoice_id: targetInvoiceId,
          description: item.description.trim(),
          hsn_sac: item.hsn,
          quantity: parseFloat(item.quantity) || 0,
          rate: parseFloat(item.rate) || 0,
          per: item.per,
          discount: parseFloat(item.discount) || 0,
          amount: parseFloat(item.amount) || 0
        }));

        const { error: itemsErr } = await supabase
          .from('invoice_items')
          .insert(lineItemsArray);

        if (itemsErr) {
          console.warn('Invoice items insert notice:', itemsErr.message);
        }
      }

      setIsSaved(true);
      setIsSaving(false);

      if (isPrintAfterSave) {
        window.print();
      }

      // Redirect to Invoice History on success
      setTimeout(() => {
        navigate('/invoices');
      }, 1200);

      return true;
    } catch (err) {
      console.error('Invoice save exception:', err);
      setIsSaving(false);
      setSaveError(err.message || 'Error saving/updating invoice. All form inputs have been preserved.');
      return false;
    }
  };

  const handleSaveDraft = () => {
    saveInvoiceToSupabase(false);
  };

  const handleDownloadPdf = () => {
    saveInvoiceToSupabase(true);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-[#F4F5F6] text-[#36454F] flex flex-col font-sans pb-16 overflow-x-hidden"
    >
      
      {/* Responsive Top Navbar */}
      <Navbar activeTab="create" />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Validation Error Alert Banner */}
        {validationError && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl shadow-xs flex items-center justify-between text-xs text-amber-900 font-semibold animate-shake print:hidden">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>{validationError}</span>
            </div>
            <button 
              onClick={() => setValidationError('')} 
              className="text-amber-700 hover:text-amber-900 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Supabase Save Error Alert Banner */}
        {saveError && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl shadow-xs flex items-center justify-between text-xs text-rose-900 font-semibold animate-shake print:hidden">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{saveError}</span>
            </div>
            <button 
              onClick={() => setSaveError(null)} 
              className="text-rose-700 hover:text-rose-900 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Success Alert Banner */}
        {isSaved && (
          <div className="bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-md flex items-center justify-between animate-fade-in print:hidden">
            <div className="flex items-center gap-2 text-sm font-bold">
              <CheckCircle2 className="w-5 h-5" />
              <span>{id ? 'GST Tax Invoice Updated Successfully!' : 'GST Tax Invoice Saved to Supabase & History Updated!'}</span>
            </div>
            <span className="text-xs opacity-80">Invoice No: {invoiceNo}</span>
          </div>
        )}

        {/* Invoice Title Card */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-[#F2A104] flex items-center justify-center border border-amber-200/60">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#5C7A99] uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-[#F2A104]" /> GSTIN: 33AKDPD9814C1ZN
              </div>
              <h2 className="text-2xl font-bold text-[#36454F] font-heading">
                TAX INVOICE {id ? `(Edit Mode)` : ''}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto bg-[#F4F5F6] px-4 py-2 rounded-xl border border-slate-200">
            <span className="text-xs text-[#5C7A99] font-bold">INVOICE NO:</span>
            <span className="text-sm font-bold font-mono text-[#36454F]">{invoiceNo || 'Pending'}</span>
          </div>
        </div>

        {/* SECTION 1: Header Metadata Grid */}
        <section className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
          <h3 className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
            <Calendar className="w-4 h-4 text-[#F2A104]" /> 1. Header & Reference Details
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            
            {/* Invoice No (Pre-filled FY Format, Editable) */}
            <div>
              <label className="block font-semibold text-[#36454F] mb-1">
                Invoice No. <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 42(2026-27)"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block font-semibold text-[#36454F] mb-1">
                Invoice Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
              />
            </div>

            {/* Delivery Note */}
            <div>
              <label className="block font-semibold text-[#36454F] mb-1">
                Delivery Note
              </label>
              <input
                type="text"
                placeholder="e.g. DN-8829/2026"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
              />
            </div>

            {/* Mode / Terms of Payment */}
            <div>
              <label className="block font-semibold text-[#36454F] mb-1">
                Mode / Terms of Payment
              </label>
              <select
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none cursor-pointer"
              >
                <option value="30 Days Net">30 Days Net</option>
                <option value="Immediate / Cash">Immediate / Cash</option>
                <option value="50% Advance Balance on Dispatch">50% Advance Balance on Dispatch</option>
                <option value="Against Delivery">Against Delivery</option>
              </select>
            </div>

            {/* Supplier's Ref */}
            <div>
              <label className="block font-semibold text-[#36454F] mb-1">
                Supplier's Ref.
              </label>
              <input
                type="text"
                placeholder="e.g. KE/QUO/2026/412"
                value={supplierRef}
                onChange={(e) => setSupplierRef(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
              />
            </div>

            {/* Other Reference */}
            <div>
              <label className="block font-semibold text-[#36454F] mb-1">
                Other Reference
              </label>
              <input
                type="text"
                placeholder="e.g. PO-88491-REV2"
                value={otherRef}
                onChange={(e) => setOtherRef(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
              />
            </div>

          </div>
        </section>

        {/* SECTION 2 & 3: Buyer & Dispatch Details (Two Columns Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Buyer Details Card */}
          <section className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
            <h3 className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <UserCheck className="w-4 h-4 text-[#F2A104]" /> 2. Buyer (Billed To) Details
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#36454F] mb-1">
                  Buyer Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter company or buyer name"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-bold text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#36454F] mb-1">
                  Billing Address <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Full billing address with Pincode"
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#36454F] mb-1">
                    GSTIN / UIN
                  </label>
                  <input
                    type="text"
                    placeholder="24AAAAA0000A1Z5"
                    value={buyerGstin}
                    onChange={(e) => setBuyerGstin(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-mono text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#36454F] mb-1">
                    Buyer Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="buyer@company.com"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                  />
                </div>
              </div>

                <div>
                  <label className="block font-semibold text-[#36454F] mb-1">
                    Buyer's Order No.
                  </label>
                  <input
                    type="text"
                    placeholder="PO Number"
                    value={buyerOrderNo}
                    onChange={(e) => setBuyerOrderNo(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#36454F] mb-1">
                    Order Date
                  </label>
                  <input
                    type="date"
                    value={buyerOrderDate}
                    onChange={(e) => setBuyerOrderDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                  />
                </div>
              </div>

            </section>

          {/* Dispatch Details Card */}
          <section className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
            <h3 className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Truck className="w-4 h-4 text-[#F2A104]" /> 3. Dispatch & Transport Details
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#36454F] mb-1">
                    Dispatch Document No. (LR)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LR-994182"
                    value={dispatchDocNo}
                    onChange={(e) => setDispatchDocNo(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#36454F] mb-1">
                    Delivery Note Date
                  </label>
                  <input
                    type="date"
                    value={deliveryNoteDate}
                    onChange={(e) => setDeliveryNoteDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#36454F] mb-1">
                  Dispatched Through
                </label>
                <input
                  type="text"
                  placeholder="e.g. VRL Logistics Transport"
                  value={dispatchThrough}
                  onChange={(e) => setDispatchThrough(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#36454F] mb-1">
                  Destination / Delivery Site
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hazira Works, Surat, Gujarat"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                />
              </div>
            </div>
          </section>

        </div>

        {/* SECTION 4: Dynamic Line Items Table */}
        <section className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#F2A104]" /> 4. Particulars of Goods & Services
            </h3>
            <span className="text-[11px] text-[#5C7A99]">
              {items.length} {items.length === 1 ? 'item' : 'items'} added
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#36454F] text-white uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-3 py-3 text-center w-12">Sl No.</th>
                  <th className="px-4 py-3 min-w-[240px]">Description of Goods</th>
                  <th className="px-3 py-3 w-28">HSN/SAC</th>
                  <th className="px-3 py-3 w-24 text-center">Quantity</th>
                  <th className="px-3 py-3 w-28 text-right">Rate (₹)</th>
                  <th className="px-3 py-3 w-20 text-center">Per</th>
                  <th className="px-3 py-3 w-20 text-center">Disc %</th>
                  <th className="px-4 py-3 w-32 text-right">Amount (₹)</th>
                  <th className="px-3 py-3 text-center w-12">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                <AnimatePresence initial={false}>
                  {items.map((item, index) => (
                    <motion.tr 
                      key={item.id} 
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="hover:bg-[#F4F5F6]/50 transition-colors"
                    >
                      
                      {/* Sl No. */}
                      <td className="px-3 py-3 text-center font-bold text-[#5C7A99]">
                        {index + 1}
                      </td>

                      {/* Description of Goods */}
                      <td className="px-3 py-2.5">
                        <div className="space-y-1.5">
                          
                          {/* Mode Toggle Switch: Select Existing vs Type New */}
                          <div className="inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleToggleRowMode(item.id, 'existing')}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                (item.mode || 'existing') === 'existing'
                                  ? 'bg-[#F2A104] text-[#36454F] shadow-xs'
                                  : 'text-[#5C7A99] hover:text-[#36454F]'
                              }`}
                            >
                              Select Existing
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleRowMode(item.id, 'new')}
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                                item.mode === 'new'
                                  ? 'bg-[#F2A104] text-[#36454F] shadow-xs'
                                  : 'text-[#5C7A99] hover:text-[#36454F]'
                              }`}
                            >
                              Type New
                            </button>
                          </div>

                          {/* Mode 1: Select Existing Dropdown */}
                          {(item.mode || 'existing') === 'existing' ? (
                            <div className="space-y-1">
                              <select
                                value={item.selectedMaterialId || ''}
                                onChange={(e) => handleSelectMaterial(item.id, e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs font-semibold text-[#36454F] focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none cursor-pointer transition-colors duration-150"
                              >
                                <option value="">-- Choose Material from Catalog --</option>
                                {materialsCatalog.map((mat) => (
                                  <option key={mat.id} value={mat.id}>
                                    {mat.name} ({mat.hsn_sac ? `HSN: ${mat.hsn_sac}, ` : ''}₹{mat.default_rate} / {mat.default_unit})
                                  </option>
                                ))}
                              </select>
                              {item.description && (
                                <textarea
                                  rows={2}
                                  placeholder="Edit selected description..."
                                  value={item.description}
                                  onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs font-medium text-[#36454F] focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none resize-none transition-colors duration-150"
                                />
                              )}
                            </div>
                          ) : (
                            /* Mode 2: Type New Free Text */
                            <textarea
                              rows={2}
                              placeholder="Enter custom item name & specifications..."
                              value={item.description}
                              onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs font-medium text-[#36454F] focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none resize-none transition-colors duration-150"
                            />
                          )}

                        </div>
                      </td>

                      {/* HSN/SAC */}
                      <td className="px-2 py-2">
                        <input
                          type="text"
                          placeholder="73090090"
                          value={item.hsn}
                          onChange={(e) => handleItemChange(item.id, 'hsn', e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs font-mono text-[#36454F] text-center focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none transition-colors duration-150"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs font-bold text-[#36454F] text-center focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none transition-colors duration-150"
                        />
                      </td>

                      {/* Rate */}
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.rate}
                          onChange={(e) => handleItemChange(item.id, 'rate', e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs font-mono font-bold text-[#36454F] text-right focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none transition-colors duration-150"
                        />
                      </td>

                      {/* Per */}
                      <td className="px-2 py-2">
                        <select
                          value={item.per}
                          onChange={(e) => handleItemChange(item.id, 'per', e.target.value)}
                          className="w-full px-1.5 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs text-[#36454F] text-center focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none cursor-pointer transition-colors duration-150"
                        >
                          <option value="Nos">Nos</option>
                          <option value="Sets">Sets</option>
                          <option value="MT">MT</option>
                          <option value="Kgs">Kgs</option>
                          <option value="Mtr">Mtr</option>
                          <option value="Hrs">Hrs</option>
                        </select>
                      </td>

                      {/* Disc % */}
                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discount}
                          onChange={(e) => handleItemChange(item.id, 'discount', e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs font-mono text-[#36454F] text-center focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none transition-colors duration-150"
                        />
                      </td>

                      {/* Amount (Calculated) */}
                      <td className="px-4 py-3 text-right font-mono font-bold text-[#36454F]">
                        ₹ {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Action Remove */}
                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={items.length === 1}
                          className={`p-1.5 rounded-lg transition-all duration-150 active:scale-90 ${
                            items.length === 1
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-rose-500 hover:bg-rose-50 cursor-pointer'
                          }`}
                          title="Remove row"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>

                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Add Row Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F4F5F6] hover:bg-[#5C7A99] text-[#5C7A99] hover:text-white font-bold text-xs transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer border border-slate-200"
            >
              <Plus className="w-4 h-4" />
              <span>Add Row</span>
            </button>
          </div>
        </section>

        {/* SECTION 5 & 6: Read-only Text Boxes (Words) & Right-Aligned Totals Box */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Read-Only Text Boxes in Words & Bank Details */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Amount Chargeable in Words */}
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-1.5">
              <label className="text-[11px] font-bold text-[#5C7A99] uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#F2A104]" /> Amount Chargeable in Words
              </label>
              <div className="bg-[#F4F5F6] p-3 rounded-xl border border-slate-200 font-bold text-xs text-[#36454F] leading-relaxed">
                {numberToWords(grandTotal)}
              </div>
            </div>

            {/* Tax Amount in Words */}
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-1.5">
              <label className="text-[11px] font-bold text-[#5C7A99] uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#F2A104]" /> Tax Amount in Words (18% Total GST)
              </label>
              <div className="bg-[#F4F5F6] p-3 rounded-xl border border-slate-200 font-semibold text-xs text-[#5C7A99] leading-relaxed">
                {numberToWords(totalTax)}
              </div>
            </div>

            {/* Bank Payment Details */}
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 text-xs space-y-2">
              <h4 className="font-bold text-[#36454F] font-heading flex items-center gap-1.5">
                Company Bank Details for RTGS/NEFT:
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-[#5C7A99] font-medium bg-[#F4F5F6] p-3 rounded-xl">
                <div>Bank: <span className="font-bold text-[#36454F]">State Bank of India</span></div>
                <div>Branch: <span className="font-bold text-[#36454F]">Industrial Estate Vadodara</span></div>
                <div>A/C No: <span className="font-mono font-bold text-[#36454F]">389920104829</span></div>
                <div>IFSC: <span className="font-mono font-bold text-[#36454F]">SBIN0004128</span></div>
              </div>
            </div>

          </div>

          {/* Right Column: Visually Distinct Totals Section */}
          <div className="lg:col-span-5">
            <div className="bg-[#36454F] text-white rounded-2xl p-6 shadow-md border border-[#36454F] space-y-3">
              <h3 className="text-xs font-bold text-[#F2A104] uppercase tracking-wider pb-2 border-b border-white/10">
                Tax & Calculation Summary
              </h3>

              <div className="space-y-2 text-xs">
                
                {/* Taxable Subtotal */}
                <div className="flex justify-between items-center text-slate-300">
                  <span>Taxable Value (Subtotal)</span>
                  <span className="font-mono font-semibold text-white">
                    ₹ {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* CGST */}
                <div className="flex justify-between items-center text-slate-300">
                  <span>Central Tax (CGST @ 9%)</span>
                  <span className="font-mono font-semibold text-white">
                    ₹ {cgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* SGST */}
                <div className="flex justify-between items-center text-slate-300">
                  <span>State Tax (SGST @ 9%)</span>
                  <span className="font-mono font-semibold text-white">
                    ₹ {sgst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Total Tax Amount */}
                <div className="flex justify-between items-center text-[#5C7A99] pt-1 border-t border-white/10 text-[11px]">
                  <span>Total Tax Amount (18%)</span>
                  <span className="font-mono font-semibold text-slate-200">
                    ₹ {totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Round Off */}
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Round-off Adjustment</span>
                  <span className="font-mono">
                    {roundOff >= 0 ? '+' : ''}{roundOff.toFixed(2)}
                  </span>
                </div>

                {/* Grand Total */}
                <div className="pt-3 border-t-2 border-[#F2A104] flex justify-between items-end">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider font-bold text-[#F2A104]">
                      Grand Total (INR)
                    </span>
                    <span className="text-[10px] text-slate-400">Inclusive of all GST taxes</span>
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-[#F2A104] font-heading">
                    ₹ {grandTotal.toLocaleString('en-IN')}
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>

        {/* SECTION 7: Declaration & Signature Block */}
        <section className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
            
            {/* Declaration Terms */}
            <div className="text-[11px] text-[#5C7A99] space-y-1.5 border-l-2 border-[#5C7A99] pl-3 py-1">
              <h4 className="font-bold text-[#36454F] text-xs uppercase tracking-wider">
                Declaration & Terms:
              </h4>
              <p>1. We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
              <p>2. Goods once sold will not be taken back or exchanged.</p>
              <p>3. Interest @ 18% p.a. will be levied if invoice is not settled within stipulated payment terms.</p>
              <p>4. Subject to Coimbatore / Tamil Nadu Jurisdiction only.</p>
            </div>

            {/* Signature Block (Bottom-Right Bordered Box) */}
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 bg-[#F4F5F6]/60 text-center space-y-3 md:w-80 md:ml-auto">
              <div className="text-xs font-bold text-[#36454F] uppercase tracking-wider">
                For KRISHNA ENGINEERING
              </div>

              {/* Scanned Stamp/Signature Placeholder Image Area */}
              <div className="h-20 bg-white rounded-lg border border-slate-200 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="w-12 h-12 rounded-full border-2 border-[#5C7A99]/40 flex items-center justify-center text-[#5C7A99] rotate-[-12deg] opacity-70">
                  <div className="text-[8px] font-bold text-center leading-tight">
                    KRISHNA<br />ENGG<br />STAMP
                  </div>
                </div>
                <span className="text-[9px] text-slate-400 font-mono mt-1">Digital Stamp & Sign</span>
              </div>

              <div className="text-[11px] font-bold text-[#5C7A99] border-t border-slate-200 pt-1">
                Authorised Signatory
              </div>
            </div>

          </div>
        </section>

        {/* SECTION 8: Bottom Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-4 border-t border-slate-200 print:hidden">
          
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-[#5C7A99] text-[#5C7A99] hover:bg-[#5C7A99] hover:text-white font-bold text-xs transition-all duration-200 cursor-pointer shadow-2xs disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#5C7A99]" />
                <span>{id ? 'Updating...' : 'Saving...'}</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{id ? 'Update Invoice' : 'Save Draft'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isSaving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl bg-[#F2A104] hover:bg-[#d88f00] text-[#36454F] font-extrabold text-xs shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#36454F]" />
                <span>Saving & Downloading...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </>
            )}
          </button>

        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-[#5C7A99]">
          © {new Date().getFullYear()} Krishna Engineering · Tax Invoice Generator Compliant with GST Act 2017
        </div>
      </footer>

    </motion.div>
  );
}
