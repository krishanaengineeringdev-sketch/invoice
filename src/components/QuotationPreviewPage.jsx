import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  ArrowLeft, 
  Pencil, 
  Printer, 
  ClipboardList, 
  ShieldCheck, 
  Calendar, 
  Loader2, 
  FileCheck,
  ArrowRight,
  Sparkles,
  MessageCircle,
  Mail
} from 'lucide-react';
import { shareViaWhatsApp, shareViaEmail } from '../utils/shareUtils';
import ShareEmailModal from './ShareEmailModal';
import { numberToWords } from '../utils/numberToWords';

export default function QuotationPreviewPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [quotation, setQuotation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shareEmailData, setShareEmailData] = useState(null);
  const [error, setError] = useState(null);

  // Convert Modal State
  const [isConverting, setIsConverting] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertError, setConvertError] = useState(null);

  useEffect(() => {
    const fetchQuotationDetails = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/login', { replace: true });
          return;
        }

        const { data, error: fetchErr } = await supabase
          .from('quotations')
          .select('*, clients(name, address, gstin), quotation_items(*)')
          .eq('id', id)
          .single();

        if (fetchErr || !data) {
          console.error('Error fetching quotation:', fetchErr);
          setError(fetchErr?.message || 'Quotation not found.');
          setQuotation(null);
        } else {
          setQuotation(data);
        }
      } catch (err) {
        console.error('Unexpected exception loading quotation:', err);
        setError('Error connecting to database.');
        setQuotation(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchQuotationDetails();
    } else {
      setError('Invalid Quotation ID.');
      setIsLoading(false);
    }
  }, [id, navigate]);

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    if (!quotation) return;
    shareViaWhatsApp({
      type: 'Quotation',
      number: quotation.quotation_no,
      date: formatDate(quotation.quotation_date),
      amount: quotation.total_amount,
      buyerName: quotation.clients?.name || ''
    });
  };

  const handleEmailShare = () => {
    if (!quotation) return;
    setShareEmailData({
      type: 'Quotation',
      number: quotation.quotation_no,
      date: formatDate(quotation.quotation_date),
      amount: quotation.total_amount,
      buyerName: quotation.clients?.name || '',
      buyerEmail: quotation.clients?.email || ''
    });
  };

  // Convert Quotation to Invoice
  const handleConvertQuotation = async () => {
    if (!quotation) return;
    setIsConverting(true);
    setConvertError(null);

    try {
      const year = new Date().getFullYear();
      const nextYearShort = String(year + 1).slice(-2);
      const finYear = `${year}-${nextYearShort}`;

      const { data: latestInvoices } = await supabase
        .from('invoices')
        .select('invoice_no')
        .order('created_at', { ascending: false })
        .limit(10);

      let nextCount = 1;
      if (latestInvoices && latestInvoices.length > 0) {
        const matches = latestInvoices
          .map((inv) => {
            const m = inv.invoice_no?.match(/KE-(\d+)\//);
            return m ? parseInt(m[1], 10) : 0;
          })
          .filter(Boolean);
        if (matches.length > 0) {
          nextCount = Math.max(...matches) + 1;
        }
      }
      const newInvoiceNo = `KE-${nextCount}/${finYear}`;

      const invoicePayload = {
        invoice_no: newInvoiceNo,
        invoice_date: new Date().toISOString().split('T')[0],
        client_id: quotation.client_id,
        cgst_amount: quotation.cgst_amount || 0,
        sgst_amount: quotation.sgst_amount || 0,
        rounded_off: quotation.rounded_off || 0,
        total_amount: quotation.total_amount || 0,
        status: 'pending',
        payment_mode: '30 Days Net'
      };

      try {
        invoicePayload.quotation_id = quotation.id;
      } catch {}

      let { data: newInvoice, error: invInsertErr } = await supabase
        .from('invoices')
        .insert(invoicePayload)
        .select()
        .single();

      if (invInsertErr && invInsertErr.code === '42703') {
        delete invoicePayload.quotation_id;
        const retryResult = await supabase
          .from('invoices')
          .insert(invoicePayload)
          .select()
          .single();
        newInvoice = retryResult.data;
        invInsertErr = retryResult.error;
      }

      if (invInsertErr || !newInvoice) {
        throw new Error(invInsertErr?.message || 'Failed to generate invoice.');
      }

      const qItems = quotation.quotation_items || [];
      if (qItems.length > 0) {
        const lineItemsArray = qItems.map((item) => ({
          invoice_id: newInvoice.id,
          description: item.description,
          hsn_sac: item.hsn_sac,
          quantity: item.quantity,
          rate: item.rate,
          per: item.per,
          discount: item.discount,
          amount: item.amount
        }));

        await supabase.from('invoice_items').insert(lineItemsArray);
      }

      await supabase
        .from('quotations')
        .update({ status: 'converted' })
        .eq('id', quotation.id);

      setShowConvertModal(false);
      setIsConverting(false);
      navigate(`/invoice/${newInvoice.id}/edit`);
    } catch (err) {
      console.error('Conversion exception:', err);
      setConvertError(err.message || 'Error converting quotation to invoice.');
      setIsConverting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F4F5F6] flex flex-col items-center justify-center p-6 text-[#36454F]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#36454F] flex items-center justify-center text-[#F2A104] font-black text-xl shadow-md">
            KE
          </div>
          <span className="font-bold text-lg text-[#36454F]">Krishna Engineering</span>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-[#5C7A99]">
          <Loader2 className="w-5 h-5 animate-spin text-[#F2A104]" />
          <span>Loading Quotation details...</span>
        </div>
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen bg-[#F4F5F6] p-6 flex items-center justify-center text-[#36454F]">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-xl border border-slate-200 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-[#36454F]">Quotation Not Found</h2>
          <p className="text-xs text-[#5C7A99]">{error || 'The requested quotation does not exist.'}</p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              to="/quotations"
              className="px-4 py-2 rounded-xl bg-[#36454F] text-white text-xs font-bold hover:bg-[#2c3840] transition-colors"
            >
              Back to Quotations
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const lineItems = quotation.quotation_items || [];
  const subtotal = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const cgst = quotation.cgst_amount !== undefined && quotation.cgst_amount !== null ? Number(quotation.cgst_amount) : subtotal * 0.09;
  const sgst = quotation.sgst_amount !== undefined && quotation.sgst_amount !== null ? Number(quotation.sgst_amount) : subtotal * 0.09;
  const totalTax = cgst + sgst;
  const grandTotal = quotation.total_amount !== undefined && quotation.total_amount !== null ? Number(quotation.total_amount) : Math.round(subtotal + totalTax);

  const itemCount = lineItems.length;

  const getSizingConfig = (count) => {
    if (count <= 6) {
      return {
        cardSpace: 'space-y-4 print:space-y-1.5',
        headerPadding: 'pb-4 print:pb-1.5',
        customerPadding: 'p-4 print:p-2.5',
        tableCellPadding: 'px-3 py-2 print:py-1 print:px-1.5',
        tableFontSize: 'text-xs print:text-[10px]',
        summaryPadding: 'p-4 print:p-2.5',
        summaryGap: 'gap-6 print:gap-2',
        signaturePadding: 'pt-6 print:pt-2',
        signatureGap: 'space-y-6 print:space-y-3',
      };
    }
    if (count <= 12) {
      return {
        cardSpace: 'space-y-3 print:space-y-1',
        headerPadding: 'pb-3 print:pb-1',
        customerPadding: 'p-3 print:p-1.5',
        tableCellPadding: 'px-2.5 py-1.5 print:py-0.5 print:px-1.5',
        tableFontSize: 'text-xs print:text-[9px]',
        summaryPadding: 'p-3 print:p-1.5',
        summaryGap: 'gap-4 print:gap-1.5',
        signaturePadding: 'pt-4 print:pt-1.5',
        signatureGap: 'space-y-4 print:space-y-2',
      };
    }
    return {
      cardSpace: 'space-y-2 print:space-y-0.5',
      headerPadding: 'pb-2 print:pb-0.5',
      customerPadding: 'p-2 print:p-1',
      tableCellPadding: 'px-2 py-1 print:py-0.5 print:px-1',
      tableFontSize: 'text-[11px] print:text-[8px]',
      summaryPadding: 'p-2 print:p-1',
      summaryGap: 'gap-2 print:gap-1',
      signaturePadding: 'pt-2 print:pt-1',
      signatureGap: 'space-y-3 print:space-y-1.5',
    };
  };

  const sz = getSizingConfig(itemCount);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-[#F4F5F6] text-[#36454F] flex flex-col font-sans pb-16 overflow-x-hidden print:pb-0 print:min-h-0 print:bg-white"
    >
      {/* Top Action Navbar */}
      <header className="bg-[#36454F] text-white shadow-md sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/quotations"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 border border-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Quotations</span>
            </Link>
          </div>

          <div className="text-center hidden md:block">
            <span className="text-xs text-[#5C7A99] uppercase tracking-wider font-bold block">Quotation / Estimate</span>
            <span className="text-sm font-bold font-mono text-white">{quotation.quotation_no}</span>
          </div>

          <div className="flex items-center gap-2.5">
            {quotation.status !== 'converted' && (
              <button
                onClick={() => setShowConvertModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-xs"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Convert to Invoice</span>
              </button>
            )}

            <Link
              to={`/quotation/${id}/edit`}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#5C7A99] hover:bg-[#4a6480] text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-xs"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Quotation</span>
            </Link>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#F2A104] hover:bg-[#d88f00] text-[#36454F] text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Download PDF</span>
            </button>

            <button
              onClick={handleWhatsAppShare}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-xs"
              title="Share quotation via WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Share via WhatsApp</span>
            </button>

            <button
              onClick={handleEmailShare}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-xs"
              title="Share quotation via Email"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Share via Email</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Printable Quotation Document */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <div className={`bg-white rounded-2xl p-6 sm:p-10 shadow-xl border border-slate-200 ${sz.cardSpace} printable-invoice-card`}>
          
          {/* Header Block */}
          <div className={`border-b-2 border-[#36454F] ${sz.headerPadding} space-y-3 invoice-header-block print-break-avoid`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-[#36454F] text-[#F2A104] flex items-center justify-center font-black text-base shadow-xs">
                    KE
                  </div>
                  <h1 className="text-2xl font-black tracking-tight text-[#36454F] uppercase font-heading">
                    KRISHNA ENGINEERING
                  </h1>
                </div>
                <p className="text-xs text-[#5C7A99] font-medium">
                  Manufacturer of Pressure Vessels, Storage Tanks, Chemical Equipment & Heavy Fabrication
                </p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  SF No. 137, Udayampalayam Rd, Om Sakthi Nagar, Coimbatore, Tamil Nadu 641006
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  GSTIN: 33AKDPD9814C1ZN | Email: info@krishnaengineering.com | Phone: +91 94438 21192
                </p>
              </div>

              <div className="text-left sm:text-right bg-amber-50/80 p-3 rounded-xl border border-amber-200/80 shrink-0">
                <div className="text-xl font-black text-[#36454F] tracking-wide font-heading">
                  QUOTATION / ESTIMATE
                </div>
                <div className="text-xs font-mono font-bold text-[#F2A104] mt-0.5">
                  {quotation.quotation_no}
                </div>
                <div className="text-[11px] text-[#5C7A99] font-semibold mt-1">
                  Date: {quotation.quotation_date}
                </div>
                {quotation.valid_until && (
                  <div className="text-[11px] text-amber-800 font-bold mt-0.5">
                    Valid Until: {quotation.valid_until}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#F4F5F6]/60 ${sz.customerPadding} rounded-xl border border-slate-200 invoice-metadata-grid print-break-avoid`}>
            <div>
              <span className="text-[10px] font-bold text-[#5C7A99] uppercase tracking-wider block mb-1">
                Quotation For (Buyer):
              </span>
              <div className="font-bold text-sm text-[#36454F]">
                {quotation.clients?.name || 'Customer / Client'}
              </div>
              {quotation.clients?.address && (
                <div className="text-slate-600 mt-1 whitespace-pre-line leading-relaxed">
                  {quotation.clients.address}
                </div>
              )}
              {quotation.clients?.gstin && (
                <div className="font-mono font-bold text-[#5C7A99] mt-1">
                  GSTIN: {quotation.clients.gstin}
                </div>
              )}
            </div>

            <div className="space-y-1.5 sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200">
              <div>
                <span className="text-slate-500 font-medium">Status: </span>
                <span className="font-bold uppercase text-[#36454F]">{quotation.status}</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Est. Delivery Terms: </span>
                <span className="font-semibold text-[#36454F]">Ex-Works Coimbatore</span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-300 invoice-items-table print-break-avoid">
            <table className="w-full text-left">
              <thead className="bg-[#36454F] text-white uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className={`${sz.tableCellPadding} text-center w-10`}>#</th>
                  <th className={`${sz.tableCellPadding}`}>Description of Supply / Work Scope</th>
                  <th className={`${sz.tableCellPadding} text-center w-24`}>HSN/SAC</th>
                  <th className={`${sz.tableCellPadding} text-center w-16`}>Qty</th>
                  <th className={`${sz.tableCellPadding} text-right w-24`}>Rate (₹)</th>
                  <th className={`${sz.tableCellPadding} text-center w-14`}>Per</th>
                  <th className={`${sz.tableCellPadding} text-center w-14`}>Disc %</th>
                  <th className={`${sz.tableCellPadding} text-right w-28`}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-slate-200 ${sz.tableFontSize}`}>
                {lineItems.map((item, index) => (
                  <tr key={item.id || index} className="even:bg-slate-50/50">
                    <td className={`${sz.tableCellPadding} text-center font-bold text-slate-500`}>{index + 1}</td>
                    <td className={`${sz.tableCellPadding} font-semibold text-[#36454F] whitespace-pre-line`}>{item.description}</td>
                    <td className={`${sz.tableCellPadding} text-center font-mono text-slate-600`}>{item.hsn_sac || '-'}</td>
                    <td className={`${sz.tableCellPadding} text-center font-bold text-[#36454F]`}>{item.quantity}</td>
                    <td className={`${sz.tableCellPadding} text-right font-mono font-bold text-[#36454F]`}>
                      ₹ {parseFloat(item.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`${sz.tableCellPadding} text-center text-slate-600`}>{item.per || 'Nos'}</td>
                    <td className={`${sz.tableCellPadding} text-center font-mono text-slate-600`}>{item.discount || 0}%</td>
                    <td className={`${sz.tableCellPadding} text-right font-mono font-bold text-[#36454F]`}>
                      ₹ {parseFloat(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Summary */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${sz.summaryGap} pt-1 invoice-summary-block print-break-avoid`}>
            <div className="space-y-3 text-xs">
              <div className={`bg-[#F4F5F6] ${sz.summaryPadding} rounded-xl border border-slate-200 space-y-1`}>
                <span className="text-[10px] font-bold text-[#5C7A99] uppercase tracking-wider block">
                  Amount in Words:
                </span>
                <span className="font-bold text-[#36454F] block">{numberToWords(grandTotal)}</span>
              </div>

              <div className="text-[11px] text-slate-600 space-y-1 border-l-2 border-[#5C7A99] pl-3 py-1">
                <span className="font-bold text-[#36454F] block uppercase tracking-wider text-[10px]">
                  Quotation Terms & Conditions:
                </span>
                <p>1. Price Validity: This quotation is valid until {quotation.valid_until || '30 days from issue'}.</p>
                <p>2. Payment Terms: 30% advance with order, balance against dispatch.</p>
                <p>3. Taxes: GST @ 18% extra as applicable at time of invoice.</p>
                <p>4. Subject to Coimbatore Jurisdiction only.</p>
              </div>
            </div>

            <div className={`bg-[#36454F] text-white ${sz.summaryPadding} rounded-2xl shadow-sm space-y-2 text-xs self-start`}>
              <div className="flex justify-between items-center text-slate-300">
                <span>Subtotal (Taxable Value)</span>
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

              <div className="pt-2 border-t border-white/15 flex justify-between items-end">
                <span className="text-[10px] uppercase font-bold text-[#F2A104]">Estimated Grand Total</span>
                <span className="text-lg font-extrabold font-mono text-[#F2A104]">
                  ₹ {grandTotal.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Signature Footer */}
          <div className={`${sz.signaturePadding} border-t border-slate-200 flex justify-between items-end text-xs invoice-terms-signature print-break-avoid`}>
            <div className="text-slate-500 text-[10px]">
              Computer Generated Quotation · Krishna Engineering
            </div>
            <div className={`text-right ${sz.signatureGap}`}>
              <div className="font-bold text-[#36454F] uppercase">For KRISHNA ENGINEERING</div>
              <div className="border-t border-slate-400 inline-block px-8 pt-1 text-[11px] font-bold text-[#5C7A99]">
                Authorized Signatory
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Convert Modal */}
      <AnimatePresence>
        {showConvertModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200"
            >
              <div className="flex items-center gap-3 text-indigo-600">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#36454F] text-base">Convert Quotation to Invoice?</h3>
                  <p className="text-xs text-[#5C7A99]">{quotation.quotation_no}</p>
                </div>
              </div>

              <p className="text-xs text-[#5C7A99] leading-relaxed">
                This will instantly generate a new GST Tax Invoice with pre-filled line items from this quotation.
              </p>

              {convertError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
                  {convertError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConvertModal(false)}
                  disabled={isConverting}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-[#5C7A99] font-bold text-xs hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConvertQuotation}
                  disabled={isConverting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {isConverting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Converting...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck className="w-4 h-4" />
                      <span>Confirm & Create Invoice</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
