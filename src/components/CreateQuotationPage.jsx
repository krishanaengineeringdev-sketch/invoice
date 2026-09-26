import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';
import { 
  ClipboardList, 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save, 
  Download, 
  FileText, 
  CheckCircle2, 
  Lock, 
  ShieldCheck, 
  Calendar, 
  UserCheck, 
  AlertCircle, 
  Loader2,
  FileCheck,
  Sparkles
} from 'lucide-react';
import { numberToWords } from '../utils/numberToWords';

// Indian Financial Year calculation helper (April 1 to March 31)
function getIndianFinancialYear(dateObj = new Date()) {
  const month = dateObj.getMonth();
  const year = dateObj.getFullYear();
  let startYear = year;
  let endYear = year + 1;

  if (month < 3) {
    startYear = year - 1;
    endYear = year;
  }

  const endYearShort = String(endYear).slice(-2);
  return `${startYear}-${endYearShort}`;
}

export default function CreateQuotationPage() {
  const navigate = useNavigate();
  const { id } = useParams(); // Present when editing existing quotation

  // Header State
  const [quotationNo, setQuotationNo] = useState('');
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [status, setStatus] = useState('draft');

  // Buyer Details State
  const [buyerName, setBuyerName] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [buyerGstin, setBuyerGstin] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [buyerOrderNo, setBuyerOrderNo] = useState('');
  const [buyerOrderDate, setBuyerOrderDate] = useState('');

  // Materials Catalog
  const [materialsCatalog, setMaterialsCatalog] = useState([]);

  // Line Items State
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

  // Loading & Alert States
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [saveError, setSaveError] = useState(null);
  const [isSaved, setIsSaved] = useState(false);

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
        console.error('Catalog fetch error:', err);
        setMaterialsCatalog([]);
      }
    };

    fetchCatalog();
  }, []);

  // Fetch Existing Quotation when editing or generate number for new
  useEffect(() => {
    const initQuotation = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      if (id) {
        // EDIT MODE
        setIsLoading(true);
        try {
          const { data: qData, error: qErr } = await supabase
            .from('quotations')
            .select('*, clients(name, address, gstin), quotation_items(*)')
            .eq('id', id)
            .single();

          if (qErr || !qData) {
            setSaveError('Failed to load requested quotation.');
          } else {
            setQuotationNo(qData.quotation_no || '');
            setQuotationDate(qData.quotation_date || new Date().toISOString().split('T')[0]);
            setValidUntil(qData.valid_until || '');
            setStatus(qData.status || 'draft');
            setBuyerName(qData.clients?.name || '');
            setBuyerAddress(qData.clients?.address || '');
            setBuyerGstin(qData.clients?.gstin || '');
            if (qData.clients?.email) setBuyerEmail(qData.clients.email);

            if (qData.quotation_items && qData.quotation_items.length > 0) {
              const loadedItems = qData.quotation_items.map((item, idx) => ({
                id: item.id || idx + 1,
                mode: 'new',
                selectedMaterialId: '',
                description: item.description || '',
                hsn: item.hsn_sac || '73090090',
                quantity: parseFloat(item.quantity) || 1,
                rate: parseFloat(item.rate) || 0,
                per: item.per || 'Nos',
                discount: parseFloat(item.discount) || 0,
                amount: parseFloat(item.amount) || 0,
              }));
              setItems(loadedItems);
            }
          }
        } catch (err) {
          console.error('Error fetching quotation:', err);
        } finally {
          setIsLoading(false);
        }
      } else {
        // NEW MODE: Auto-generate Quotation Number QT-X/2026-27
        try {
          const finYear = getIndianFinancialYear();
          const { data: existingList, error: fetchErr } = await supabase
            .from('quotations')
            .select('quotation_no')
            .order('created_at', { ascending: false })
            .limit(10);

          if (fetchErr) throw fetchErr;

          let nextCount = 1;
          if (existingList && existingList.length > 0) {
            const matches = existingList
              .map((q) => {
                const m = q.quotation_no?.match(/QT-(\d+)\//);
                return m ? parseInt(m[1], 10) : 0;
              })
              .filter(Boolean);
            if (matches.length > 0) {
              nextCount = Math.max(...matches) + 1;
            }
          }

          setQuotationNo(`QT-${nextCount}/${finYear}`);
        } catch (err) {
          console.error('Quotation sequence generation error:', err);
          setQuotationNo(`QT-1/${getIndianFinancialYear()}`);
        }
      }
    };

    initQuotation();
  }, [id, navigate]);

  // Compute row amount
  const computeRowAmount = (qty, rate, disc) => {
    const q = parseFloat(qty) || 0;
    const r = parseFloat(rate) || 0;
    const d = parseFloat(disc) || 0;
    const gross = q * r;
    const discountAmt = gross * (d / 100);
    return Math.max(0, gross - discountAmt);
  };

  // Recalculate totals
  const subtotal = items.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  const cgst = subtotal * 0.09;
  const sgst = subtotal * 0.09;
  const totalTax = cgst + sgst;
  const exactGrandTotal = subtotal + totalTax;
  const grandTotal = Math.round(exactGrandTotal);
  const roundOff = grandTotal - exactGrandTotal;

  // Handlers for Row Actions
  const handleToggleRowMode = (itemId, mode) => {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, mode } : item))
    );
  };

  const handleSelectMaterial = (itemId, materialId) => {
    const selectedMat = materialsCatalog.find((m) => String(m.id) === String(materialId));
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        if (!selectedMat) {
          return { ...item, selectedMaterialId: '' };
        }
        const newRate = selectedMat.default_rate || 0;
        const newAmount = computeRowAmount(item.quantity, newRate, item.discount);
        return {
          ...item,
          selectedMaterialId: materialId,
          description: selectedMat.name + (selectedMat.description ? ` - ${selectedMat.description}` : ''),
          hsn: selectedMat.hsn_sac || '73090090',
          rate: newRate,
          per: selectedMat.default_unit || 'Nos',
          amount: newAmount,
        };
      })
    );
  };

  const handleItemChange = (itemId, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const updatedItem = { ...item, [field]: value };
        const newAmount = computeRowAmount(updatedItem.quantity, updatedItem.rate, updatedItem.discount);
        return { ...updatedItem, amount: newAmount };
      })
    );
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
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
      },
    ]);
  };

  const handleRemoveItem = (itemId) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((item) => item.id !== itemId));
    }
  };

  // Save Quotation Handler
  const saveQuotationToSupabase = async (redirectToConvert = false) => {
    setValidationError('');
    setSaveError(null);

    if (!buyerName.trim()) {
      setValidationError('Buyer Name is required before saving.');
      return false;
    }
    if (!quotationNo.trim()) {
      setValidationError('Quotation No. is required.');
      return false;
    }

    const validItems = items.filter(
      (item) => item.description.trim() && parseFloat(item.quantity) > 0
    );

    if (validItems.length === 0) {
      setValidationError('Please add at least one line item with a description and quantity > 0.');
      return false;
    }

    setIsSaving(true);

    try {
      // 1. Upsert Client (with automatic retry & email fallback)
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

      const quotationPayload = {
        quotation_no: quotationNo.trim(),
        quotation_date: quotationDate,
        valid_until: validUntil || null,
        client_id: clientData.id,
        cgst_amount: cgst,
        sgst_amount: sgst,
        rounded_off: roundOff,
        total_amount: grandTotal,
        status: status || 'draft'
      };

      let targetQuotationId = id;

      if (id) {
        // UPDATE EXISTING
        const { error: updateErr } = await supabase
          .from('quotations')
          .update(quotationPayload)
          .eq('id', id);

        if (updateErr) throw new Error(updateErr.message || 'Failed to update quotation.');

        await supabase.from('quotation_items').delete().eq('quotation_id', id);
      } else {
        // CREATE NEW
        const { data: qData, error: insertErr } = await supabase
          .from('quotations')
          .insert(quotationPayload)
          .select()
          .single();

        if (insertErr) throw new Error(insertErr.message || 'Failed to save quotation.');
        targetQuotationId = qData?.id;
      }

      // Save line items
      if (targetQuotationId) {
        const lineItemsArray = validItems.map((item) => ({
          quotation_id: targetQuotationId,
          description: item.description.trim(),
          hsn_sac: item.hsn,
          quantity: parseFloat(item.quantity) || 0,
          rate: parseFloat(item.rate) || 0,
          per: item.per,
          discount: parseFloat(item.discount) || 0,
          amount: parseFloat(item.amount) || 0
        }));

        await supabase.from('quotation_items').insert(lineItemsArray);
      }

      setIsSaved(true);
      setIsSaving(false);

      if (redirectToConvert) {
        // Automatically trigger convert flow or navigate to list
        navigate('/quotations');
      } else {
        setTimeout(() => {
          navigate('/quotations');
        }, 1000);
      }

      return true;
    } catch (err) {
      console.error('Quotation save error:', err);
      setIsSaving(false);
      setSaveError(err.message || 'Error saving quotation.');
      return false;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F4F5F6] flex flex-col items-center justify-center p-6 text-[#36454F]">
        <Loader2 className="w-8 h-8 animate-spin text-[#F2A104] mb-3" />
        <span className="text-xs font-semibold text-[#5C7A99]">Loading Quotation Data...</span>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-[#F4F5F6] text-[#36454F] flex flex-col font-sans pb-16 overflow-x-hidden"
    >
      <Navbar activeTab="quotations" />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Validation Error Alert */}
        {validationError && (
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl shadow-xs flex items-center justify-between text-xs text-amber-900 font-semibold animate-shake">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>{validationError}</span>
            </div>
            <button onClick={() => setValidationError('')} className="text-amber-700 hover:text-amber-900 font-bold">
              Dismiss
            </button>
          </div>
        )}

        {/* Save Error Alert */}
        {saveError && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl shadow-xs flex items-center justify-between text-xs text-rose-900 font-semibold animate-shake">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{saveError}</span>
            </div>
            <button onClick={() => setSaveError(null)} className="text-rose-700 hover:text-rose-900 font-bold">
              Dismiss
            </button>
          </div>
        )}

        {/* Success Alert */}
        {isSaved && (
          <div className="bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-md flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold">
              <CheckCircle2 className="w-5 h-5" />
              <span>{id ? 'Quotation Updated Successfully!' : 'Quotation Saved Successfully!'}</span>
            </div>
            <span className="text-xs opacity-80">Quotation No: {quotationNo}</span>
          </div>
        )}

        {/* Title Header Card */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-[#F2A104] flex items-center justify-center border border-amber-200/60">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#5C7A99] uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-[#F2A104]" /> Pre-Sale Estimate
              </div>
              <h2 className="text-2xl font-bold text-[#36454F] font-heading">
                {id ? 'EDIT QUOTATION' : 'NEW QUOTATION'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#F4F5F6] px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-[#36454F]">
              <span className="text-[#5C7A99]">NO:</span> <span className="font-mono">{quotationNo || 'Pending'}</span>
            </div>
          </div>
        </div>

        {/* SECTION 1: Quotation Details & Dates */}
        <section className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
          <h3 className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
            <Calendar className="w-4 h-4 text-[#F2A104]" /> 1. Quotation Details & Validity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-[#36454F] mb-1">Quotation No.</label>
              <input
                type="text"
                value={quotationNo}
                onChange={(e) => setQuotationNo(e.target.value)}
                className="w-full px-3.5 py-2 bg-[#F4F5F6] border border-slate-200 rounded-xl font-mono font-bold text-[#36454F] focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#36454F] mb-1">Quotation Date</label>
              <input
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#36454F] mb-1">Valid Until Date</label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#36454F] mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-bold text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none cursor-pointer"
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="converted">Converted</option>
              </select>
            </div>
          </div>
        </section>

        {/* SECTION 2: Buyer / Client Details */}
        <section className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
          <h3 className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider flex items-center gap-1.5 pb-2 border-b border-slate-100">
            <UserCheck className="w-4 h-4 text-[#F2A104]" /> 2. Buyer / Customer Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-[#36454F] mb-1">
                  Buyer Name / Business Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Larsen & Toubro Heavy Engineering"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#36454F] mb-1">Buyer Address</label>
                <textarea
                  rows={3}
                  placeholder="Full street address, City, State, PIN..."
                  value={buyerAddress}
                  onChange={(e) => setBuyerAddress(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none resize-none"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-[#36454F] mb-1">Buyer GSTIN (Optional)</label>
                <input
                  type="text"
                  placeholder="24AAACL1212K1ZM"
                  value={buyerGstin}
                  onChange={(e) => setBuyerGstin(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-mono text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#36454F] mb-1">Buyer Email Address</label>
                <input
                  type="email"
                  placeholder="buyer@company.com"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#36454F] mb-1">Inquiry / Ref No.</label>
                  <input
                    type="text"
                    placeholder="RFQ-9921"
                    value={buyerOrderNo}
                    onChange={(e) => setBuyerOrderNo(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#36454F] mb-1">Inquiry Date</label>
                  <input
                    type="date"
                    value={buyerOrderDate}
                    onChange={(e) => setBuyerOrderDate(e.target.value)}
                    className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-medium text-[#36454F] focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: Line Items Table */}
        <section className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold text-[#5C7A99] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#F2A104]" /> 3. Scope of Supply / Particulars
            </h3>
            <span className="text-[11px] text-[#5C7A99] font-medium">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#36454F] text-white uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-3 py-3 text-center w-12">#</th>
                  <th className="px-4 py-3 min-w-[240px]">Description of Items</th>
                  <th className="px-3 py-3 w-28">HSN/SAC</th>
                  <th className="px-3 py-3 w-24 text-center">Qty</th>
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
                      <td className="px-3 py-3 text-center font-bold text-[#5C7A99]">
                        {index + 1}
                      </td>

                      <td className="px-3 py-2.5">
                        <div className="space-y-1.5">
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
                              Catalog
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
                              Free Text
                            </button>
                          </div>

                          {(item.mode || 'existing') === 'existing' ? (
                            <div className="space-y-1">
                              <select
                                value={item.selectedMaterialId || ''}
                                onChange={(e) => handleSelectMaterial(item.id, e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs font-semibold text-[#36454F] focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none cursor-pointer"
                              >
                                <option value="">-- Select Material from Catalog --</option>
                                {materialsCatalog.map((mat) => (
                                  <option key={mat.id} value={mat.id}>
                                    {mat.name} (₹{mat.default_rate} / {mat.default_unit})
                                  </option>
                                ))}
                              </select>
                              {item.description && (
                                <textarea
                                  rows={2}
                                  value={item.description}
                                  onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                                  className="w-full px-2.5 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs font-medium text-[#36454F] focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none resize-none"
                                />
                              )}
                            </div>
                          ) : (
                            <textarea
                              rows={2}
                              placeholder="Enter custom material or service specifications..."
                              value={item.description}
                              onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs font-medium text-[#36454F] focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none resize-none"
                            />
                          )}
                        </div>
                      </td>

                      <td className="px-2 py-2">
                        <input
                          type="text"
                          value={item.hsn}
                          onChange={(e) => handleItemChange(item.id, 'hsn', e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs font-mono text-[#36454F] text-center focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs font-bold text-[#36454F] text-center focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.rate}
                          onChange={(e) => handleItemChange(item.id, 'rate', e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs font-mono font-bold text-[#36454F] text-right focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                        />
                      </td>

                      <td className="px-2 py-2">
                        <select
                          value={item.per}
                          onChange={(e) => handleItemChange(item.id, 'per', e.target.value)}
                          className="w-full px-1.5 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs text-[#36454F] text-center cursor-pointer"
                        >
                          <option value="Nos">Nos</option>
                          <option value="Sets">Sets</option>
                          <option value="MT">MT</option>
                          <option value="Kgs">Kgs</option>
                          <option value="Mtr">Mtr</option>
                          <option value="Hrs">Hrs</option>
                        </select>
                      </td>

                      <td className="px-2 py-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discount}
                          onChange={(e) => handleItemChange(item.id, 'discount', e.target.value)}
                          className="w-full px-2 py-1.5 bg-[#F4F5F6] border border-slate-200 rounded-lg text-xs font-mono text-[#36454F] text-center focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
                        />
                      </td>

                      <td className="px-4 py-3 text-right font-mono font-bold text-[#36454F]">
                        ₹ {item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-2 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={items.length === 1}
                          className={`p-1.5 rounded-lg transition-all duration-150 active:scale-90 ${
                            items.length === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-rose-500 hover:bg-rose-50 cursor-pointer'
                          }`}
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

        {/* SECTION 4: Calculations & Totals */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-1.5">
              <label className="text-[11px] font-bold text-[#5C7A99] uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#F2A104]" /> Amount Chargeable in Words
              </label>
              <div className="bg-[#F4F5F6] p-3 rounded-xl border border-slate-200 font-bold text-xs text-[#36454F]">
                {numberToWords(grandTotal)}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-1.5">
              <label className="text-[11px] font-bold text-[#5C7A99] uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#F2A104]" /> Tax Amount in Words (18% GST)
              </label>
              <div className="bg-[#F4F5F6] p-3 rounded-xl border border-slate-200 font-semibold text-xs text-[#5C7A99]">
                {numberToWords(totalTax)}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-[#36454F] text-white rounded-2xl p-6 shadow-md border border-[#36454F] space-y-3">
              <h3 className="text-xs font-bold text-[#F2A104] uppercase tracking-wider pb-2 border-b border-white/10">
                Tax & Quotation Summary
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Subtotal (Taxable)</span>
                  <span className="font-mono font-semibold text-white">
                    ₹ {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span>CGST (@ 9%)</span>
                  <span className="font-mono font-semibold text-white">
                    ₹ {cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-300">
                  <span>SGST (@ 9%)</span>
                  <span className="font-mono font-semibold text-white">
                    ₹ {sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-[#5C7A99] pt-1 border-t border-white/10 text-[11px]">
                  <span>Total GST (18%)</span>
                  <span className="font-mono font-semibold text-slate-200">
                    ₹ {totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>Round-off</span>
                  <span className="font-mono">{roundOff >= 0 ? '+' : ''}{roundOff.toFixed(2)}</span>
                </div>

                <div className="pt-3 border-t-2 border-[#F2A104] flex justify-between items-end">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider font-bold text-[#F2A104]">
                      Total Estimated Amount
                    </span>
                    <span className="text-[10px] text-slate-400">Inclusive of all taxes</span>
                  </div>
                  <div className="text-2xl font-extrabold font-mono text-[#F2A104] font-heading">
                    ₹ {grandTotal.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 5: Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-4 pt-4 border-t border-slate-200">
          <Link
            to="/quotations"
            className="w-full sm:w-auto text-center px-5 py-3 rounded-xl bg-white border border-slate-200 text-[#5C7A99] hover:text-[#36454F] font-bold text-xs transition-colors"
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={() => saveQuotationToSupabase(false)}
            disabled={isSaving}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-[#5C7A99] text-[#5C7A99] hover:bg-[#5C7A99] hover:text-white font-bold text-xs transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer disabled:opacity-70"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#5C7A99]" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>{id ? 'Update Quotation' : 'Save Quotation'}</span>
              </>
            )}
          </button>
        </div>

      </main>
    </motion.div>
  );
}
