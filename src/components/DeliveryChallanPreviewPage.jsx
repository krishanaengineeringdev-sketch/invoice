import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  ArrowLeft, 
  Pencil, 
  Printer, 
  Truck, 
  Loader2, 
  AlertCircle,
  FileCheck,
  MessageCircle,
  Mail
} from 'lucide-react';
import { shareViaWhatsApp } from '../utils/shareUtils';
import ShareEmailModal from './ShareEmailModal';
import { motion } from 'framer-motion';
import InvoiceTemplate from './InvoiceTemplate';

export default function DeliveryChallanPreviewPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [challan, setChallan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shareEmailData, setShareEmailData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchChallanDetails = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/login', { replace: true });
          return;
        }

        const { data, error: fetchErr } = await supabase
          .from('delivery_challans')
          .select('*, clients(*), delivery_challan_items(*)')
          .eq('id', id)
          .single();

        if (fetchErr || !data) {
          console.error('Error fetching delivery challan for preview:', fetchErr);
          setError(fetchErr?.message || 'Failed to load delivery challan record.');
          setChallan(null);
        } else {
          setChallan(data);
        }
      } catch (err) {
        console.error('Unexpected exception loading delivery challan:', err);
        setError('Error connecting to database.');
        setChallan(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchChallanDetails();
    } else {
      setError('Invalid Delivery Challan ID.');
      setIsLoading(false);
    }
  }, [id, navigate]);

  const handlePrint = () => {
    window.print();
  };

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

  const handleWhatsAppShare = () => {
    if (!challan) return;
    const itemCount = challan.delivery_challan_items?.length || 0;
    shareViaWhatsApp({
      type: 'Delivery Challan',
      number: challan.challan_no,
      date: formatDate(challan.challan_date),
      amount: `${itemCount} Item(s) (${challan.purpose || 'Job Work'})`,
      buyerName: challan.clients?.name || ''
    });
  };

  const handleEmailShare = () => {
    if (!challan) return;
    const itemCount = challan.delivery_challan_items?.length || 0;
    setShareEmailData({
      type: 'Delivery Challan',
      number: challan.challan_no,
      date: formatDate(challan.challan_date),
      amount: `${itemCount} Item(s) (${challan.purpose || 'Job Work'})`,
      buyerName: challan.clients?.name || '',
      buyerEmail: challan.clients?.email || ''
    });
  };

  const handleConvertToInvoice = () => {
    if (!challan) return;
    navigate(`/invoice/new?challanId=${challan.id}`);
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
          <span>Loading Delivery Challan...</span>
        </div>
      </div>
    );
  }

  if (error || !challan) {
    return (
      <div className="min-h-screen bg-[#F4F5F6] p-6 flex items-center justify-center text-[#36454F]">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-xl border border-slate-200 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-xl font-bold text-[#36454F]">Delivery Challan Not Found</h2>
          <p className="text-xs text-[#5C7A99]">{error || 'The requested challan does not exist or has been deleted.'}</p>
          <div className="pt-2 flex justify-center gap-3">
            <Link
              to="/challans"
              className="px-4 py-2 rounded-xl bg-[#36454F] text-white text-xs font-bold hover:bg-[#2c3840] transition-colors"
            >
              Delivery Challan List
            </Link>
            <Link
              to="/dashboard"
              className="px-4 py-2 rounded-xl bg-[#F4F5F6] text-[#5C7A99] text-xs font-bold border border-slate-200 hover:bg-slate-200 transition-colors"
            >
              Back to Dashboard
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
              to="/challans"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 border border-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Challans</span>
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 border border-white/10 hidden sm:inline-flex"
            >
              <span>Dashboard</span>
            </Link>
            <Link
              to="/invoices"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 border border-white/10 hidden sm:inline-flex"
            >
              <span>Invoices</span>
            </Link>
          </div>

          {/* Center Title */}
          <div className="text-center hidden md:block">
            <span className="text-xs text-[#5C7A99] uppercase tracking-wider font-bold block flex items-center justify-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-[#F2A104]" />
              <span>Delivery Challan</span>
            </span>
            <span className="text-sm font-bold font-mono text-white">{challan.challan_no}</span>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Convert to Invoice */}
            {challan.status !== 'converted' && (
              <button
                onClick={handleConvertToInvoice}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-xs"
                title="Convert to GST Tax Invoice"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Convert to Invoice</span>
              </button>
            )}

            {/* Edit Challan */}
            <button
              onClick={() => navigate(`/challan/${id}/edit`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5C7A99] hover:bg-[#4a6480] text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-xs"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>

            {/* Print / Download */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#F2A104] hover:bg-[#d88f00] text-[#36454F] text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Download PDF / Print</span>
            </button>

            {/* WhatsApp */}
            <button
              onClick={handleWhatsAppShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-xs hidden sm:inline-flex"
              title="Share summary via WhatsApp"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            {/* Email */}
            <button
              onClick={handleEmailShare}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer shadow-xs hidden sm:inline-flex"
              title="Share summary via Email"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Printable Delivery Challan Document Container */}
      <main className="flex-1 w-full mx-auto p-4 sm:p-6 lg:p-8 print:p-0 flex justify-center overflow-x-auto">
        <div className="invoice-preview-shell">
          <InvoiceTemplate data={challan} type="challan" />
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
