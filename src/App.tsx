import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import RegisterUser from './pages/RegisterUser';
import RegisterItem from './pages/RegisterItem';
import RegisterBiometrics from './pages/RegisterBiometrics';
import { Layout, ConfigProvider } from 'antd';
import { Leaf, Shield, Menu, X } from 'lucide-react';

const { Header, Content } = Layout;

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  return user ? <>{children}</> : <Navigate to="/login" />;
};

const Navigation = () => {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <Header className="!bg-emerald-900 !h-auto !leading-normal !px-0 sticky top-0 z-50 shadow-md">
      {/* Barra principal */}
      <div className="flex justify-between items-center px-4 sm:px-6 md:px-8 h-14">
        <Link to="/" onClick={closeMenu} className="text-xl font-bold flex items-center gap-2 text-white hover:text-green-100 transition-colors">
          <Leaf size={22} /> Desapego Verde
        </Link>

        {/* Menu desktop */}
        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <>
              <span className="font-medium text-white">Olá, {user.nome}</span>
              <Link to="/security" className="flex items-center gap-1 text-white hover:text-green-200 transition-colors">
                <Shield size={18} /> Biometria
              </Link>
              <Link to="/items/new" className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-md font-semibold transition-colors shadow-sm">
                Doar Item
              </Link>
              <button type="button" onClick={logout} className="text-white hover:text-green-200 underline transition-colors cursor-pointer">
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-white hover:text-green-200 font-medium transition-colors">Entrar</Link>
              <Link to="/register" className="bg-white text-emerald-900 px-4 py-1.5 rounded-md font-semibold hover:bg-emerald-50 transition-colors shadow-sm">
                Cadastrar
              </Link>
            </>
          )}
        </div>

        {/* Botão hambúrguer (mobile) */}
        <button
          type="button"
          className="md:hidden text-white p-1"
          onClick={() => setMenuOpen(prev => !prev)}
          aria-label="Abrir menu"
        >
          {menuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {/* Menu mobile expandido */}
      {menuOpen && (
        <div className="md:hidden border-t border-emerald-800 bg-emerald-900 px-4 pb-4 flex flex-col items-center gap-1">
          {user ? (
            <>
              <span className="font-medium text-white pt-3 pb-1">Olá, {user.nome}</span>
              <Link to="/security" onClick={closeMenu} className="flex items-center gap-2 text-white hover:text-green-200 transition-colors py-2">
                <Shield size={18} /> Biometria
              </Link>
              <Link to="/items/new" onClick={closeMenu} className="bg-emerald-700 hover:bg-emerald-600 text-white text-center px-4 py-2.5 rounded-md font-semibold transition-colors shadow-sm">
                Doar Item
              </Link>
              <button
                type="button"
                onClick={() => { logout(); closeMenu(); }}
                className="text-left text-white hover:text-green-200 underline transition-colors cursor-pointer py-2"
              >
                Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={closeMenu} className="text-white hover:text-green-200 font-medium transition-colors py-2">
                Entrar
              </Link>
              <Link to="/register" onClick={closeMenu} className="bg-white text-emerald-900 text-center px-4 py-2.5 rounded-md font-semibold hover:bg-emerald-50 transition-colors shadow-sm">
                Cadastrar
              </Link>
            </>
          )}
        </div>
      )}
    </Header>
  );
};

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#166534',
          colorText: '#111827',
        },
      }}
    >
      <AuthProvider>
        <BrowserRouter>
          <Layout className="min-h-screen bg-gray-50">
            <Navigation />
            <Content className="px-3 py-4 sm:px-6 sm:py-6 md:p-8 flex justify-center">
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
    </ConfigProvider>
  );
}

export default App;
