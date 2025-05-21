import type {NextAuthOptions} from "next-auth";
import EmailProvider from "next-auth/providers/email";
import {createTransport} from "nodemailer";
import {randomInt} from "crypto";
import PostgresAdapter from "@auth/pg-adapter"
import { Pool } from "pg"

export const pool = new Pool({
    host: process.env.POSTGRES_DB_HOST,
    user: process.env.POSTGRES_DB_USER,
    password: process.env.POSTGRES_DB_PASSWORD,
    database: "exulu",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  })

function gernerateOTP() {
    return randomInt(100000, 999999);
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
        providers: [
            EmailProvider({
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
            }),
        ],
        callbacks: {
            async signIn({ user }) {
                const res = await pool.query('SELECT * FROM users WHERE email = $1', [user.email])
                console.log("[EXULU] Sign in callback", res)
                if (res.rows.length > 0) {
                    return true;
                } else {
                    return false;
                }
            },

            // ✅ Add JWT callback
            async jwt({ token, user }) {
                if (user) {
                    token.id = user.id;
                    token.email = user.email;
                }
                return token;
            },

            // ✅ Add session callback
            async session({ session, token }) {
                if (token && session.user) {
                    // @ts-ignore
                    session.user.id = token.id;
                    session.user.email = token.email;
                }
                return session;
            },
        },
        secret: process.env.NEXTAUTH_SECRET, // needed for JWT
    };
};

function html(params: { token: string; host: string }) {
    const {token, host} = params;

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
