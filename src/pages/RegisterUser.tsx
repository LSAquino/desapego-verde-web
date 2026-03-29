import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { User as UserIcon, Mail, Lock, MapPin } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RegisterUser: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      
      if (response.ok) {
        message.success('Cadastro realizado com sucesso!');
        login(data.user, data.token);
        navigate('/');
      } else {
        message.error(data.error || 'Erro ao cadastrar');
      }
    } catch (error) {
      message.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Card className="w-full max-w-lg shadow-xl border-y-4 border-y-green-600 rounded-xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Crie sua Conta</h1>
          <p className="text-gray-500">Junte-se ao Desapego Verde e faça a diferença</p>
        </div>

        <Form layout="vertical" onFinish={onFinish} requiredMark={false} className="space-y-4">
          <Form.Item
            name="nome"
            label={<span className="font-medium text-gray-700">Nome Completo</span>}
            rules={[{ required: true, message: 'Insira seu nome' }]}
            className="mb-0"
          >
            <Input prefix={<UserIcon size={18} className="text-gray-400" />} placeholder="João da Silva" size="large" />
          </Form.Item>

          <Form.Item
            name="email"
            label={<span className="font-medium text-gray-700">Email</span>}
            rules={[{ required: true, message: 'Insira seu email' }, { type: 'email', message: 'Email inválido' }]}
            className="mb-0"
          >
            <Input prefix={<Mail size={18} className="text-gray-400" />} placeholder="joao@exemplo.com" size="large" />
          </Form.Item>

          <Form.Item
            name="senha"
            label={<span className="font-medium text-gray-700">Senha</span>}
            rules={[{ required: true, message: 'Insira sua senha' }, { min: 6, message: 'A senha deve ter no mínimo 6 caracteres' }]}
            className="mb-0"
          >
            <Input.Password prefix={<Lock size={18} className="text-gray-400" />} placeholder="Sua senha secreta" size="large" />
          </Form.Item>

          <Form.Item
            name="cidade"
            label={<span className="font-medium text-gray-700">Cidade (Opcional)</span>}
            className="mb-6"
          >
            <Input prefix={<MapPin size={18} className="text-gray-400" />} placeholder="Sua cidade" size="large" />
          </Form.Item>

          <Form.Item className="mb-0">
            <Button type="primary" htmlType="submit" className="w-full bg-green-600 hover:bg-green-500 h-12 text-base font-semibold border-none shadow-md" loading={loading}>
              Cadastrar
            </Button>
          </Form.Item>
        </Form>
        <div className="text-center mt-6 text-gray-500 text-sm">
          Já tem conta? <Link to="/login" className="text-green-600 font-medium hover:underline">Faça login</Link>
        </div>
      </Card>
    </div>
  );
};

export default RegisterUser;
