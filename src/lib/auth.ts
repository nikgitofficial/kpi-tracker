import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { loginSchema } from "@/lib/validations";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        await connectDB();

        const user = await User.findOne({ email }).select("+password");
        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.image ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          await connectDB();
          const existing = await User.findOne({ email: user.email });

          if (!existing) {
            await User.create({
              name: user.name,
              email: user.email,
              image: user.image,
              googleId: account.providerAccountId,
            });
          } else if (!existing.googleId) {
            await User.updateOne(
              { email: user.email },
              { googleId: account.providerAccountId, image: user.image }
            );
          }
          return true;
        } catch (error) {
          console.error("[GOOGLE_SIGNIN]", error);
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.email = user.email;
      }

      if (token.email) {
        await connectDB();
        const dbUser = (await User.findOne({
          email: token.email,
        }).lean()) as {
          _id: { toString(): string };
          image?: string;
          name?: string;
        } | null;

        if (dbUser) {
          token.id = dbUser._id.toString();
          token.picture = dbUser.image ?? null;
          token.name = dbUser.name ?? token.name;
        }
      }

      if (trigger === "update" && session?.image !== undefined) {
        token.picture = session.image;
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.image = (token.picture as string) ?? null;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
});