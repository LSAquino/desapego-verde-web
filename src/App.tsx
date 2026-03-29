import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import RegisterUser from './pages/RegisterUser';
import RegisterItem from './pages/RegisterItem';
import RegisterBiometrics from './pages/RegisterBiometrics';
import { Layout } from 'antd';
import { Leaf, Shield } from 'lucide-react';

const { Header, Content } = Layout;

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" />;
};

const Navigation = () => {
  const { user, logout } = useAuth();
  return (
    <Header className="flex justify-between items-center bg-green-700 px-8 text-white h-16 sticky top-0 z-50 shadow-md">
      <Link to="/" className="text-2xl font-bold flex items-center gap-2 text-white hover:text-green-100 transition-colors">
        <Leaf size={24} /> Desapego Verde
      </Link>
      <div className="flex gap-4 items-center">
        {user ? (
          <>
            <span className="font-medium mr-2">Olá, {user.nome}</span>
            <Link to="/security" className="flex items-center gap-1 hover:text-green-200 transition-colors mr-2">
              <Shield size={18} /> Biometria
            </Link>
            <Link to="/items/new" className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-md font-semibold transition-colors shadow-sm">Doar Item</Link>
            <button onClick={logout} className="ml-2 hover:text-green-200 underline transition-colors cursor-pointer">Sair</button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-white hover:text-green-200 font-medium transition-colors">Entrar</Link>
            <Link to="/register" className="bg-white text-green-700 px-4 py-1.5 rounded-md font-semibold hover:bg-green-100 transition-colors shadow-sm">Cadastrar</Link>
          </>
        )}
      </div>
    </Header>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Layout className="min-h-screen bg-gray-50">
          <Navigation />
          <Content className="p-8 flex justify-center">
            <div className="w-full max-w-6xl">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<RegisterUser />} />
                <Route path="/security" element={
                  <PrivateRoute>
                    <RegisterBiometrics />
                  </PrivateRoute>
                } />
                <Route path="/items/new" element={
                  <PrivateRoute>
                    <RegisterItem />
                  </PrivateRoute>
                } />
              </Routes>
            </div>
          </Content>
        </Layout>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
