import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Divider, Alert } from 'antd';
import { Mail, Lock, Fingerprint } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { startAuthentication } from '@simplewebauthn/browser';
import { apiUrl } from '../lib/api';
import { isStandalonePwa } from '../lib/pwa';

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { login } = useAuth();
  const standalonePwa = isStandalonePwa();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await response.json();

      if (response.ok) {
        message.success('Login realizado com sucesso!');
        login(data.user, data.token);
        navigate('/');
      } else {
        message.error(data.error || 'Erro ao fazer login');
      }
    } catch (error) {
      message.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  const loginWithBiometrics = async () => {
    const email = form.getFieldValue('email');
    if (!email) {
      return message.warning('Insira seu email para usar biometria');
    }

    try {
      setLoading(true);
      const resp = await fetch(apiUrl(`/api/auth/login-challenge?email=${encodeURIComponent(email)}`));
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Erro ao buscar desafio');
      }
      const opts = await resp.json();

      const asseResp = await startAuthentication(opts);

      const verifyResp = await fetch(apiUrl('/api/auth/login-verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, body: asseResp }),
      });

      const verifData = await verifyResp.json();
      if (verifData.verified) {
        message.success('Autenticação biométrica bem sucedida!');
        login(verifData.user, verifData.token);
        navigate('/');
      } else {
        message.error('Falha na autenticação');
      }
    } catch (error: any) {
      console.error(error);
      message.error(error.message || 'Erro na biometria');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-[75vh] animate-in fade-in zoom-in duration-300">
      <Card className="w-full max-w-md shadow-xl border-0">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">🌱</div>
          <h1 className="text-2xl font-bold text-gray-800">Bem-vindo de volta</h1>
          <p className="text-gray-500">Entre na sua conta para continuar</p>
        </div>

        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="email"
            rules={[{ required: true, message: 'Insira seu email' }, { type: 'email', message: 'Email inválido' }]}
          >
            <Input prefix={<Mail size={18} className="text-gray-400" />} placeholder="Email" size="large" />
          </Form.Item>

          <Form.Item
            name="senha"
            rules={[{ required: true, message: 'Insira sua senha' }]}
          >
            <Input.Password prefix={<Lock size={18} className="text-gray-400" />} placeholder="Senha" size="large" />
          </Form.Item>

          <Form.Item className="mb-2">
            <Button type="primary" htmlType="submit" className="w-full bg-green-600 hover:bg-green-500 h-10 text-base border-none shadow-md" loading={loading}>
              Entrar
            </Button>
          </Form.Item>

          <Divider plain className="text-gray-400 text-xs my-4">OU</Divider>

          {standalonePwa ? (
            <Form.Item>
              <Button
                icon={<Fingerprint size={18} />}
                className="w-full h-10 text-green-700 border-green-200 hover:border-green-600 hover:text-green-600 transition-colors"
                onClick={loginWithBiometrics}
                loading={loading}
              >
                Acessar com Biometria
              </Button>
            </Form.Item>
          ) : (
            <Alert
              type="info"
              showIcon
              className="mb-6"
              message="Biometria disponível no app instalado"
              description="Instale este PWA na tela inicial para ativar login biométrico como recurso nativo."
            />
          )}
        </Form>
        <div className="text-center mt-4 text-gray-500 text-sm">
          Ainda não tem conta? <Link to="/register" className="text-green-600 font-medium hover:underline">Cadastre-se</Link>
        </div>
      </Card>
    </div>
  );
};

export default Login;
