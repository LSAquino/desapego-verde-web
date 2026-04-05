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

const challengeKey = (flow: 'register' | 'login', email: string) => `${flow}:${email}`;

const normalizeEmail = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const findUserByEmail = (email: string) => {
  return prisma.usuario.findFirst({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
    orderBy: { id: 'desc' },
  });
};

const findUsersByEmailWithAuthenticators = (email: string) => {
  return (prisma as any).usuario.findMany({
    where: {
      email: {
        equals: email,
        mode: 'insensitive',
      },
    },
    include: { autenticadores: true },
    orderBy: { id: 'desc' },
  });
};

const findAuthenticatorsByUserId = (userId: number) => {
  return (prisma as any).autenticador.findMany({
    where: {
      usuario_id: userId,
      credential_id: { not: '' },
      public_key: { not: '' },
    },
  });
};

const pickUserWithAuthenticator = async (email: string) => {
  const users: any[] = await findUsersByEmailWithAuthenticators(email);

  for (const user of users) {
    const validAuthenticators = (user.autenticadores || []).filter((auth: any) => auth.credential_id && auth.public_key);
    if (validAuthenticators.length > 0) {
      return { user, authenticators: validAuthenticators };
    }
  }

  const fallbackUser = users[0];
  if (!fallbackUser) {
    return { user: null, authenticators: [] };
  }

  const authenticators = await findAuthenticatorsByUserId(fallbackUser.id);
  return { user: fallbackUser, authenticators };
};

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
    const { nome, senha, cidade } = req.body;
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ error: 'Email inválido.' });
    }

    const existingUser = await findUserByEmail(email);
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
  const email = normalizeEmail(req.query.email);
  if (!email) return res.status(400).json({ error: 'Email inválido.' });
  const user: any = await findUserByEmail(email);

  if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

  const autenticadores = await findAuthenticatorsByUserId(user.id);

  const options = await generateRegistrationOptions({
    rpName: 'Desapego Verde',
    rpID,
    userID: Uint8Array.from(user.id.toString(), (c: any) => c.charCodeAt(0)),
    userName: user.email,
    attestationType: 'none',
    excludeCredentials: autenticadores.map((auth: any) => ({
      id: auth.credential_id,
      type: 'public-key',
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
  });

  challenges.set(challengeKey('register', user.email), options.challenge);
  res.json(options);
});

app.post('/api/auth/register-verify', async (req, res) => {
  const { rpID, origin } = getWebAuthnConfig(req);
  const { body, challenge } = req.body;
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'Email inválido.' });

  const user: any = await findUserByEmail(email);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado para biometria.' });

  const expectedChallenge = challenge || challenges.get(challengeKey('register', email));
  if (!expectedChallenge) {
    return res.status(400).json({
      error: 'Desafio biométrico ausente ou expirado. Gere um novo desafio e tente novamente.',
    });
  }

  try {
    const verification: any = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (verification.verified && verification.registrationInfo) {
      const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
      const normalizedCredentialId = typeof body?.id === 'string' && body.id.length > 0
        ? body.id
        : isoBase64URL.fromBuffer(credentialID);

      await (prisma as any).autenticador.create({
        data: {
          usuario_id: user.id,
          credential_id: normalizedCredentialId,
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
    challenges.delete(challengeKey('register', email));
  }
});

app.get('/api/auth/login-challenge', async (req, res) => {
  const { rpID } = getWebAuthnConfig(req);
  const email = normalizeEmail(req.query.email);
  if (!email) return res.status(400).json({ error: 'Email inválido.' });
  const { user, authenticators } = await pickUserWithAuthenticator(email);

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado para login biométrico.' });
  }

  if (authenticators.length === 0) {
    return res.status(400).json({
      error: 'Nenhuma biometria cadastrada para este usuário.',
      hint: 'Cadastre a biometria novamente no dispositivo atual.',
    });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: authenticators.map((auth: any) => ({
      id: auth.credential_id,
      type: 'public-key',
    })),
    userVerification: 'preferred',
  });

  challenges.set(challengeKey('login', email), options.challenge);
  res.json(options);
});

app.post('/api/auth/login-verify', async (req, res) => {
  const { rpID, origin } = getWebAuthnConfig(req);
  const { body, challenge } = req.body;
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: 'Email inválido.' });

  const { user, authenticators } = await pickUserWithAuthenticator(email);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado para biometria.' });

  const expectedChallenge = challenge || challenges.get(challengeKey('login', email));
  if (!expectedChallenge) {
    return res.status(400).json({
      error: 'Desafio biométrico ausente ou expirado. Gere um novo desafio e tente novamente.',
    });
  }

  const autenticador = authenticators.find((a: any) => a.credential_id === body.id);
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
    challenges.delete(challengeKey('login', email));
  }
});

// --- Existing Routes ---

app.post('/api/auth/login', async (req, res) => {
  try {
    const { senha } = req.body;
    const email = normalizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ error: 'Credenciais inválidas.' });
    }

    const user = await findUserByEmail(email);
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

