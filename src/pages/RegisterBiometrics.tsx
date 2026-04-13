import React, { useState } from 'react';
import { Card, Button, message, Alert } from 'antd';
import { Fingerprint, CheckCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { startRegistration } from '@simplewebauthn/browser';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../lib/api';
import { isStandalonePwa } from '../lib/pwa';

const RegisterBiometrics: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const standalonePwa = isStandalonePwa();

  const handleRegister = async () => {
    if (!user) return;
    const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
    if (!email) {
      message.error('Email do usuário inválido para biometria');
      return;
    }
    if (!standalonePwa) {
      message.warning('A biometria só pode ser ativada no app PWA instalado');
      return;
    }
    setLoading(true);

    try {
      const resp = await fetch(apiUrl(`/api/auth/register-challenge?email=${encodeURIComponent(email)}`));
      if (!resp.ok) throw new Error('Erro ao buscar desafio de registro');
      const opts = await resp.json();

      const attResp = await startRegistration(opts);

      const verifyResp = await fetch(apiUrl('/api/auth/register-verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, body: attResp, challenge: opts.challenge }),
      });

      const verifData = await verifyResp.json();
      if (!verifyResp.ok) {
        throw new Error(verifData.error || verifData.hint || 'Falha na verificação da biometria');
      }

      if (verifData.verified) {
        message.success('Biometria cadastrada com sucesso!');
        navigate('/');
      } else {
        message.error(verifData.error || verifData.hint || 'Falha na verificação da biometria');
      }
    } catch (error: any) {
      console.error(error);
      message.error(error.message || 'Erro ao cadastrar biometria');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-12 animate-in fade-in slide-in-from-top-4 duration-500">
      <Card className="shadow-xl rounded-2xl border-0 overflow-hidden">
        <div className="bg-emerald-900 p-5 sm:p-8 text-center text-white">
          <ShieldCheck size={64} className="mx-auto mb-4 opacity-90" />
          <h1 className="text-2xl font-bold">Segurança Biométrica</h1>
          <p className="opacity-80">Acesse sua conta mais rápido usando FaceID ou Impressão Digital</p>
        </div>

        <div className="p-4 sm:p-8">
          <Alert
            message="Importante"
            description={
              standalonePwa
                ? 'Isso permitirá que você entre no Desapego Verde neste dispositivo sem precisar digitar sua senha.'
                : 'Instale o PWA para ativar biometria como recurso nativo do aplicativo.'
            }
            type={standalonePwa ? 'info' : 'warning'}
            showIcon
            className="mb-8"
          />

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="bg-green-100 p-2 rounded-full text-green-700">
                <CheckCircle size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Mais Rapidez</h3>
                <p className="text-gray-700 text-sm">Entre na conta em segundos com apenas um toque.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="bg-green-100 p-2 rounded-full text-green-700">
                <CheckCircle size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Mais Segurança</h3>
                <p className="text-gray-700 text-sm">Seus dados biométricos nunca saem do seu dispositivo.</p>
              </div>
            </div>
          </div>

          <div className="mt-8 sm:mt-12 flex flex-col gap-3">
            <Button
              type="primary"
              size="large"
              icon={<Fingerprint size={20} />}
              className="h-12 bg-emerald-700 hover:bg-emerald-600 border-none text-lg font-semibold shadow-lg"
              onClick={handleRegister}
              loading={loading}
              disabled={!standalonePwa}
            >
              Ativar Biometria Agora
            </Button>
            <Button
              type="link"
              className="text-gray-700 hover:text-gray-900"
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
