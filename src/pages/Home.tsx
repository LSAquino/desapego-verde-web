import React, { useEffect, useState } from 'react';
import { Card, Tag, Spin, Result, Button } from 'antd';
import { MapPin, Calendar, User as UserIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Item {
  id: number;
  titulo: string;
  descricao: string;
  status: string;
  tipo_oferta: string;
  imagem_url: string | null;
  data_criacao: string;
  categoria: { nome: string };
  usuario: { nome: string; cidade: string; reputacao: number };
}

const Home: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/items')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setItems(data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Spin size="large" /></div>;
  }

  if (error) {
    return (
      <Result
        status="500"
        title="Erro ao carregar os itens"
        subTitle="Não foi possível conectar ao servidor. Verifique se o backend está rodando."
      />
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Desapegos Recentes</h1>
          <p className="text-gray-500">Encontre itens doados na sua região ou faça uma doação!</p>
        </div>
        <Link to="/items/new">
          <Button type="primary" size="large" className="bg-green-600 hover:bg-green-500 border-none shadow-md hover:shadow-lg transition-all">
            Doar um Item
          </Button>
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="text-6xl mb-4">🌱</div>
          <h2 className="text-xl font-semibold text-gray-700">Nenhum item disponível ainda</h2>
          <p className="text-gray-500 mt-2">Seja o primeiro a doar um item!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {items.map(item => (
            <Card
              key={item.id}
              hoverable
              className="overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-gray-100 shadow-sm"
              cover={
                <div className="h-48 bg-gray-100 relative group">
                  {item.imagem_url ? (
                    <img alt={item.titulo} src={item.imagem_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 group-hover:scale-105 transition-transform duration-500">
                      Sem Imagem
                    </div>
                  )}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <Tag color={item.status === 'disponivel' ? 'green' : 'default'} className="m-0 shadow-sm">
                      {item.status.toUpperCase()}
                    </Tag>
                    <Tag color="blue" className="m-0 shadow-sm">{item.tipo_oferta}</Tag>
                  </div>
                </div>
              }
            >
              <div className="flex flex-col h-full justify-between">
                <div>
                  <h3 className="font-bold text-lg text-gray-800 mb-1 line-clamp-1" title={item.titulo}>{item.titulo}</h3>
                  <Tag className="mb-3 bg-gray-50 border-gray-200 text-gray-600">{item.categoria.nome}</Tag>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2" title={item.descricao}>{item.descricao}</p>
                </div>
                
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <div className="flex items-center text-xs text-gray-500">
                    <UserIcon size={14} className="mr-1.5 text-green-600" />
                    <span className="truncate">{item.usuario.nome} (Rep.: {item.usuario.reputacao.toFixed(1)})</span>
                  </div>
                  {item.usuario.cidade && (
                    <div className="flex items-center text-xs text-gray-500">
                      <MapPin size={14} className="mr-1.5 text-green-600" />
                      <span className="truncate">{item.usuario.cidade}</span>
                    </div>
                  )}
                  <div className="flex items-center text-xs text-gray-400">
                    <Calendar size={14} className="mr-1.5" />
                    <span>{new Date(item.data_criacao).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Home;
