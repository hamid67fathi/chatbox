import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema/index.js";
import type { GoogleUserProfile } from "./google-oauth.js";
import { assertEmailDomainAllowed } from "./google-oauth.js";

const PROVIDER = "google";

export async function findOrCreateGoogleUser(profile: GoogleUserProfile) {
	assertEmailDomainAllowed(profile.email);

	const [byOAuth] = await db
		.select({
			id: users.id,
			email: users.email,
			fullName: users.fullName,
		})
		.from(users)
		.where(
			and(
				eq(users.oauthProvider, PROVIDER),
				eq(users.oauthProviderId, profile.sub),
				isNull(users.deletedAt),
			),
		)
		.limit(1);

	if (byOAuth) {
		await db
			.update(users)
			.set({
				lastLoginAt: new Date(),
				emailVerified: profile.emailVerified || undefined,
				fullName: byOAuth.fullName ?? profile.name ?? null,
				avatarUrl: profile.picture ?? undefined,
				updatedAt: new Date(),
			})
			.where(eq(users.id, byOAuth.id));
		return byOAuth;
	}

	const [byEmail] = await db
		.select({
			id: users.id,
			email: users.email,
			fullName: users.fullName,
		})
		.from(users)
		.where(and(eq(users.email, profile.email), isNull(users.deletedAt)))
		.limit(1);

	if (byEmail) {
		const [linked] = await db
			.update(users)
			.set({
				oauthProvider: PROVIDER,
				oauthProviderId: profile.sub,
				emailVerified: true,
				fullName: byEmail.fullName ?? profile.name ?? null,
				avatarUrl: profile.picture ?? undefined,
				lastLoginAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(users.id, byEmail.id))
			.returning({
				id: users.id,
				email: users.email,
				fullName: users.fullName,
			});
		return linked!;
	}

	const [created] = await db
		.insert(users)
		.values({
			email: profile.email,
			oauthProvider: PROVIDER,
			oauthProviderId: profile.sub,
			fullName: profile.name ?? null,
			avatarUrl: profile.picture ?? null,
			emailVerified: profile.emailVerified,
			passwordHash: null,
		})
		.returning({
			id: users.id,
			email: users.email,
			fullName: users.fullName,
		});

	return created;
}
