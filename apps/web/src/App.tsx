import { Navigate, Route, Routes } from 'react-router-dom';
import PublicScreen from './pages/PublicScreen';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <Routes>
      <Route path="/screen/:category" element={<PublicScreen />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/screen/senior" replace />} />
    </Routes>
  );
}
