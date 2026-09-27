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
import InvoiceTemplate from './InvoiceTemplate';

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
          <img src="/logo.png" alt="Krishna Engineering" className="w-10 h-10 object-contain rounded-xl shadow-md bg-white p-0.5" />
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
      <main className="flex-1 w-full mx-auto p-4 sm:p-6 lg:p-8 print:p-0 flex justify-center overflow-x-auto">
        <div className="invoice-preview-shell">
          <InvoiceTemplate data={quotation} type="quotation" />
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

      {/* Email Share Modal */}
      <ShareEmailModal
        isOpen={!!shareEmailData}
        onClose={() => setShareEmailData(null)}
        shareData={shareEmailData}
      />

    </motion.div>
  );
}
