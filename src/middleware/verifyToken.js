import { createRemoteJWKSet, jwtVerify } from "jose";

// BetterAuth-এর JWKS endpoint থেকে public key এনে JWT verify করি
const JWKS_URL =
  process.env.AUTH_JWKS_URL || "http://localhost:3000/api/auth/jwks";
const JWKS = createRemoteJWKSet(new URL(JWKS_URL));

export async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: token missing" });
    }

    const { payload } = await jwtVerify(token, JWKS);

    // BetterAuth JWT payload: sub = user id, email = user email
    req.user = {
      id: payload.sub,
      email: payload.email,
    };

    next();
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Unauthorized: invalid or expired token" });
  }
}
