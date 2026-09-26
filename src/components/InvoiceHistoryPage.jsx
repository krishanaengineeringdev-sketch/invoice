import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';
import { exportInvoicesToTally } from '../utils/tallyExporter';
import { 
  Building2, 
  LogOut, 
  Download, 
  Search, 
  Filter, 
  Calendar, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Eye, 
  Pencil, 
  Printer, 
  Trash2,
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  FileSpreadsheet,
  User,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  FileText,
  X,
  MessageCircle,
  Mail
} from 'lucide-react';
import { shareViaWhatsApp, shareViaEmail } from '../utils/shareUtils';
import ShareEmailModal from './ShareEmailModal';

export default function InvoiceHistoryPage() {
  const navigate = useNavigate();
  const { displayName } = useAuth();
  const [shareEmailData, setShareEmailData] = useState(null);

  // Data & Loading States
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Deletion Modal States
  const [invoiceToDelete, setInvoiceToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Sorting State
  const [sortField, setSortField] = useState('date');
  const [sortDirection, setSortDirection] = useState('desc');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch invoices from Supabase
  const fetchInvoices = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check active auth session before executing database query
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) {
        console.error('Session error on invoice history fetch:', sessionErr);
      }
      if (!session) {
        console.warn('No active session found during invoice history fetch, redirecting to login.');
        navigate('/login', { replace: true });
        return;
      }

      let query = supabase
        .from('invoices')
        .select('*, clients(name)')
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('invoice_date', startDate);
      }
      if (endDate) {
        query = query.lte('invoice_date', endDate);
      }

      const { data, error: fetchErr } = await query;

      if (fetchErr) {
        console.error('Supabase query error in InvoiceHistory:', fetchErr);
        setError(fetchErr.message || 'Failed to fetch invoice records.');
        setInvoices([]);
      } else {
        console.log('Successfully fetched history invoices from Supabase:', data?.length || 0, 'records found.');
        setInvoices(data || []);
      }
    } catch (err) {
      console.error('Fetch exception in InvoiceHistory:', err);
      setError('Connection error while retrieving invoice history.');
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [startDate, endDate]);

  // Handle Sort Toggle
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filtered & Sorted Invoices
  const filteredAndSortedInvoices = useMemo(() => {
    return invoices
      .filter((inv) => {
        const clientName = inv.clients?.name || inv.client_name || inv.buyer_name || '';
        const invNo = inv.invoice_no || inv.id || '';

        const matchesSearch =
          clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          invNo.toLowerCase().includes(searchQuery.toLowerCase());

        const statusVal = (inv.status || '').toLowerCase();
        const filterVal = statusFilter.toLowerCase();
        const matchesStatus = statusFilter === 'All' || statusVal === filterVal;

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        let valA, valB;
        if (sortField === 'date') {
          valA = new Date(a.invoice_date || a.created_at).getTime() || 0;
          valB = new Date(b.invoice_date || b.created_at).getTime() || 0;
        } else if (sortField === 'amount') {
          valA = parseFloat(a.total_amount || a.amount) || 0;
          valB = parseFloat(b.total_amount || b.amount) || 0;
        } else if (sortField === 'invoice_no') {
          valA = a.invoice_no || '';
          valB = b.invoice_no || '';
        } else {
          valA = a[sortField] || '';
          valB = b[sortField] || '';
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
  }, [invoices, searchQuery, statusFilter, sortField, sortDirection]);

  // Pagination Math (10 rows per page)
  const totalPages = Math.ceil(filteredAndSortedInvoices.length / itemsPerPage) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedInvoices.slice(start, start + itemsPerPage);
  }, [filteredAndSortedInvoices, currentPage, itemsPerPage]);

  const handleExportTally = async () => {
    if (filteredAndSortedInvoices.length === 0) {
      setError('No invoices match the current filter to export.');
      setTimeout(() => setError(null), 4000);
      return;
    }

    setIsExporting(true);
    try {
      const targetIds = filteredAndSortedInvoices.map((inv) => inv.id);

      const { data: detailedInvoices, error: fetchErr } = await supabase
        .from('invoices')
        .select('*, clients(name, gstin), invoice_items(*)')
        .in('id', targetIds)
        .order('created_at', { ascending: false });

      if (fetchErr) {
        throw new Error(fetchErr.message || 'Failed to fetch invoice details for export.');
      }

      exportInvoicesToTally(detailedInvoices || []);
      setSuccessMessage(`Exported ${detailedInvoices?.length || 0} invoices successfully!`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Tally export error:', err);
      setError(err.message || 'Error exporting invoices to Tally Excel.');
      setTimeout(() => setError(null), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const handleReprint = (inv) => {
    navigate(`/invoice/${inv.id}`);
  };

  // Confirm and execute invoice deletion in two steps (respecting foreign key constraints)
  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    const targetId = invoiceToDelete.id;
    const targetNo = invoiceToDelete.invoice_no || targetId;

    try {
      // Step 1: Delete related line items first from invoice_items table
      const { error: itemsDelErr } = await supabase
        .from('invoice_items')
        .delete()
        .eq('invoice_id', targetId);

      if (itemsDelErr) {
        console.warn('Notice deleting line items:', itemsDelErr.message);
      }

      // Step 2: Delete invoice record from invoices table
      const { error: invoiceDelErr } = await supabase
        .from('invoices')
        .delete()
        .eq('id', targetId);

      if (invoiceDelErr) {
        throw new Error(invoiceDelErr.message || 'Failed to delete invoice record from database.');
      }

      // On success: remove from local state immediately
      setInvoices((prev) => prev.filter((inv) => inv.id !== targetId));
      setIsDeleting(false);
      setInvoiceToDelete(null);

      // Show success toast
      setSuccessMessage(`Invoice #${targetNo} deleted successfully.`);
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      console.error('Delete invoice exception:', err);
      setIsDeleting(false);
      setDeleteError(err.message || 'Error deleting invoice. Record kept in list.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="min-h-screen bg-[#F4F5F6] text-[#36454F] flex flex-col font-sans overflow-x-hidden"
    >
      
      {/* Responsive Top Navbar */}
      <Navbar activeTab="invoices" />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Success Toast Banner */}
        {successMessage && (
          <div className="bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-md flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2 text-sm font-bold">
              <CheckCircle2 className="w-5 h-5" />
              <span>{successMessage}</span>
            </div>
            <button onClick={() => setSuccessMessage('')} className="text-white opacity-80 hover:opacity-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Alert Banner */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs text-rose-800 font-medium flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>{error}</span>
            </div>
            <button onClick={fetchInvoices} className="text-rose-700 underline font-bold">
              Retry
            </button>
          </div>
        )}

        {/* Page Header: Title + Export to Tally Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#36454F] font-heading">
              Invoice History
            </h2>
            <p className="text-xs text-[#5C7A99] mt-0.5">
              Browse, search, edit, and export generated GST invoices from Supabase
            </p>
          </div>

          {/* Export to Tally Button (Steel Blue) */}
          <button
            onClick={handleExportTally}
            disabled={isExporting || isLoading}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#5C7A99] hover:bg-[#4a637d] text-white font-bold text-xs shadow-sm hover:shadow-md transition-all cursor-pointer self-start sm:self-auto active:scale-95 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#F2A104]" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4 text-[#F2A104]" />
                <span>Export to Tally</span>
              </>
            )}
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 text-xs">
            
            {/* Search Input (lg:col-span-5) */}
            <div className="lg:col-span-5 relative">
              <Search className="w-4 h-4 text-[#5C7A99] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Invoice No. or Buyer Name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-[#F4F5F6] border border-slate-200 rounded-xl text-xs text-[#36454F] placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#5C7A99]"
              />
            </div>

            {/* Date-Range Picker (lg:col-span-4) */}
            <div className="lg:col-span-4 flex items-center gap-2 bg-[#F4F5F6] p-1 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 pl-2 text-[#5C7A99] font-medium text-[11px]">
                <Calendar className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Range:</span>
              </div>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-[#36454F] focus:outline-none focus:ring-1 focus:ring-[#5C7A99]"
                title="Start Date"
              />
              <span className="text-slate-400 font-bold">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-[#36454F] focus:outline-none focus:ring-1 focus:ring-[#5C7A99]"
                title="End Date"
              />
            </div>

            {/* Status Filter Dropdown (lg:col-span-3) */}
            <div className="lg:col-span-3 flex items-center gap-2 bg-[#F4F5F6] px-3 py-1 rounded-xl border border-slate-200">
              <Filter className="w-4 h-4 text-[#5C7A99]" />
              <span className="text-xs font-semibold text-[#5C7A99]">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full py-1.5 px-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-[#36454F] focus:outline-none focus:ring-1 focus:ring-[#5C7A99] cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
            </div>

          </div>
        </div>

        {/* Mobile Card List View */}
        <div className="block md:hidden space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80 animate-pulse space-y-3">
                <div className="flex justify-between items-center">
                  <div className="h-4 bg-slate-200 rounded w-24"></div>
                  <div className="h-5 bg-slate-200 rounded-full w-16"></div>
                </div>
                <div className="h-4 bg-slate-200 rounded w-36"></div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <div className="h-4 bg-slate-200 rounded w-20"></div>
                  <div className="h-8 bg-slate-200 rounded w-24"></div>
                </div>
              </div>
            ))
          ) : paginatedInvoices.length > 0 ? (
            paginatedInvoices.map((inv) => {
              const invNo = inv.invoice_no || inv.invoice_number || inv.id || 'N/A';
              const buyerName = inv.clients?.name || inv.client_name || inv.buyer_name || 'N/A';
              const rawDate = inv.invoice_date || inv.created_at;
              const formattedDate = rawDate 
                ? new Date(rawDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
                : 'N/A';
              const amountVal = parseFloat(inv.total_amount || inv.amount || 0);
              const statusVal = inv.status || 'Pending';
              const isPaid = statusVal.toLowerCase() === 'paid';

              return (
                <div key={inv.id || invNo} className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono text-xs text-[#36454F]">#{invNo}</span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        isPaid
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isPaid ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      ></span>
                      {isPaid ? 'Paid' : 'Pending'}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-xs text-slate-800 truncate" title={buyerName}>{buyerName}</h4>
                    <div className="flex items-center justify-between text-[11px] text-[#5C7A99] mt-1">
                      <span>{formattedDate}</span>
                      <span className="font-bold font-mono text-[#36454F] text-xs">₹ {amountVal.toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => navigate(`/invoice/${inv.id}`)}
                      className="p-1.5 text-[#5C7A99] hover:text-[#36454F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="View Invoice"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/invoice/${inv.id}/edit`)}
                      className="p-1.5 text-[#5C7A99] hover:text-[#36454F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Edit Invoice"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleReprint(inv)}
                      className="p-1.5 text-[#5C7A99] hover:text-[#36454F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Reprint Invoice"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => shareViaWhatsApp({
                        type: 'Invoice',
                        number: inv.invoice_no,
                        date: inv.invoice_date,
                        amount: inv.total_amount,
                        buyerName: inv.clients?.name || inv.client_name || ''
                      })}
                      className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      title="Share via WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setShareEmailData({
                        type: 'Invoice',
                        number: inv.invoice_no,
                        date: inv.invoice_date,
                        amount: inv.total_amount,
                        buyerName: inv.clients?.name || inv.client_name || '',
                        buyerEmail: inv.clients?.email || ''
                      })}
                      className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                      title="Share via Email"
                    >
                      <Mail className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setInvoiceToDelete(inv);
                        setDeleteError(null);
                      }}
                      className="p-1.5 text-[#5C7A99] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Delete Invoice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white p-8 rounded-2xl text-center text-xs text-[#5C7A99] border border-slate-200/80">
              No invoices found.
            </div>
          )}
        </div>

        {/* Desktop Table Wrapper */}
        <div className="hidden md:block bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden space-y-0">
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#36454F] text-white uppercase text-[10px] font-bold tracking-wider select-none">
                <tr>
                  
                  {/* Invoice No Header */}
                  <th
                    onClick={() => handleSort('id')}
                    className="px-5 py-4 cursor-pointer hover:bg-slate-700/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Invoice No.</span>
                      {sortField === 'id' || sortField === 'invoice_no' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F2A104]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F2A104]" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                      )}
                    </div>
                  </th>

                  {/* Buyer Name Header */}
                  <th
                    onClick={() => handleSort('buyer')}
                    className="px-5 py-4 cursor-pointer hover:bg-slate-700/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Buyer Name</span>
                      {sortField === 'buyer' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F2A104]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F2A104]" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                      )}
                    </div>
                  </th>

                  {/* Date Header */}
                  <th
                    onClick={() => handleSort('date')}
                    className="px-5 py-4 cursor-pointer hover:bg-slate-700/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Date</span>
                      {sortField === 'date' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F2A104]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F2A104]" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                      )}
                    </div>
                  </th>

                  {/* Amount Header */}
                  <th
                    onClick={() => handleSort('amount')}
                    className="px-5 py-4 cursor-pointer hover:bg-slate-700/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Amount</span>
                      {sortField === 'amount' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F2A104]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F2A104]" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                      )}
                    </div>
                  </th>

                  {/* Status Header */}
                  <th
                    onClick={() => handleSort('status')}
                    className="px-5 py-4 cursor-pointer hover:bg-slate-700/60 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Status</span>
                      {sortField === 'status' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-[#F2A104]" /> : <ArrowDown className="w-3.5 h-3.5 text-[#F2A104]" />
                      ) : (
                        <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />
                      )}
                    </div>
                  </th>

                  {/* Action Header */}
                  <th className="px-5 py-4 text-right">
                    Actions
                  </th>

                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoading ? (
                  // Skeleton Loading Rows
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse">
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-48"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                      <td className="px-5 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                      <td className="px-5 py-4"><div className="h-5 bg-slate-200 rounded-full w-16"></div></td>
                      <td className="px-5 py-4 text-right"><div className="h-4 bg-slate-200 rounded w-16 ml-auto"></div></td>
                    </tr>
                  ))
                ) : paginatedInvoices.length > 0 ? (
                  paginatedInvoices.map((inv) => {
                    const invNo = inv.invoice_no || inv.invoice_number || inv.id || 'N/A';
                    const buyerName = inv.clients?.name || inv.client_name || inv.buyer_name || 'N/A';
                    const rawDate = inv.invoice_date || inv.created_at;
                    const formattedDate = rawDate 
                      ? new Date(rawDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
                      : 'N/A';
                    const amountVal = parseFloat(inv.total_amount || inv.amount || 0);
                    const statusVal = inv.status || 'Pending';
                    const isPaid = statusVal.toLowerCase() === 'paid';

                    return (
                      <tr key={inv.id || invNo} className="hover:bg-[#F4F5F6]/70 transition-colors">
                        
                        {/* Invoice No */}
                        <td className="px-5 py-4 font-bold font-mono text-[#36454F]">
                          {invNo}
                        </td>

                        {/* Buyer Name */}
                        <td className="px-5 py-4 font-semibold text-slate-800">
                          {buyerName}
                        </td>

                        {/* Date */}
                        <td className="px-5 py-4 text-[#5C7A99]">
                          {formattedDate}
                        </td>

                        {/* Amount */}
                        <td className="px-5 py-4 font-bold font-mono text-[#36454F]">
                          ₹ {amountVal.toLocaleString('en-IN')}
                        </td>

                        {/* Status Colored Badge */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isPaid ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                            ></span>
                            {isPaid ? 'Paid' : 'Pending'}
                          </span>
                        </td>

                        {/* Row-Level Action Icons: View, Edit, Reprint, Delete */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            
                            {/* View (Eye icon) -> /invoice/:id */}
                            <button
                              onClick={() => navigate(`/invoice/${inv.id}`)}
                              className="p-1.5 text-[#5C7A99] hover:text-[#36454F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="View Invoice"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Edit (Pencil icon) -> /invoice/:id/edit */}
                            <button
                              onClick={() => navigate(`/invoice/${inv.id}/edit`)}
                              className="p-1.5 text-[#5C7A99] hover:text-[#36454F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Edit Invoice"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                             {/* Reprint (Printer icon) */}
                            <button
                              onClick={() => handleReprint(inv)}
                              className="p-1.5 text-[#5C7A99] hover:text-[#36454F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                              title="Reprint Invoice"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {/* Share via WhatsApp */}
                            <button
                              onClick={() => shareViaWhatsApp({
                                type: 'Invoice',
                                number: inv.invoice_no,
                                date: inv.invoice_date,
                                amount: inv.total_amount,
                                buyerName: inv.clients?.name || inv.client_name || ''
                              })}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Share via WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </button>

                            {/* Share via Email */}
                            <button
                              onClick={() => setShareEmailData({
                                type: 'Invoice',
                                number: inv.invoice_no,
                                date: inv.invoice_date,
                                amount: inv.total_amount,
                                buyerName: inv.clients?.name || inv.client_name || '',
                                buyerEmail: inv.clients?.email || ''
                              })}
                              className="p-1.5 text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                              title="Share via Email"
                            >
                              <Mail className="w-4 h-4" />
                            </button>

                            {/* Delete (Trash icon) in warning red */}
                            <button
                              onClick={() => {
                                setInvoiceToDelete(inv);
                                setDeleteError(null);
                              }}
                              className="p-1.5 text-[#5C7A99] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                          </div>
                        </td>

                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-[#5C7A99]">
                      <div className="max-w-sm mx-auto space-y-2">
                        <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                        <h4 className="text-sm font-bold text-[#36454F]">No invoices found</h4>
                        <p className="text-xs text-slate-400">
                          Try adjusting your search query, status filter, or date range.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-[#F4F5F6] border-t border-slate-200 text-xs">
            <div className="text-[#5C7A99] font-medium">
              Showing <span className="font-bold text-[#36454F]">
                {filteredAndSortedInvoices.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}
              </span> to <span className="font-bold text-[#36454F]">
                {Math.min(currentPage * itemsPerPage, filteredAndSortedInvoices.length)}
              </span> of <span className="font-bold text-[#36454F]">{filteredAndSortedInvoices.length}</span> entries
            </div>

            {/* Pagination Navigation */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  currentPage === 1
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-[#36454F] border-slate-200 hover:bg-slate-50 cursor-pointer'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </button>

              {/* Page Number Buttons */}
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    currentPage === page
                      ? 'bg-[#36454F] text-[#F2A104]'
                      : 'bg-white text-[#36454F] border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  currentPage === totalPages || totalPages === 0
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-white text-[#36454F] border-slate-200 hover:bg-slate-50 cursor-pointer'
                }`}
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

      </main>

      {/* Confirmation Modal for Delete */}
      <AnimatePresence>
        {invoiceToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#36454F]/50 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-w-md w-full space-y-4"
            >
              
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-6 h-6 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#36454F] font-heading">Delete Invoice</h3>
                  <p className="text-xs text-[#5C7A99]">This action cannot be undone.</p>
                </div>
              </div>

              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl">
                  {deleteError}
                </div>
              )}

              <p className="text-xs text-[#36454F] leading-relaxed">
                Are you sure you want to delete Invoice{' '}
                <span className="font-bold font-mono text-[#36454F]">
                  #{invoiceToDelete.invoice_no || invoiceToDelete.id}
                </span>
                ? This will permanently remove the invoice and all associated line items.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setInvoiceToDelete(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[#36454F] text-xs font-bold rounded-xl transition-all duration-150 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all duration-150 hover:scale-[1.02] active:scale-95 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </>
                  )}
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-[#5C7A99]">
          © {new Date().getFullYear()} Krishna Engineering · GST Invoice Management System
        </div>
      </footer>

      {/* Email Share Modal */}
      <ShareEmailModal
        isOpen={!!shareEmailData}
        onClose={() => setShareEmailData(null)}
        shareData={shareEmailData}
      />

    </motion.div>
  );
}
