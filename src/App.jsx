import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import DashboardPage from './components/DashboardPage';
import CreateInvoicePage from './components/CreateInvoicePage';
import InvoicePreviewPage from './components/InvoicePreviewPage';
import InvoiceHistoryPage from './components/InvoiceHistoryPage';
import MaterialsPage from './components/MaterialsPage';
import QuotationListPage from './components/QuotationListPage';
import CreateQuotationPage from './components/CreateQuotationPage';
import QuotationPreviewPage from './components/QuotationPreviewPage';
import ProtectedRoute from './components/ProtectedRoute';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected Routes (require authenticated session) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/invoices" element={<InvoiceHistoryPage />} />
            <Route path="/materials" element={<MaterialsPage />} />
            <Route path="/invoice/new" element={<CreateInvoicePage />} />
            <Route path="/invoice/:id" element={<InvoicePreviewPage />} />
            <Route path="/invoice/:id/edit" element={<CreateInvoicePage />} />

            {/* Quotations Routes */}
            <Route path="/quotations" element={<QuotationListPage />} />
            <Route path="/quotations/new" element={<CreateQuotationPage />} />
            <Route path="/quotation/:id" element={<QuotationPreviewPage />} />
            <Route path="/quotation/:id/edit" element={<CreateQuotationPage />} />
          </Route>

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
