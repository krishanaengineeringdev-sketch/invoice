import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './Navbar';
import { 
  Building2, 
  LogOut, 
  Package, 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  User, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  X,
  FileText,
  Boxes
} from 'lucide-react';

export default function MaterialsPage() {
  const navigate = useNavigate();
  const { displayName, signOut: authSignOut } = useAuth();

  // State Management
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [formError, setFormError] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [hsnSac, setHsnSac] = useState('73090090');
  const [defaultRate, setDefaultRate] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('Nos');

  // Delete State
  const [materialToDelete, setMaterialToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch materials from Supabase on mount
  const fetchMaterials = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      const { data, error: fetchErr } = await supabase
        .from('materials')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) {
        console.warn('Supabase materials fetch notice:', fetchErr.message);
        setError(fetchErr.message || 'Failed to retrieve materials list.');
        setMaterials([]);
      } else {
        setMaterials(data || []);
      }
    } catch (err) {
      console.error('Unexpected error fetching materials:', err);
      setError('Connection error while fetching materials.');
      setMaterials([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, [navigate]);

  // Open modal for Create
  const handleOpenCreateModal = () => {
    setEditingMaterial(null);
    setName('');
    setHsnSac('73090090');
    setDefaultRate('');
    setDefaultUnit('Nos');
    setModalError('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEditModal = (mat) => {
    setEditingMaterial(mat);
    setName(mat.name || '');
    setHsnSac(mat.hsn_sac || '73090090');
    setDefaultRate(mat.default_rate !== undefined && mat.default_rate !== null ? mat.default_rate : '');
    setDefaultUnit(mat.default_unit || 'Nos');
    setModalError('');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Handle Save (Create or Update)
  const handleSaveMaterial = async (e) => {
    e.preventDefault();
    setModalError('');
    setFormError(null);

    if (!name.trim()) {
      const errMsg = 'Material / Product Name is required.';
      setModalError(errMsg);
      setFormError(errMsg);
      return;
    }

    const rateNum = parseFloat(defaultRate);
    const safeRate = !isNaN(rateNum) && rateNum >= 0 ? rateNum : 0;

    setIsSaving(true);

    try {
      const payload = {
        name: name.trim(),
        hsn_sac: hsnSac.trim() || '73090090',
        default_rate: safeRate,
        default_unit: defaultUnit || 'Nos'
      };

      if (editingMaterial) {
        // UPDATE existing material
        const { error: updateErr } = await supabase
          .from('materials')
          .update(payload)
          .eq('id', editingMaterial.id);

        if (updateErr) {
          console.error('Error updating material:', updateErr);
          throw new Error(updateErr.message || 'Failed to update material.');
        }

        setSuccessMsg(`Material "${payload.name}" updated successfully.`);
      } else {
        // INSERT new material
        const { error: insertErr } = await supabase
          .from('materials')
          .insert([payload]);

        if (insertErr) {
          console.error('Error adding material:', insertErr);
          throw new Error(insertErr.message || 'Failed to add new material.');
        }

        setSuccessMsg(`Material "${payload.name}" added to catalog.`);
      }

      setFormError(null);
      setIsModalOpen(false);
      fetchMaterials();

      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      const errMsg = err.message || 'An error occurred while saving.';
      setModalError(errMsg);
      setFormError(errMsg);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Delete
  const handleConfirmDelete = async () => {
    if (!materialToDelete) return;

    setIsDeleting(true);

    try {
      const { error: delErr } = await supabase
        .from('materials')
        .delete()
        .eq('id', materialToDelete.id);

      if (delErr) {
        console.error('Error deleting material:', delErr);
        setError('Failed to delete material: ' + delErr.message);
      } else {
        setSuccessMsg(`Material "${materialToDelete.name}" deleted.`);
        setMaterialToDelete(null);
        fetchMaterials();
        setTimeout(() => setSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.error('Exception deleting material:', err);
      setError('An error occurred while deleting.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Seed sample materials if catalog is empty


  // Logout Handler
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Signout error:', err);
    } finally {
      navigate('/login', { replace: true });
    }
  };

  // Filtered materials by search
  const filteredMaterials = useMemo(() => {
    return materials.filter((mat) => {
      const matName = (mat.name || '').toLowerCase();
      const hsn = (mat.hsn_sac || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      return matName.includes(query) || hsn.includes(query);
    });
  }, [materials, searchQuery]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="min-h-screen bg-[#F4F5F6] text-[#36454F] flex flex-col font-sans overflow-x-hidden"
    >
      
      {/* Responsive Top Navbar */}
      <Navbar activeTab="materials" />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Success Alert Banner */}
        {successMsg && (
          <div className="bg-emerald-500 text-white px-5 py-3 rounded-xl shadow-md flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-2 text-sm font-bold">
              <CheckCircle2 className="w-5 h-5" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg('')} className="text-white/80 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Alert Banner */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 px-5 py-3 rounded-xl shadow-xs flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-rose-700 font-bold">Dismiss</button>
          </div>
        )}

        {/* Header Title Card */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-[#F2A104] flex items-center justify-center border border-amber-200/60">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[#36454F] font-heading">
                Materials & Products Catalog
              </h2>
              <p className="text-xs text-[#5C7A99] font-medium">
                Manage reusable materials to pre-fill descriptions, HSN codes, and rates on invoices
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F2A104] hover:bg-[#d88f00] text-[#36454F] font-bold text-xs shadow-md transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Material</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by material name or HSN code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#F4F5F6] border border-slate-200 rounded-xl text-xs font-medium text-[#36454F] focus:bg-white focus:ring-2 focus:ring-[#5C7A99] focus:outline-none"
            />
          </div>

          <div className="text-xs text-[#5C7A99] font-semibold self-end sm:self-center">
            Total Items: <span className="font-bold text-[#36454F]">{filteredMaterials.length}</span>
          </div>
        </div>

        {/* Materials Table Section */}
        <section className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#36454F] text-white uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 text-center w-12">#</th>
                  <th className="px-5 py-3.5 min-w-[280px]">Material / Product Name</th>
                  <th className="px-4 py-3.5 w-32 text-center">HSN/SAC</th>
                  <th className="px-4 py-3.5 w-32 text-right">Default Rate (₹)</th>
                  <th className="px-4 py-3.5 w-24 text-center">Unit</th>
                  <th className="px-5 py-3.5 text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-[#5C7A99]">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-[#F2A104]" />
                        <span className="font-semibold">Loading materials catalog...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredMaterials.length > 0 ? (
                  filteredMaterials.map((mat, index) => (
                    <tr key={mat.id || index} className="hover:bg-[#F4F5F6]/50 transition-colors">
                      
                      {/* Index */}
                      <td className="px-4 py-4 text-center font-bold text-[#5C7A99]">
                        {index + 1}
                      </td>

                      {/* Material Name */}
                      <td className="px-5 py-4 font-bold text-[#36454F]">
                        {mat.name}
                      </td>

                      {/* HSN/SAC */}
                      <td className="px-4 py-4 text-center font-mono font-medium text-slate-600">
                        {mat.hsn_sac || '73090090'}
                      </td>

                      {/* Default Rate */}
                      <td className="px-4 py-4 text-right font-mono font-bold text-[#36454F]">
                        ₹ {parseFloat(mat.default_rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Default Unit */}
                      <td className="px-4 py-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-[#5C7A99] border border-slate-200">
                          {mat.default_unit || 'Nos'}
                        </span>
                      </td>

                      {/* Action Buttons */}
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(mat)}
                            className="p-1.5 text-[#5C7A99] hover:text-[#36454F] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Material"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setMaterialToDelete(mat)}
                            className="p-1.5 text-[#5C7A99] hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete Material"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))
                ) : (
                  /* Empty State */
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-[#5C7A99]">
                      <div className="max-w-md mx-auto space-y-3">
                        <Boxes className="w-10 h-10 text-slate-300 mx-auto" />
                        <h4 className="text-sm font-bold text-[#36454F]">No materials in catalog</h4>
                        <p className="text-xs text-slate-400">
                          {searchQuery
                            ? 'No materials match your search query.'
                            : 'Add standard products/materials to populate invoice items automatically.'}
                        </p>
                        <div className="pt-2 flex justify-center gap-3">
                          <button
                            onClick={handleOpenCreateModal}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F2A104] text-[#36454F] font-bold text-xs shadow-sm hover:bg-[#d88f00] transition-colors cursor-pointer"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Add First Material</span>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Materials Stacked Card List View (Visible on < md screens) */}
          <div className="block md:hidden space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200 animate-pulse space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-36"></div>
                  <div className="h-4 bg-slate-200 rounded w-20"></div>
                </div>
              ))
            ) : filteredMaterials.length > 0 ? (
              filteredMaterials.map((mat, index) => (
                <div key={mat.id || index} className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                    <h4 className="font-bold text-sm text-[#36454F]">{mat.name}</h4>
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-[#5C7A99] border border-slate-200">
                      {mat.default_unit || 'Nos'}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#5C7A99]">HSN/SAC:</span>
                      <span className="font-mono text-slate-700">{mat.hsn_sac || '73090090'}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-100 mt-1">
                      <span className="text-[#5C7A99]">Default Rate:</span>
                      <span className="font-bold font-mono text-sm text-[#36454F]">₹ {parseFloat(mat.default_rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleOpenEditModal(mat)}
                      className="flex-1 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#36454F] text-xs font-bold flex items-center justify-center gap-1 min-h-[44px] cursor-pointer"
                    >
                      <Pencil className="w-4 h-4 text-[#5C7A99]" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setMaterialToDelete(mat)}
                      className="flex-1 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold flex items-center justify-center gap-1 min-h-[44px] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-[#5C7A99] bg-white rounded-xl border border-slate-200">
                <Boxes className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-[#36454F]">No materials in catalog</p>
                <button
                  onClick={handleOpenCreateModal}
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F2A104] text-[#36454F] font-bold text-xs shadow-sm hover:bg-[#d88f00] transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Material</span>
                </button>
              </div>
            )}
          </div>
        </section>

      </main>
      {/* CREATE / EDIT MATERIAL MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#36454F]/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5"
            >
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#F2A104]/10 text-[#F2A104] flex items-center justify-center font-bold">
                    <Package className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-[#36454F] font-heading">
                    {editingMaterial ? 'Edit Material / Product' : 'Add New Material to Catalog'}
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-[#36454F] hover:bg-slate-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSaveMaterial} className="space-y-4">
                
                <div>
                  <label className="block text-xs font-bold text-[#36454F] uppercase tracking-wider mb-1">
                    Material / Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fabrication of Heavy Duty Pressure Vessel Tank"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F4F5F6] border border-slate-200 rounded-xl text-xs text-[#36454F] focus:outline-none focus:ring-2 focus:ring-[#F2A104] transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  <div>
                    <label className="block text-xs font-bold text-[#36454F] uppercase tracking-wider mb-1">
                      HSN / SAC Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 73090090"
                      value={hsnSac}
                      onChange={(e) => setHsnSac(e.target.value)}
                      className="w-full px-3 py-2 bg-[#F4F5F6] border border-slate-200 rounded-xl text-xs font-mono text-[#36454F] focus:outline-none focus:ring-2 focus:ring-[#F2A104] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#36454F] uppercase tracking-wider mb-1">
                      Default Rate (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.00"
                      value={defaultRate}
                      onChange={(e) => setDefaultRate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#F4F5F6] border border-slate-200 rounded-xl text-xs font-mono text-[#36454F] focus:outline-none focus:ring-2 focus:ring-[#F2A104] transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#36454F] uppercase tracking-wider mb-1">
                      Unit (Per)
                    </label>
                    <select
                      value={defaultUnit}
                      onChange={(e) => setDefaultUnit(e.target.value)}
                      className="w-full px-3 py-2 bg-[#F4F5F6] border border-slate-200 rounded-xl text-xs font-semibold text-[#36454F] focus:outline-none focus:ring-2 focus:ring-[#F2A104] cursor-pointer"
                    >
                      <option value="Nos">Nos</option>
                      <option value="Sets">Sets</option>
                      <option value="KG">KG</option>
                      <option value="MTR">MTR</option>
                      <option value="LOT">LOT</option>
                      <option value="BOX">BOX</option>
                    </select>
                  </div>

                </div>

                <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 text-[#5C7A99] font-bold text-xs hover:bg-slate-200 transition-all duration-150 active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#F2A104] hover:bg-[#d88f00] text-[#36454F] font-bold text-xs shadow-md transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>{editingMaterial ? 'Update Material' : 'Save Material'}</span>
                    )}
                  </button>
                </div>

              </form>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {materialToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-[#36454F]/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4"
            >
              
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center border border-rose-200 shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#36454F]">Confirm Material Deletion</h3>
                  <p className="text-xs text-[#5C7A99]">This action cannot be undone.</p>
                </div>
              </div>

              <p className="text-xs text-[#36454F]">
                Are you sure you want to delete material <span className="font-bold">"{materialToDelete.name}"</span> from your catalog?
              </p>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  onClick={() => setMaterialToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-[#5C7A99] font-bold text-xs hover:bg-slate-200 transition-all duration-150 active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all duration-150 hover:scale-[1.02] active:scale-95 cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Confirm Delete</span>
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
          © {new Date().getFullYear()} Krishna Engineering. Reusable Materials & Products Catalog.
        </div>
      </footer>

    </motion.div>
  );
}
