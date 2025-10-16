import type { NextAuthOptions } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import CredentialsProvider from "next-auth/providers/credentials";
import { createTransport } from "nodemailer";
import { randomInt } from "crypto";
import PostgresAdapter from "@auth/pg-adapter"
import { Pool } from "pg"
import bcrypt from "bcryptjs";
import { SignJWT, importJWK } from "jose"
import GoogleProvider from "next-auth/providers/google";
import { Provider } from "next-auth/providers";

const generateJWT = async (payload) => {
  const secret = process.env.NEXTAUTH_SECRET;
  const jwk = await importJWK({ k: secret, alg: 'HS256', kty: 'oct' });
  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('365d')
    .sign(jwk);
  return jwt;
};

export const pool = new Pool({
  host: process.env.POSTGRES_DB_HOST,
  user: process.env.POSTGRES_DB_USER,
  port: parseInt(process.env.POSTGRES_DB_PORT || "5432", 10),
  password: process.env.POSTGRES_DB_PASSWORD,
  database: process.env.POSTGRES_DB_NAME || "exulu",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

function gernerateOTP() {
  return randomInt(100000, 999999);
}

const providers: Provider[] = [
  CredentialsProvider({
    name: "Credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    authorize: async (credentials) => {
      if (!credentials?.email) {
        return null;
      }
      if (!credentials?.password) {
        return null;
      }
      const res = await pool.query('SELECT * FROM users WHERE email = $1', [credentials.email])
      console.log("[NEXT AUTH] authorize res rows count:", res.rows.length)
      console.log("[NEXT AUTH] Full user object:", JSON.stringify(res.rows[0], null, 2))
      if (!res?.rows?.length) {
        return null;
      }
      for (const user of res.rows) {
        const isMatch = await bcrypt.compare(credentials.password, user.password)
        console.log("[NEXT AUTH] isMatch", isMatch)
        if (isMatch) {
          await pool.query('UPDATE users SET last_used = $1 WHERE email = $2', [new Date(), user.email])
          return user;
        }
      }
    }
  })
]

if (process.env.EMAIL_SERVER_HOST) {
  providers.push(EmailProvider({
    async sendVerificationRequest({
      identifier: email,
      token,
      url,
      provider: { server, from },
    }) {
      const { host } = new URL(url);
      const transport = createTransport(server);
      await transport.sendMail({
        to: email,
        from,
        subject: `Sign in to ${host}`,
        text: text({ token, host }),
        html: html({ token, host }),
      });
    },
    async generateVerificationToken() {
      return gernerateOTP().toString();
    },
    maxAge: 3 * 60,
    server: {
      host: process.env.EMAIL_SERVER_HOST,
      port: parseInt(process.env.EMAIL_SERVER_PORT!, 10),
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    },
    from: process.env.EMAIL_FROM,
  }))
}
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(GoogleProvider({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    allowDangerousEmailAccountLinking: true,
    authorization: {
      params: {
        prompt: "consent",
        access_type: "offline",
        response_type: "code",
        scope: [
          "https://www.googleapis.com/auth/userinfo.profile",
          "https://www.googleapis.com/auth/directory.readonly",
          "https://www.googleapis.com/auth/user.emails.read",
          "https://www.googleapis.com/auth/admin.directory.group.readonly",
          "https://www.googleapis.com/auth/admin.directory.user.readonly",
          "https://www.googleapis.com/auth/userinfo.email",
          "openid",
        ].join(" "),
      }
    }
  }))
}

export const getAuthOptions = async (): Promise<NextAuthOptions> => {
  return {
    pages: {
      signIn: "/login",
    },
    adapter: PostgresAdapter(pool),
    session: {
      strategy: "jwt", // ✅ enable JWT sessions
    },
    jwt: {
      secret: process.env.NEXTAUTH_SECRET, // ✅ secret to sign tokens
    },
    providers,
    callbacks: {
      // Had to overwrite the default types as the oAuth specific properties 
      // such as email_verified did not get recognized.
      async signIn({ account, profile, user }: any) {

        let email = user.email;

        console.log("[EXULU] Sign in callback", account, profile, user)
        if (account?.provider === "google") {
          email = profile?.email;
        }

        console.log("[EXULU] ALLOWED_EMAIL_DOMAINS", process.env.ALLOWED_EMAIL_DOMAINS)
        if (process.env.ALLOWED_EMAIL_DOMAINS) {
          let allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS.split(",");
          allowedDomains.push("exulu.com")
          allowedDomains.push("qventu.com")
          if (!allowedDomains.some(domain => email.endsWith(`@${domain}`))) {
            return false;
          }
        }

        /* console.log("process.env.GOOGLE_SECURITY_GROUPS", process.env.GOOGLE_SECURITY_GROUPS)
        if (
          account?.provider === "google" &&
          process.env.GOOGLE_SECURITY_GROUPS
        ) {

          const accessToken = account?.access_token;
          const refreshToken = account?.refresh_token;

          if (!accessToken || !refreshToken) {
            console.error("[EXULU] Google auth failed, no access token or refresh token")
            return false;
          }
          console.log("process.env.GOOGLE_SECURITY_GROUPS", process.env.GOOGLE_SECURITY_GROUPS)
          const allowedGroups = process.env.GOOGLE_SECURITY_GROUPS.split(",");
          const promises = allowedGroups.map(async (group) => {
            const res = await fetch(`https://admin.googleapis.com/admin/directory/v1/groups/${group}/members`, {
              headers: {
                "Authorization": `Bearer ${accessToken}`
              }
            })
            const json = await res.json();
            console.log("[EXULU] Google auth group members", json)
            console.log("[EXULU] Google auth group members", json?.error?.errors)
            return json?.members;
          })
          const members = await Promise.all(promises).then(res => res.flat());
          const isInGroup = members.some(member => member?.email === email);
          if (!isInGroup) {
            console.error("[EXULU] Google auth failed, user not in allowed groups")
            return false;
          }
        } */

        const res = await pool.query('SELECT * FROM users WHERE email = $1', [email])
        console.log("[EXULU] Sign in callback user query result", res)

        if (res.rows.length > 0) {
          await pool.query('UPDATE users SET last_used = $1 WHERE email = $2', [new Date(), email])
          return true;
        }

        // If google auth, create the user if it doesn't exist.
        if (
          !res.rows.length &&
          account?.provider === "google"
        ) {
          const name = profile?.given_name || "";
          await pool.query('INSERT INTO users ("email", "name", "createdAt", "updatedAt", "emailVerified", "last_used", "type", "super_admin") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [email, name, new Date(), new Date(), new Date(), new Date(), "user", false])
          return true;
        }

        console.log("[NEXT AUTH] res.rows.length", res.rows.length)

        if (res.rows.length) {
          return true;
        }

        return false;

      },
      async jwt({ token, user }) {
        const newToken = token;
        newToken.uid = token.sub ?? 'nosub'
        const jwt = await generateJWT({
          id: user ? user.id : token.sub,
          email: user ? user.email : token.email,
        })
        newToken.jwt = jwt
        return newToken
      },

      // ✅ Add session callback
      async session({ session, token }) {
        const newSession = session;
        const newToken = token;
        if (newToken && newSession.user) {
          // @ts-ignore
          newSession.user.id = newToken.id;
          // @ts-ignore
          newSession.user.jwt = newToken.jwt
          newSession.user.email = newToken.email;
        }
        return newSession
      },
    },
    secret: process.env.NEXTAUTH_SECRET, // needed for JWT
  };
};

function html(params: { token: string; host: string }) {
  const { token, host } = params;

  const escapedHost = host.replace(/\\./g, "&#8203;.");

  const color = {
    background: "#f9f9f9",
    text: "#444",
    mainBackground: "#fff",
  };

  return `
<body style="background: ${color.background};">
  <table width="100%" border="0" cellspacing="20" cellpadding="0"
    style="background: ${color.mainBackground}; max-width: 600px; margin: auto; border-radius: 10px;">
    <tr>
      <td align="center"
        style="padding: 10px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        Sign in to <strong>${escapedHost}</strong>
      </td>
    </tr>
    <tr>
      <td align="center" style="padding: 20px 0;">
        <table border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td align="center"><strong>Sign in code:</strong> ${token}</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center"
        style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${color.text};">
        Keep in mind that this code will expire after <strong><em>3 minutes</em></strong>. If you did not request this email you can safely ignore it.
      </td>
    </tr>
  </table>
</body>
  `;
}

function text(params: { token: string; host: string }) {
  return `
  Sign in to ${params.host}
  
  Sign in code: ${params.token}
  
  Keep in mind that this code will expire after 3 minutes. If you did not request this email you can safely ignore it.
  `;
}
