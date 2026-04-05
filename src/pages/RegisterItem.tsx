import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Card, Select, message, Upload } from 'antd';
import { Upload as UploadIcon, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiUrl } from '../lib/api';

const { TextArea } = Input;
const { Option } = Select;

const RegisterItem: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: number, nome: string }[]>([]);
  const navigate = useNavigate();
  const { token } = useAuth();

  useEffect(() => {
    fetch(apiUrl('/api/categories'))
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(console.error);
  }, []);

  const onFinish = async (values: any) => {
    setLoading(true);

    // Simulação do upload de imagem
    let imagem_url = null;
    if (values.imagem && values.imagem.fileList.length > 0) {
      imagem_url = 'https://picsum.photos/400/300?random=' + Math.random();
    }

    try {
      const response = await fetch(apiUrl('/api/items'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...values,
          imagem_url
        }),
      });

      if (response.ok) {
        message.success('Item cadastrado com sucesso!');
        navigate('/');
      } else {
        const data = await response.json();
        message.error(data.error || 'Erro ao cadastrar item');
      }
    } catch (error) {
      message.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 animate-in fade-in duration-500">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Doar um Item</h1>
        <p className="text-gray-500">Preencha os dados do item que você deseja desapegar</p>
      </div>

      <Card className="shadow-lg border-0 rounded-xl">
        <Form layout="vertical" onFinish={onFinish} requiredMark={false} size="large">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <Form.Item
              name="titulo"
              label={<span className="font-medium">O que você está doando? (Título)</span>}
              rules={[{ required: true, message: 'Insira o título do item' }]}
              className="md:col-span-2"
            >
              <Input prefix={<Package size={18} className="text-gray-400" />} placeholder="Ex: Bicicleta aro 29, Livros de programação..." />
            </Form.Item>

            <Form.Item
              name="categoria_id"
              label={<span className="font-medium">Categoria</span>}
              rules={[{ required: true, message: 'Selecione uma categoria' }]}
            >
              <Select placeholder="Selecione a categoria">
                {categories.map(cat => (
                  <Option key={cat.id} value={cat.id}>{cat.nome}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="tipo_oferta"
              label={<span className="font-medium">Tipo de Oferta</span>}
              rules={[{ required: true, message: 'Selecione o tipo de oferta' }]}
            >
              <Select placeholder="Doação, Troca, etc.">
                <Option value="doacao">Doação Gratuita</Option>
                <Option value="troca">Troca por outro item</Option>
                <Option value="emprestimo">Empréstimo</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="descricao"
              label={<span className="font-medium">Descrição detalhada</span>}
              rules={[{ required: true, message: 'Insira a descrição' }]}
              className="md:col-span-2"
            >
              <TextArea rows={4} placeholder="Descreva as condições do item, se há marcas de uso, detalhes importantes..." />
            </Form.Item>

            <Form.Item
              name="imagem"
              label={<span className="font-medium">Foto do Item</span>}
              className="md:col-span-2"
            >
              <Upload.Dragger maxCount={1} beforeUpload={() => false} listType="picture">
                <p className="ant-upload-drag-icon flex justify-center text-green-600">
                  <UploadIcon size={48} />
                </p>
                <p className="ant-upload-text font-medium mt-2">Clique ou arraste a imagem para cá</p>
                <p className="ant-upload-hint text-gray-500">Adicionar uma foto ajuda muito na doação!</p>
              </Upload.Dragger>
            </Form.Item>
          </div>

          <Form.Item className="mb-0 mt-4 flex justify-end text-right">
            <Button
              onClick={() => navigate('/')}
              className="mr-3 hover:bg-gray-100 font-medium"
              size="large"
            >
              Cancelar
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              className="bg-green-600 hover:bg-green-500 px-8 font-semibold shadow-md"
              loading={loading}
              size="large"
            >
              Publicar Item
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default RegisterItem;
