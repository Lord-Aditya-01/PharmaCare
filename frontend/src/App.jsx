import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Medicines from './pages/Medicines';
import Suppliers from './pages/Suppliers';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import Prescriptions from './pages/Prescriptions';
import PurchaseOrders from './pages/PurchaseOrders';
import Batches from './pages/Batches';
import Reports from './pages/Reports';
import Activity from './pages/Activity';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="medicines" element={<Medicines />} />
        <Route path="batches" element={<Batches />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="patients" element={<Patients />} />
        <Route path="doctors" element={<Doctors />} />
        <Route path="prescriptions" element={<Prescriptions />} />
        <Route path="purchase-orders" element={<PurchaseOrders />} />
        <Route path="reports" element={<Reports />} />
        <Route path="activity" element={<Activity />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
