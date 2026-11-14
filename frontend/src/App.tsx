import { BrowserRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { BookingPage } from './pages/BookingPage';
import { BookingsPage } from './pages/BookingsPage';
import { CostSheetBuilderPage } from './pages/CostSheetBuilderPage';
import { CostSheetPage } from './pages/CostSheetPage';
import { CostSheetsPage } from './pages/CostSheetsPage';
import { CustomersPage } from './pages/CustomersPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { QuotationPage } from './pages/QuotationPage';
import { QuotationsPage } from './pages/QuotationsPage';

/** Every address in the application and the page it shows. */
export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="cost-sheets" element={<CostSheetsPage />} />
          <Route path="cost-sheets/new" element={<CostSheetBuilderPage />} />
          <Route path="cost-sheets/:id" element={<CostSheetPage />} />
          <Route path="quotations" element={<QuotationsPage />} />
          <Route path="quotations/:id" element={<QuotationPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="bookings/:id" element={<BookingPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
