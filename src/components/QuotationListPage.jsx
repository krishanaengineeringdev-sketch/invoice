import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  Pencil, 
  Trash2, 
  FileCheck, 
  ArrowRight,
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2,
  Calendar,
  Building2,
  RefreshCw,
  Sparkles,
  MessageCircle,
  Mail
} from 'lucide-react';
import { shareViaWhatsApp, shareViaEmail } from '../utils/shareUtils';
import ShareEmailModal from './ShareEmailModal';

export default function QuotationListPage() {
  const navigate = useNavigate();
  const [shareEmailData, setShareEmailData] = useState(null);

  // State Management
  const [quotations, setQuotations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // Convert & Delete Modals State
  const [quotationToDelete, setQuotationToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const [quotationToConvert, setQuotationToConvert] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState(null);

  // Fetch Quotations from Supabase
  const fetchQuotations = async () => {
    setIsLoading(true);
    setFetchError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      const { data, error } = await supabase
        .from('quotations')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching quotations:', error);
        setFetchError(error.message || 'Failed to fetch quotations.');
        setQuotations([]);
      } else {
        setQuotations(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching quotations:', err);
      setFetchError('Connection error while fetching quotations.');
      setQuotations([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  // Filtered Quotations
  const filteredQuotations = quotations.filter((q) => {
    const qNo = (q.quotation_no || '').toLowerCase();
    const clientName = (q.clients?.name || '').toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    const matchesSearch = !query || qNo.includes(query) || clientName.includes(query);
    const matchesStatus = filterStatus === 'All' || (q.status || 'draft').toLowerCase() === filterStatus.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // Calculate Metrics
  const totalQuotations = quotations.length;
  const activeQuotations = quotations.filter((q) => q.status === 'draft' || q.status === 'sent').length;
  const convertedQuotations = quotations.filter((q) => q.status === 'converted').length;
  const totalQuotedValue = quotations.reduce((sum, q) => sum + (parseFloat(q.total_amount) || 0), 0);

  // Handle Delete Quotation
  const handleConfirmDelete = async () => {
    if (!quotationToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const { error } = await supabase
        .from('quotations')
        .delete()
        .eq('id', quotationToDelete.id);

      if (error) {
        throw new Error(error.message || 'Failed to delete quotation.');
      }

      setQuotations((prev) => prev.filter((item) => item.id !== quotationToDelete.id));
      setQuotationToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
      setDeleteError(err.message || 'Error deleting quotation.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Convert Quotation to Invoice Handler
  const handleConvertQuotation = async (quotation) => {
    setIsConverting(true);
    setConvertError(null);

    try {
      // 1. Fetch full quotation items
      const { data: fullQuotation, error: qErr } = await supabase
        .from('quotations')
        .select('*, quotation_items(*)')
        .eq('id', quotation.id)
        .single();

      if (qErr || !fullQuotation) {
        throw new Error(qErr?.message || 'Could not fetch quotation details.');
      }

      // 2. Generate new Financial Year Invoice Number
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

      // 3. Prepare Invoice Payload
      const invoicePayload = {
        invoice_no: newInvoiceNo,
        invoice_date: new Date().toISOString().split('T')[0],
        client_id: fullQuotation.client_id,
        cgst_amount: fullQuotation.cgst_amount || 0,
        sgst_amount: fullQuotation.sgst_amount || 0,
        rounded_off: fullQuotation.rounded_off || 0,
        total_amount: fullQuotation.total_amount || 0,
        status: 'pending',
        payment_mode: '30 Days Net'
      };

      // Try adding quotation_id if column exists
      try {
        invoicePayload.quotation_id = fullQuotation.id;
      } catch {}

      // 4. Insert into Invoices table
      let { data: newInvoice, error: invInsertErr } = await supabase
        .from('invoices')
        .insert(invoicePayload)
        .select()
        .single();

      if (invInsertErr && invInsertErr.code === '42703') {
        // Fallback if quotation_id column doesn't exist in DB schema yet
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
        throw new Error(invInsertErr?.message || 'Failed to create invoice from quotation.');
      }

      // 5. Copy quotation items to invoice_items
      const qItems = fullQuotation.quotation_items || [];
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

      // 6. Update Quotation status to 'converted'
      await supabase
        .from('quotations')
        .update({ status: 'converted' })
        .eq('id', fullQuotation.id);

      setQuotationToConvert(null);
      setIsConverting(false);

      // 7. Navigate to the newly created invoice edit/view page
      navigate(`/invoice/${newInvoice.id}/edit`);
    } catch (err) {
      console.error('Convert quotation exception:', err);
      setConvertError(err.message || 'Error converting quotation to invoice.');
      setIsConverting(false);
    }
  };

  // Helper Badge Color
  const getStatusBadge = (status) => {
    switch ((status || 'draft').toLowerCase()) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
            <Clock className="w-3 h-3 text-sky-600" /> Sent
          </span>
        );
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Accepted
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" /> Rejected
          </span>
        );
      case 'converted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
            <FileCheck className="w-3 h-3 text-indigo-600" /> Converted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
            Draft
          </span>
        );
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="min-h-screen bg-[#F4F5F6] text-[#36454F] flex flex-col font-sans pb-16 overflow-x-hidden"
    >
      <Navbar activeTab="quotations" />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-xs border border-slate-200/80">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-[#F2A104] flex items-center justify-center border border-amber-200/60 shadow-2xs">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#36454F] font-heading">
                Quotations & Estimates
              </h1>
              <p className="text-xs text-[#5C7A99] font-medium">
                Manage pre-sale quotes, validity dates & convert directly into official GST Tax Invoices
              </p>
            </div>
          </div>

          <Link
            to="/quotations/new"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#F2A104] hover:bg-[#d88f00] text-[#36454F] font-extrabold text-xs shadow-md hover:shadow-lg transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Quotation</span>
          </Link>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="text-[11px] font-bold text-[#5C7A99] uppercase tracking-wider">Total Quotations</div>
            <div className="text-2xl font-extrabold text-[#36454F] font-heading mt-1">{totalQuotations}</div>
            <div className="text-[11px] text-slate-400 mt-1">Generated estimates</div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="text-[11px] font-bold text-[#5C7A99] uppercase tracking-wider">Active / Pending</div>
            <div className="text-2xl font-extrabold text-sky-700 font-heading mt-1">{activeQuotations}</div>
            <div className="text-[11px] text-slate-400 mt-1">Draft or sent quotes</div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="text-[11px] font-bold text-[#5C7A99] uppercase tracking-wider">Converted</div>
            <div className="text-2xl font-extrabold text-indigo-700 font-heading mt-1">{convertedQuotations}</div>
            <div className="text-[11px] text-slate-400 mt-1">Converted to Tax Invoice</div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200/80 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="text-[11px] font-bold text-[#5C7A99] uppercase tracking-wider">Total Quoted Value</div>
            <div className="text-2xl font-extrabold text-[#F2A104] font-heading mt-1">
              ₹ {totalQuotedValue.toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Total estimated revenue</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-[#5C7A99] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Quotation No. or Buyer Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#F4F5F6] border border-slate-200 rounded-xl text-xs font-medium text-[#36454F] focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            {['All', 'draft', 'sent', 'accepted', 'rejected', 'converted'].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer whitespace-nowrap ${
                  filterStatus.toLowerCase() === status.toLowerCase()
                    ? 'bg-[#36454F] text-white shadow-xs'
                    : 'bg-[#F4F5F6] text-[#5C7A99] hover:bg-slate-200 hover:text-[#36454F]'
                }`}
              >
                {status}
              </button>
            ))}
            <button
              onClick={fetchQuotations}
              className="p-2 rounded-xl bg-[#F4F5F6] text-[#5C7A99] hover:text-[#36454F] transition-colors ml-1"
              title="Refresh list"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {fetchError && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{fetchError}</span>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-xs border border-slate-200 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#F2A104] mx-auto" />
            <p className="text-xs font-semibold text-[#5C7A99]">Loading Quotations...</p>
          </div>
        ) : filteredQuotations.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-xs border border-slate-200 space-y-3">
            <ClipboardList className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-[#36454F]">No Quotations Found</h3>
            <p className="text-xs text-[#5C7A99] max-w-sm mx-auto">
              {searchQuery || filterStatus !== 'All' 
                ? 'No quotations match your current search criteria or status filter.'
                : 'You have not created any pre-sale quotations yet. Click below to create your first estimate.'}
            </p>
            {!searchQuery && filterStatus === 'All' && (
              <Link
                to="/quotations/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F2A104] text-[#36454F] font-bold text-xs shadow-md hover:bg-[#d88f00] transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Create Quotation</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
            
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#36454F] text-white uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Quotation No.</th>
                    <th className="px-5 py-3.5">Buyer Name</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Valid Until</th>
                    <th className="px-5 py-3.5 text-right">Amount (₹)</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                    <th className="px-5 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredQuotations.map((item) => (
                    <tr key={item.id} className="hover:bg-[#F4F5F6]/60 transition-colors">
                      <td className="px-5 py-4 font-mono font-bold text-[#36454F]">
                        {item.quotation_no}
                      </td>

                      <td className="px-5 py-4 font-bold text-[#36454F]">
                        {item.clients?.name || 'Walk-in Customer'}
                      </td>

                      <td className="px-5 py-4 text-[#5C7A99] font-medium">
                        {item.quotation_date || 'N/A'}
                      </td>

                      <td className="px-5 py-4 text-[#5C7A99] font-medium">
                        {item.valid_until ? (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-amber-500" />
                            {item.valid_until}
                          </span>
                        ) : (
                          'N/A'
                        )}
                      </td>

                      <td className="px-5 py-4 text-right font-mono font-bold text-[#36454F]">
                        ₹ {parseFloat(item.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="px-5 py-4 text-center">
                        {getStatusBadge(item.status)}
                      </td>

                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            to={`/quotation/${item.id}`}
                            className="p-1.5 rounded-lg text-[#5C7A99] hover:bg-slate-100 hover:text-[#36454F] transition-colors"
                            title="View / Print Quotation"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>

                          <Link
                            to={`/quotation/${item.id}/edit`}
                            className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition-colors"
                            title="Edit Quotation"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => shareViaWhatsApp({
                              type: 'Quotation',
                              number: item.quotation_no,
                              date: item.quotation_date,
                              amount: item.total_amount,
                              buyerName: item.clients?.name || ''
                            })}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="Share via WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setShareEmailData({
                              type: 'Quotation',
                              number: item.quotation_no,
                              date: item.quotation_date,
                              amount: item.total_amount,
                              buyerName: item.clients?.name || '',
                              buyerEmail: item.clients?.email || ''
                            })}
                            className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                            title="Share via Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          {item.status !== 'converted' && (
                            <button
                              onClick={() => setQuotationToConvert(item)}
                              className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                              title="Convert to Tax Invoice"
                            >
                              <ArrowRight className="w-3 h-3" />
                              <span>Convert</span>
                            </button>
                          )}

                          <button
                            onClick={() => setQuotationToDelete(item)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Quotation"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Card View */}
            <div className="md:hidden divide-y divide-slate-200">
              {filteredQuotations.map((item) => (
                <div key={item.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-xs text-[#36454F]">{item.quotation_no}</span>
                    {getStatusBadge(item.status)}
                  </div>

                  <div className="space-y-1">
                    <div className="font-bold text-sm text-[#36454F]">{item.clients?.name || 'Walk-in Customer'}</div>
                    <div className="text-xs text-[#5C7A99] flex items-center gap-3">
                      <span>Date: {item.quotation_date}</span>
                      {item.valid_until && <span>Valid: {item.valid_until}</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="text-sm font-extrabold font-mono text-[#36454F]">
                      ₹ {parseFloat(item.total_amount || 0).toLocaleString('en-IN')}
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        to={`/quotation/${item.id}`}
                        className="px-3 py-1.5 rounded-lg bg-[#F4F5F6] text-[#36454F] font-bold text-xs"
                      >
                        View
                      </Link>

                      <button
                        onClick={() => shareViaWhatsApp({
                          type: 'Quotation',
                          number: item.quotation_no,
                          date: item.quotation_date,
                          amount: item.total_amount,
                          buyerName: item.clients?.name || ''
                        })}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                        title="Share via WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setShareEmailData({
                          type: 'Quotation',
                          number: item.quotation_no,
                          date: item.quotation_date,
                          amount: item.total_amount,
                          buyerName: item.clients?.name || '',
                          buyerEmail: item.clients?.email || ''
                        })}
                        className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                        title="Share via Email"
                      >
                        <Mail className="w-4 h-4" />
                      </button>

                      {item.status !== 'converted' && (
                        <button
                          onClick={() => setQuotationToConvert(item)}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-bold text-xs"
                        >
                          Convert
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

      </main>

      {/* Convert Confirmation Modal */}
      <AnimatePresence>
        {quotationToConvert && (
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
                  <h3 className="font-bold text-[#36454F] text-base">Convert to GST Tax Invoice?</h3>
                  <p className="text-xs text-[#5C7A99]">Quotation No: {quotationToConvert.quotation_no}</p>
                </div>
              </div>

              <p className="text-xs text-[#5C7A99] leading-relaxed">
                This action will automatically generate a new official GST Tax Invoice pre-filled with this quotation's buyer details and line items, and mark this quotation as <strong>Converted</strong>.
              </p>

              {convertError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
                  {convertError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setQuotationToConvert(null)}
                  disabled={isConverting}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-[#5C7A99] font-bold text-xs hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConvertQuotation(quotationToConvert)}
                  disabled={isConverting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all duration-150 hover:scale-[1.02] active:scale-95 flex items-center gap-2 cursor-pointer"
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

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {quotationToDelete && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-[#36454F] text-base">Delete Quotation?</h3>
                  <p className="text-xs text-[#5C7A99]">{quotationToDelete.quotation_no}</p>
                </div>
              </div>

              <p className="text-xs text-[#5C7A99]">
                Are you sure you want to delete this quotation? This action cannot be undone.
              </p>

              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-semibold">
                  {deleteError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setQuotationToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-[#5C7A99] font-bold text-xs hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all duration-150 hover:scale-[1.02] active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete Permanently</span>
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
