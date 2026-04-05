import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { isoBase64URL } from '@simplewebauthn/server/helpers';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-desapego';
const WEBAUTHN_RP_ID = process.env.WEBAUTHN_RP_ID;
const WEBAUTHN_ORIGIN = process.env.WEBAUTHN_ORIGIN;
const CORS_ORIGINS = process.env.CORS_ORIGINS;

const normalizeOrigin = (value?: string) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
};

const normalizeRpId = (value?: string) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  try {
    const url = new URL(trimmed);
    return url.hostname;
  } catch {
    return trimmed
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
      .split(':')[0];
  }
};

const configuredWebAuthnOrigin = normalizeOrigin(WEBAUTHN_ORIGIN);
const configuredWebAuthnRpId = normalizeRpId(WEBAUTHN_RP_ID);

const toSafeBigInt = (value: unknown) => {
  if (typeof value === 'bigint') {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(value);
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return BigInt(value);
  }

  return BigInt(0);
};

// In-memory challenge store (Use Redis/Session in production)
const challenges = new Map<string, string>();

const allowedOrigins = CORS_ORIGINS
  ? CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : [];

app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  credentials: true,
}));
app.use(express.json());

// Helper to get RP_ID and ORIGIN dynamically
const getWebAuthnConfig = (req: any) => {
  const host = req.headers.host || 'localhost:5173';
  const fallbackOrigin = normalizeOrigin(req.headers.origin || `http://${host}`) || `http://${host}`;

  let fallbackRpId = host.split(':')[0];
  try {
    fallbackRpId = new URL(fallbackOrigin).hostname;
  } catch {
    // Keep host-based fallback when origin is not a full URL.
  }

  const origin = configuredWebAuthnOrigin || fallbackOrigin;
  const rpID = configuredWebAuthnRpId || fallbackRpId;
  return { rpID, origin };
};

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nome, email, senha, cidade } = req.body;

    const existingUser = await prisma.usuario.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email já cadastrado.' });
    }

    const hashedPassword = await bcrypt.hash(senha, 10);
    const user = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: hashedPassword,
        cidade,
      },
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user: { id: user.id, nome: user.nome, email: user.email }, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
  }
});

// --- Biometric Routes ---

app.get('/api/auth/register-challenge', async (req, res) => {
  const { rpID } = getWebAuthnConfig(req);
  const email = req.query.email as string;
  const user: any = await prisma.usuario.findUnique({
    where: { email },
    include: { autenticadores: true } as any
  });

  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const options = await generateRegistrationOptions({
    rpName: 'Desapego Verde',
    rpID,
    userID: Uint8Array.from(user.id.toString(), (c: any) => c.charCodeAt(0)),
    userName: user.email,
    attestationType: 'none',
    excludeCredentials: user.autenticadores.map((auth: any) => ({
      id: auth.credential_id,
      type: 'public-key',
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
  });

  challenges.set(user.email, options.challenge);
  res.json(options);
});

app.post('/api/auth/register-verify', async (req, res) => {
  const { rpID, origin } = getWebAuthnConfig(req);
  const { email, body } = req.body;
  const user: any = await prisma.usuario.findUnique({ where: { email } });
  const expectedChallenge = challenges.get(email);

  if (!user || !expectedChallenge) return res.status(400).json({ error: 'Dados inválidos' });

  try {
    const verification: any = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;

      await (prisma as any).autenticador.create({
        data: {
          usuario_id: user.id,
          credential_id: isoBase64URL.fromBuffer(credentialID),
          public_key: isoBase64URL.fromBuffer(credentialPublicKey),
          counter: toSafeBigInt(counter),
          transports: body.response.transports?.join(','),
        },
      });

      res.json({ verified: true });
    } else {
      const details = getWebAuthnConfig(req);
      res.status(400).json({
        verified: false,
        error: 'Falha na verificação do registro biométrico.',
        hint: 'Valide RP ID/Origin e recadastre a biometria neste domínio.',
        webauthn: details,
      });
    }
  } catch (error) {
    console.error(error);
    const details = getWebAuthnConfig(req);
    res.status(400).json({
      error: (error as any).message,
      hint: 'Verifique WEBAUTHN_RP_ID (somente dominio) e WEBAUTHN_ORIGIN (https://dominio).',
      webauthn: details,
    });
  } finally {
    challenges.delete(email);
  }
});

app.get('/api/auth/login-challenge', async (req, res) => {
  const { rpID } = getWebAuthnConfig(req);
  const email = req.query.email as string;
  const user: any = await prisma.usuario.findUnique({
    where: { email },
    include: { autenticadores: true } as any
  });

  if (!user || user.autenticadores.length === 0) {
    return res.status(400).json({ error: 'Nenhuma biometria cadastrada' });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: user.autenticadores.map((auth: any) => ({
      id: auth.credential_id,
      type: 'public-key',
    })),
    userVerification: 'preferred',
  });

  challenges.set(email, options.challenge);
  res.json(options);
});

app.post('/api/auth/login-verify', async (req, res) => {
  const { rpID, origin } = getWebAuthnConfig(req);
  const { email, body } = req.body;
  const user: any = await prisma.usuario.findUnique({
    where: { email },
    include: { autenticadores: true } as any
  });
  const expectedChallenge = challenges.get(email);

  if (!user || !expectedChallenge) return res.status(400).json({ error: 'Dados inválidos' });

  const autenticador = user.autenticadores.find((a: any) => a.credential_id === body.id);
  if (!autenticador) return res.status(404).json({ error: 'Autenticador não encontrado' });

  try {
    const verification: any = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: autenticador.credential_id,
        publicKey: isoBase64URL.toBuffer(autenticador.public_key),
        counter: Number(autenticador.counter),
      },
    });

    if (verification.verified) {
      // Update counter
      const newCounter = verification.authenticationInfo?.newCounter;
      if (newCounter !== undefined && newCounter !== null) {
        await (prisma as any).autenticador.update({
          where: { id: autenticador.id },
          data: { counter: toSafeBigInt(newCounter) }
        });
      } else {
        console.warn('WebAuthn verified without newCounter; skipping counter update.', {
          userId: user.id,
          credentialId: autenticador.id,
        });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ verified: true, user: { id: user.id, nome: user.nome, email: user.email }, token });
    } else {
      const details = getWebAuthnConfig(req);
      res.status(401).json({
        verified: false,
        error: 'Falha na verificação da autenticação biométrica.',
        hint: 'Recadastre a biometria no mesmo domínio do app e tente novamente.',
        webauthn: details,
      });
    }
  } catch (error) {
    console.error(error);
    const details = getWebAuthnConfig(req);
    res.status(400).json({
      error: (error as any).message,
      hint: 'Verifique WEBAUTHN_RP_ID (somente dominio) e WEBAUTHN_ORIGIN (https://dominio).',
      webauthn: details,
    });
  } finally {
    challenges.delete(email);
  }
});

// --- Existing Routes ---

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    const user = await prisma.usuario.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Credenciais inválidas.' });
    }

    const isValidPassword = await bcrypt.compare(senha, user.senha);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Credenciais inválidas.' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ user: { id: user.id, nome: user.nome, email: user.email }, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
});

// Middleware for authentication
const authenticate = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (req as any).userId = (decoded as any).userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido.' });
  }
};

// Category Routes
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await prisma.categoria.findMany();
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar categorias.' });
  }
});

// Item Routes
app.post('/api/items', authenticate, async (req, res) => {
  try {
    const { titulo, descricao, categoria_id, tipo_oferta, imagem_url } = req.body;

    const item = await prisma.item.create({
      data: {
        titulo,
        descricao,
        categoria_id: parseInt(categoria_id),
        tipo_oferta,
        imagem_url,
        usuario_id: (req as any).userId,
      },
      include: {
        categoria: true,
        usuario: { select: { id: true, nome: true, cidade: true } }
      }
    });

    res.status(201).json(item);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar item.' });
  }
});

app.get('/api/items', async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      include: {
        categoria: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            cidade: true,
            reputacao: true
          }
        }
      },
      orderBy: { data_criacao: 'desc' },
    });
    res.status(200).json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar itens.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

