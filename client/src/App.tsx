import { Route, Routes } from 'react-router-dom';
import LandingPage from './LandingPage';
import MenuPage from './guest/MenuPage';
import OrderStatusPage from './guest/OrderStatusPage';
import LoyaltyPage from './guest/LoyaltyPage';
import LoginPage from './admin/LoginPage';
import AdminLayout from './admin/AdminLayout';
import DashboardPage from './admin/DashboardPage';
import OrdersPage from './admin/OrdersPage';
import TablesPage from './admin/TablesPage';
import MenuAdminPage from './admin/MenuAdminPage';
import GuestsPage from './admin/GuestsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/m/:tableCode" element={<MenuPage />} />
      <Route path="/m/:tableCode/order/:orderId" element={<OrderStatusPage />} />
      <Route path="/loyalty" element={<LoyaltyPage />} />
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="tables" element={<TablesPage />} />
        <Route path="menu" element={<MenuAdminPage />} />
        <Route path="guests" element={<GuestsPage />} />
      </Route>
    </Routes>
  );
}
