import { Router } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import { db } from "../db";

export const authRouter = Router();

// Step 1: Redirect to GitHub OAuth
authRouter.get("/github", (_req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    scope: "read:user repo",
    redirect_uri: `${process.env.NEXT_PUBLIC_API_URL}/api/auth/github/callback`,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// Step 2: Handle GitHub OAuth callback
authRouter.get("/github/callback", async (req, res) => {
  const { code } = req.query;

  if (!code || typeof code !== "string") {
    res.status(400).json({ error: "Missing code" });
    return;
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } }
    );

    const { access_token } = tokenResponse.data;

    // Fetch GitHub user info
    const userResponse = await axios.get("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { id: githubId, login, avatar_url, name, email } = userResponse.data;

    // Upsert user in DB
    const user = await db.query(
      `INSERT INTO users (github_id, login, avatar_url, name, email, access_token)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (github_id) DO UPDATE
       SET login=$2, avatar_url=$3, name=$4, email=$5, access_token=$6, updated_at=NOW()
       RETURNING id, github_id, login`,
      [String(githubId), login, avatar_url, name, email, access_token]
    );

    const dbUser = user.rows[0];

    // Issue JWT
    const token = jwt.sign(
      { id: dbUser.id, githubId: dbUser.github_id, login: dbUser.login },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );

    res
      .cookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: "lax",
      })
      .redirect(
        process.env.NEXT_PUBLIC_API_URL?.replace("3001", "3000") + "/dashboard" ||
          "http://localhost:3000/dashboard"
      );
  } catch (err) {
    console.error("GitHub OAuth error:", err);
    res.status(500).json({ error: "Authentication failed" });
  }
});

// Get current user
authRouter.get("/me", async (req, res) => {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
      login: string;
    };
    const result = await db.query(
      "SELECT id, github_id, login, name, avatar_url FROM users WHERE id=$1",
      [payload.id]
    );
    res.json(result.rows[0] || null);
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

// Logout
authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token").json({ success: true });
});
