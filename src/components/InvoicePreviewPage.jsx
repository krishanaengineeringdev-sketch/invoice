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

export default function InvoicePreviewPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [invoice, setInvoice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [shareEmailData, setShareEmailData] = useState(null);
  const [error, setError] = useState(null);

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
          <div className="w-10 h-10 rounded-xl bg-[#36454F] flex items-center justify-center text-[#F2A104] font-black text-xl shadow-md">
            KE
          </div>
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

  // Calculate items and tax values for preview
  const lineItems = invoice.invoice_items || [];
  const taxableSubtotal = lineItems.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const rate = parseFloat(item.rate) || 0;
    const disc = parseFloat(item.discount) || 0;
    const amt = item.amount !== undefined && item.amount !== null && Number(item.amount) !== 0 
      ? Number(item.amount) 
      : qty * rate * (1 - disc / 100);
    return sum + amt;
  }, 0);

  const cgstAmt = invoice.cgst_amount !== undefined && invoice.cgst_amount !== null 
    ? Number(invoice.cgst_amount) 
    : taxableSubtotal * 0.09;
  const sgstAmt = invoice.sgst_amount !== undefined && invoice.sgst_amount !== null 
    ? Number(invoice.sgst_amount) 
    : taxableSubtotal * 0.09;
  const grandTotal = invoice.total_amount !== undefined && invoice.total_amount !== null 
    ? Number(invoice.total_amount) 
    : Math.round(taxableSubtotal + cgstAmt + sgstAmt);
  const roundOff = invoice.rounded_off !== undefined && invoice.rounded_off !== null 
    ? Number(invoice.rounded_off) 
    : grandTotal - (taxableSubtotal + cgstAmt + sgstAmt);
  const amountInWords = numberToWords(grandTotal);

  // Dynamic Sizing Config based on Item Count for Guaranteed A4 Single Page Fit
  const itemCount = lineItems.length;

  const getSizingConfig = (count) => {
    if (count <= 6) {
      return {
        cardSpace: 'space-y-4 print:space-y-1.5',
        headerPadding: 'pb-3 print:pb-1.5',
        gridGap: 'gap-4 print:gap-2',
        gridPadding: 'p-3.5 print:p-2',
        tableCellPadding: 'px-3 py-2 print:py-1 print:px-1.5',
        tableFontSize: 'text-xs print:text-[10px]',
        tableHeaderPadding: 'px-3 py-2 print:py-1 print:px-1.5',
        summaryGap: 'gap-4 print:gap-2',
        summaryPadding: 'p-3.5 print:p-2',
        footerPadding: 'pt-3 print:pt-1.5',
        termsFontSize: 'text-xs print:text-[9.5px]',
        signatureGap: 'space-y-6 print:space-y-3',
      };
    }
    if (count <= 12) {
      return {
        cardSpace: 'space-y-3 print:space-y-1',
        headerPadding: 'pb-2.5 print:pb-1',
        gridGap: 'gap-3 print:gap-1.5',
        gridPadding: 'p-3 print:p-1.5',
        tableCellPadding: 'px-2.5 py-1.5 print:py-0.5 print:px-1.5',
        tableFontSize: 'text-xs print:text-[9px]',
        tableHeaderPadding: 'px-2.5 py-1.5 print:py-0.5 print:px-1.5',
        summaryGap: 'gap-3 print:gap-1.5',
        summaryPadding: 'p-3 print:p-1.5',
        footerPadding: 'pt-2.5 print:pt-1',
        termsFontSize: 'text-xs print:text-[8.5px]',
        signatureGap: 'space-y-5 print:space-y-2',
      };
    }
    // Extreme case (> 12 items): Ultra-compact font size & padding (7.5pt / 7pt)
    return {
      cardSpace: 'space-y-2 print:space-y-0.5',
      headerPadding: 'pb-2 print:pb-0.5',
      gridGap: 'gap-2 print:gap-1',
      gridPadding: 'p-2 print:p-1',
      tableCellPadding: 'px-2 py-1 print:py-0.5 print:px-1',
      tableFontSize: 'text-[11px] print:text-[8px]',
      tableHeaderPadding: 'px-2 py-1 print:py-0.5 print:px-1',
      summaryGap: 'gap-2 print:gap-1',
      summaryPadding: 'p-2 print:p-1',
      footerPadding: 'pt-2 print:pt-0.5',
      termsFontSize: 'text-[11px] print:text-[7.5px]',
      signatureGap: 'space-y-3 print:space-y-1.5',
    };
  };

  const sz = getSizingConfig(itemCount);

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

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
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

      {/* Main Printable Tax Invoice Document Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        
        <div className={`bg-white rounded-2xl p-6 sm:p-10 shadow-xl border border-slate-200 ${sz.cardSpace} printable-invoice-card`}>
          
          {/* INVOICE HEADER BLOCK */}
          <div className={`border-b-2 border-[#36454F] ${sz.headerPadding} space-y-3 invoice-header-block print-break-avoid`}>
            
            {/* Top Company Info & Document Title */}
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
                <p className="text-xs text-[#5C7A99] font-medium leading-relaxed">
                  Manufacturer of Pressure Vessels, Storage Tanks, Chemical Equipment & Heavy Steel Fabrication
                </p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  SF No. 137, Udayampalayam Rd, Om Sakthi Nagar, Coimbatore, Tamil Nadu 641006
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Email: info@krishnaengineering.com | Phone: +91 94438 21192
                </p>
              </div>

              <div className="text-left sm:text-right space-y-1 shrink-0">
                <div className="inline-block bg-[#36454F] text-white px-4 py-1 rounded-lg font-bold text-xs uppercase tracking-wider shadow-xs">
                  TAX INVOICE
                </div>
                <p className="text-[11px] text-[#5C7A99] font-semibold">Rule 46 - Central Goods & Services Tax Rules, 2017</p>
                <div className="pt-0.5 text-xs font-mono font-bold text-[#36454F]">
                  <span>GSTIN: </span>
                  <span className="text-[#F2A104]">33AKDPD9814C1ZN</span>
                </div>
                <div className="text-xs font-mono text-slate-600">
                  <span>PAN: AKDPD9814C</span>
                </div>
              </div>

            </div>

          </div>

          {/* TWO-COLUMN METADATA GRID */}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${sz.gridGap} border-b border-slate-200 ${sz.headerPadding} text-xs invoice-metadata-grid print-break-avoid`}>
            
            {/* Left: Invoice & Transport Details */}
            <div className={`bg-[#F4F5F6] ${sz.gridPadding} rounded-xl border border-slate-200/80 space-y-1.5`}>
              <h3 className="font-bold text-[#5C7A99] uppercase text-[10px] tracking-wider pb-1 border-b border-slate-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#F2A104]" /> Invoice & Transport Specifications
              </h3>
              
              <div className="grid grid-cols-2 gap-y-1 text-xs font-mono">
                <span className="text-[#5C7A99] font-sans font-medium">Invoice No:</span>
                <span className="font-bold text-[#36454F]">{invoice.invoice_no}</span>

                <span className="text-[#5C7A99] font-sans font-medium">Invoice Date:</span>
                <span className="font-bold text-[#36454F]">{formatDate(invoice.invoice_date)}</span>

                <span className="text-[#5C7A99] font-sans font-medium">Buyer Order No:</span>
                <span>{invoice.buyer_order_no || 'N/A'}</span>

                <span className="text-[#5C7A99] font-sans font-medium">Order Date:</span>
                <span>{formatDate(invoice.buyer_order_date)}</span>

                <span className="text-[#5C7A99] font-sans font-medium">Payment Terms:</span>
                <span>{invoice.payment_mode || '30 Days Net'}</span>

                <span className="text-[#5C7A99] font-sans font-medium">Supplier Ref:</span>
                <span>{invoice.supplier_ref || 'N/A'}</span>

                <span className="text-[#5C7A99] font-sans font-medium">Dispatch Doc / LR:</span>
                <span>{invoice.dispatch_doc_no || 'N/A'}</span>

                <span className="text-[#5C7A99] font-sans font-medium">Dispatch Through:</span>
                <span>{invoice.dispatch_through || 'N/A'}</span>

                <span className="text-[#5C7A99] font-sans font-medium">Destination:</span>
                <span>{invoice.destination || 'N/A'}</span>
              </div>
            </div>

            {/* Right: Billed To / Buyer Details */}
            <div className={`bg-[#F4F5F6] ${sz.gridPadding} rounded-xl border border-slate-200/80 space-y-1.5 flex flex-col justify-between`}>
              <div>
                <h3 className="font-bold text-[#5C7A99] uppercase text-[10px] tracking-wider pb-1 border-b border-slate-200 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-[#F2A104]" /> Details of Receiver / Billed To
                </h3>

                <div className="pt-1.5 space-y-0.5 text-xs">
                  <div className="font-bold text-sm text-[#36454F]">
                    {invoice.clients?.name || invoice.client_name || 'Billed Customer'}
                  </div>
                  <p className="text-slate-600 leading-snug font-sans">
                    {invoice.clients?.address || 'Address details on file'}
                  </p>
                </div>
              </div>

              <div className="pt-1 border-t border-slate-200/80 mt-1 font-mono text-xs">
                <span className="text-[#5C7A99] font-sans font-medium">Buyer GSTIN: </span>
                <span className="font-bold text-[#36454F]">
                  {invoice.clients?.gstin || '24AAACL1234H1ZD'}
                </span>
              </div>
            </div>

          </div>

          {/* PARTICULAR ITEMS TABLE */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 invoice-items-table print-break-avoid">
            <table className="w-full text-left">
              <thead className="bg-[#36454F] text-white uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className={`${sz.tableHeaderPadding} text-center w-10`}>#</th>
                  <th className={`${sz.tableHeaderPadding} min-w-[200px]`}>Description of Goods</th>
                  <th className={`${sz.tableHeaderPadding} w-24 text-center`}>HSN/SAC</th>
                  <th className={`${sz.tableHeaderPadding} w-16 text-center`}>Qty</th>
                  <th className={`${sz.tableHeaderPadding} w-24 text-right`}>Rate (₹)</th>
                  <th className={`${sz.tableHeaderPadding} w-16 text-center`}>Per</th>
                  <th className={`${sz.tableHeaderPadding} w-16 text-center`}>Disc%</th>
                  <th className={`${sz.tableHeaderPadding} w-28 text-right`}>Amount (₹)</th>
                </tr>
              </thead>
              <tbody className={`divide-y divide-slate-200 bg-white ${sz.tableFontSize}`}>
                {lineItems.length > 0 ? (
                  lineItems.map((item, index) => {
                    const qty = parseFloat(item.quantity) || 0;
                    const rate = parseFloat(item.rate) || 0;
                    const disc = parseFloat(item.discount) || 0;
                    const lineAmt = item.amount !== undefined && item.amount !== null && Number(item.amount) !== 0
                      ? Number(item.amount)
                      : qty * rate * (1 - disc / 100);

                    return (
                      <tr key={item.id || index} className="hover:bg-slate-50">
                        <td className={`${sz.tableCellPadding} text-center font-bold text-[#5C7A99]`}>
                          {index + 1}
                        </td>
                        <td className={`${sz.tableCellPadding} font-medium text-[#36454F]`}>
                          {item.description}
                        </td>
                        <td className={`${sz.tableCellPadding} text-center font-mono text-slate-600`}>
                          {item.hsn_sac || item.hsn || '73090090'}
                        </td>
                        <td className={`${sz.tableCellPadding} text-center font-bold text-[#36454F]`}>
                          {qty}
                        </td>
                        <td className={`${sz.tableCellPadding} text-right font-mono text-slate-700`}>
                          {rate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className={`${sz.tableCellPadding} text-center text-[#5C7A99]`}>
                          {item.per || 'Nos'}
                        </td>
                        <td className={`${sz.tableCellPadding} text-center font-mono text-slate-600`}>
                          {disc > 0 ? `${disc}%` : '-'}
                        </td>
                        <td className={`${sz.tableCellPadding} text-right font-mono font-bold text-[#36454F]`}>
                          ₹ {lineAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="px-4 py-4 text-center text-slate-400">
                      No line items recorded for this invoice.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* SUMMARY CALCULATIONS & TAX BREAKDOWN */}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${sz.summaryGap} pt-1 invoice-summary-block print-break-avoid`}>
            
            {/* Left: Amount in Words & Bank Details */}
            <div className="space-y-2 text-xs">
              <div className={`bg-[#F4F5F6] ${sz.summaryPadding} rounded-xl border border-slate-200`}>
                <div className="font-bold text-[#5C7A99] uppercase text-[10px] tracking-wider mb-0.5">
                  Amount Chargeable in Words
                </div>
                <div className={`font-bold ${sz.termsFontSize} text-[#36454F] font-heading leading-tight`}>
                  {amountInWords}
                </div>
              </div>

              <div className={`border border-slate-200 ${sz.summaryPadding} rounded-xl space-y-0.5 text-slate-600 font-mono ${sz.termsFontSize}`}>
                <div className="font-sans font-bold text-[#36454F] text-xs pb-0.5 border-b border-slate-100 mb-0.5">
                  Bank Payment Details
                </div>
                <div>Account Name: <span className="font-bold text-[#36454F]">KRISHNA ENGINEERING</span></div>
                <div>Bank Name: <span className="font-bold text-[#36454F]">HDFC Bank Ltd (Makarpura Branch)</span></div>
                <div>Account No: <span className="font-bold text-[#36454F]">50200088991122</span></div>
                <div>IFSC Code: <span className="font-bold text-[#36454F]">HDFC0000123</span></div>
              </div>
            </div>

            {/* Right: Calculations Breakdown Box */}
            <div className={`bg-[#F4F5F6] ${sz.summaryPadding} rounded-xl border border-slate-200/80 space-y-1.5 text-xs font-mono`}>
              <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                <span className="font-sans font-medium text-[#5C7A99]">Taxable Subtotal Value:</span>
                <span className="font-bold text-[#36454F]">
                  ₹ {taxableSubtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-sans font-medium text-[#5C7A99]">CGST Output @ 9%:</span>
                <span>₹ {cgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between items-center pb-1 border-b border-slate-200">
                <span className="font-sans font-medium text-[#5C7A99]">SGST Output @ 9%:</span>
                <span>₹ {sgstAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between items-center text-slate-600">
                <span className="font-sans font-medium text-[#5C7A99]">Round-off Adjustment:</span>
                <span>{roundOff >= 0 ? `+ ₹ ${roundOff.toFixed(2)}` : `- ₹ ${Math.abs(roundOff).toFixed(2)}`}</span>
              </div>

              <div className="flex justify-between items-center text-[#36454F] font-bold bg-[#36454F] text-white p-2 rounded-lg mt-2 font-sans">
                <span className="uppercase text-[10px] tracking-wider text-[#F2A104]">Grand Total (Inc. GST):</span>
                <span className="font-mono text-base text-white">
                  ₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

          </div>

          {/* TERMS & SIGNATURE FOOTER */}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${sz.summaryGap} ${sz.footerPadding} border-t-2 border-[#36454F] text-xs invoice-terms-signature print-break-avoid`}>
            
            {/* Terms & Conditions */}
            <div className="space-y-1 text-slate-600">
              <div className="font-bold text-[#36454F] uppercase text-[10px] tracking-wider">
                Terms & Conditions:
              </div>
              <ol className={`list-decimal list-inside space-y-0.5 ${sz.termsFontSize}`}>
                <li>Goods once sold will not be taken back or exchanged.</li>
                <li>Interest @ 18% per annum will be charged on overdue payments.</li>
                <li>Our responsibility ceases immediately after goods leave premises.</li>
                <li>Subject to Coimbatore, Tamil Nadu jurisdiction only.</li>
              </ol>
            </div>

            {/* Signature Block */}
            <div className={`text-right ${sz.signatureGap} flex flex-col justify-between`}>
              <div className="font-bold text-[#36454F] uppercase text-xs">
                For KRISHNA ENGINEERING
              </div>
              <div>
                <div className="border-t border-slate-400 inline-block px-10 pt-1 font-bold text-xs text-[#36454F]">
                  Authorized Signatory / Partner
                </div>
              </div>
            </div>

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
