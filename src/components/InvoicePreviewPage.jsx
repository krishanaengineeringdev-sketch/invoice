import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Building2, 
  ArrowLeft, 
  Pencil, 
  Printer, 
  Download, 
  FileText, 
  ShieldCheck, 
  Calendar, 
  Truck, 
  UserCheck, 
  Loader2, 
  AlertCircle,
  CheckCircle2,
  ListOrdered,
  MessageCircle,
  Mail
} from 'lucide-react';
import { shareViaWhatsApp, shareViaEmail } from '../utils/shareUtils';
import ShareEmailModal from './ShareEmailModal';

import { numberToWords } from '../utils/numberToWords';
import { motion } from 'framer-motion';
import InvoiceTemplate from './InvoiceTemplate';

export default function InvoicePreviewPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [invoice, setInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [shareEmailData, setShareEmailData] = useState(null);
  const [error, setError] = useState(null);
  const [isFullSize, setIsFullSize] = useState(false);

  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/login', { replace: true });
          return;
        }

        const { data, error: fetchErr } = await supabase
          .from('invoices')
          .select('*, clients(name, address, gstin), invoice_items(*)')
          .eq('id', id)
          .single();

        if (fetchErr) {
          console.error('Error fetching invoice for preview:', fetchErr);
          setError(fetchErr.message || 'Failed to load invoice record.');
          setInvoice(null);
        } else {
          setInvoice(data);
        }
      } catch (err) {
        console.error('Unexpected exception loading invoice:', err);
        setError('Error connecting to database.');
        setInvoice(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchInvoiceDetails();
    } else {
      setError('Invalid Invoice ID.');
      setIsLoading(false);
    }
  }, [id, navigate]);

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    if (!invoice) return;
    shareViaWhatsApp({
      type: 'Invoice',
      number: invoice.invoice_no,
      date: formatDate(invoice.invoice_date),
      amount: invoice.total_amount,
      buyerName: invoice.clients?.name || invoice.client_name || ''
    });
  };

  const handleEmailShare = () => {
    if (!invoice) return;
    setShareEmailData({
      type: 'Invoice',
      number: invoice.invoice_no,
      date: formatDate(invoice.invoice_date),
      amount: invoice.total_amount,
      buyerName: invoice.clients?.name || invoice.client_name || '',
      buyerEmail: invoice.clients?.email || ''
    });
  };

  // Helper date formatter
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
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
          <span>Loading Invoice details...</span>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-[#F4F5F6] p-6 flex items-center justify-center text-[#36454F]">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-xl border border-slate-200 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-[#36454F]">Invoice Not Found</h2>
          <p className="text-xs text-[#5C7A99]">{error || 'The requested invoice does not exist or has been deleted.'}</p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              to="/dashboard"
              className="px-4 py-2 rounded-xl bg-[#36454F] text-white text-xs font-bold hover:bg-[#2c3840] transition-colors"
            >
              Back to Dashboard
            </Link>
            <Link
              to="/invoices"
              className="px-4 py-2 rounded-xl bg-[#F4F5F6] text-[#5C7A99] text-xs font-bold border border-slate-200 hover:bg-slate-200 transition-colors"
            >
              View History
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
      className="min-h-screen bg-[#F4F5F6] text-[#36454F] flex flex-col font-sans pb-16 print:pb-0 print:min-h-0 print:bg-white"
    >
      
      {/* Action Header Navbar (Hidden on Print) */}
      <header className="bg-[#36454F] text-white shadow-md sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Left Navigation Links */}
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 border border-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Dashboard</span>
            </Link>
            <Link
              to="/invoices"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 border border-white/10 hidden sm:inline-flex"
            >
              <span>Invoice History</span>
            </Link>
            <Link
              to="/materials"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 border border-white/10 hidden sm:inline-flex"
            >
              <span>Materials</span>
            </Link>
          </div>

          {/* Center Title */}
          <div className="text-center hidden md:block">
            <span className="text-xs text-[#5C7A99] uppercase tracking-wider font-bold block">Viewing GST Invoice</span>
            <span className="text-sm font-bold font-mono text-white">{invoice.invoice_no}</span>
          </div>

          {/* Mobile Invoice Number Badge */}
          <div className="md:hidden text-right">
            <span className="text-xs font-bold font-mono text-[#F2A104] bg-white/10 px-2.5 py-1 rounded-lg">
              {invoice.invoice_no}
            </span>
          </div>

          {/* Desktop Right Action Buttons */}
          <div className="hidden md:flex items-center gap-2.5">
            <button
              onClick={() => navigate(`/invoice/${id}/edit`)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#5C7A99] hover:bg-[#4a6480] text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-xs"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Invoice</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#F2A104] hover:bg-[#d88f00] text-[#36454F] text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Download PDF / Print</span>
            </button>
            <button
              onClick={handleWhatsAppShare}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-xs"
              title="Share invoice summary via WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Share via WhatsApp</span>
            </button>
            <button
              onClick={handleEmailShare}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-xs"
              title="Share invoice summary via Email"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Share via Email</span>
            </button>
          </div>

        </div>
      </header>

      {/* Mobile Action Buttons 2x2 Grid (Visible only on < md screens) */}
      <div className="md:hidden max-w-6xl w-full mx-auto px-3 pt-3 print:hidden">
        <div className="grid grid-cols-2 gap-2 bg-white p-3 rounded-2xl shadow-xs border border-slate-200/80">
          <button
            onClick={() => navigate(`/invoice/${id}/edit`)}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#5C7A99] hover:bg-[#4a6480] text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit Invoice</span>
          </button>
          <button
            onClick={handlePrint}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#F2A104] hover:bg-[#d88f00] text-[#36454F] text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
          <button
            onClick={handleWhatsAppShare}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
            title="Share invoice summary via WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </button>
          <button
            onClick={handleEmailShare}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
            title="Share invoice summary via Email"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email</span>
          </button>
        </div>
      </div>

      {/* Mobile View Mode Hint & Toggle (Fit to Screen vs Actual Size) */}
      <div className="md:hidden max-w-6xl w-full mx-auto px-4 pt-2.5 flex items-center justify-between text-[11px] text-[#5C7A99] print:hidden">
        <span className="font-semibold">
          {isFullSize ? 'Viewing: 100% Full Size (Scrollable)' : 'Viewing: Scaled to Screen'}
        </span>
        <button
          type="button"
          onClick={() => setIsFullSize(!isFullSize)}
          className="font-bold text-[#36454F] hover:text-[#F2A104] bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs cursor-pointer min-h-[36px] flex items-center gap-1 active:scale-95 transition-all"
        >
          {isFullSize ? 'Fit to Screen' : '100% Full Size'}
        </button>
      </div>

      {/* Main Printable Tax Invoice Document Container */}
      <main className="flex-1 w-full mx-auto p-2 sm:p-6 lg:p-8 print:p-0">
        <div className="w-full overflow-x-auto md:overflow-visible flex justify-center">
          <div className={`invoice-scale-wrapper ${isFullSize ? 'full-size' : ''}`}>
            <InvoiceTemplate data={invoice} type="invoice" />
          </div>
        </div>
      </main>

      {/* Email Share Modal */}
      <ShareEmailModal
        isOpen={!!shareEmailData}
        onClose={() => setShareEmailData(null)}
        shareData={shareEmailData}
      />

    </motion.div>
  );
}
