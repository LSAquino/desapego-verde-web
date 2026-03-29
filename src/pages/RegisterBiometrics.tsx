import React, { useState } from 'react';
import { Card, Button, message, Alert } from 'antd';
import { Fingerprint, CheckCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { startRegistration } from '@simplewebauthn/browser';
import { useNavigate } from 'react-router-dom';

const RegisterBiometrics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const resp = await fetch(`/api/auth/register-challenge?email=${encodeURIComponent(user.email)}`);
      if (!resp.ok) throw new Error('Erro ao buscar desafio de registro');
      const opts = await resp.json();

      const attResp = await startRegistration(opts);

      const verifyResp = await fetch('/api/auth/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, body: attResp }),
      });

      const verifData = await verifyResp.json();
      if (verifData.verified) {
        message.success('Biometria cadastrada com sucesso!');
        navigate('/');
      } else {
        message.error('Falha na verificação da biometria');
      }
    } catch (error: any) {
      console.error(error);
      message.error(error.message || 'Erro ao cadastrar biometria');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 animate-in fade-in slide-in-from-top-4 duration-500">
      <Card className="shadow-xl rounded-2xl border-0 overflow-hidden">
        <div className="bg-green-700 p-8 text-center text-white">
          <ShieldCheck size={64} className="mx-auto mb-4 opacity-90" />
          <h1 className="text-2xl font-bold">Segurança Biométrica</h1>
          <p className="opacity-80">Acesse sua conta mais rápido usando FaceID ou Impressão Digital</p>
        </div>

        <div className="p-8">
          <Alert
            message="Importante"
            description="Isso permitirá que você entre no Desapego Verde neste dispositivo sem precisar digitar sua senha."
            type="info"
            showIcon
            className="mb-8"
          />

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="bg-green-100 p-2 rounded-full text-green-700">
                <CheckCircle size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Mais Rapidez</h3>
                <p className="text-gray-500 text-sm">Entre na conta em segundos com apenas um toque.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-green-100 p-2 rounded-full text-green-700">
                <CheckCircle size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-800">Mais Segurança</h3>
                <p className="text-gray-500 text-sm">Seus dados biométricos nunca saem do seu dispositivo.</p>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3">
            <Button
              type="primary"
              size="large"
              icon={<Fingerprint size={20} />}
              className="h-12 bg-green-600 hover:bg-green-500 border-none text-lg font-semibold shadow-lg"
              onClick={handleRegister}
              loading={loading}
            >
              Ativar Biometria Agora
            </Button>
            <Button
              type="link"
              className="text-gray-500 hover:text-gray-700"
              onClick={() => navigate('/')}
            >
              Talvez mais tarde
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default RegisterBiometrics;
