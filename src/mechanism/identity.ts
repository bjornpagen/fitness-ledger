import { createHash } from "node:crypto"
import { Uuid } from "@bjornpagen/bumbledb"
import { Effect } from "effect"
import { v7 } from "uuid"

/** Generate once per observation, outside any transaction retry. Never an event clock. */
export const observationId = Effect.suspend(() => Effect.fromResult(Uuid.parse(v7())))

/**
 * A UUIDv8 carrying the SHA-256 of a natural key, so the same thing always gets the same id and an
 * identical re-run is no change.
 */
export function naturalId(...parts: readonly string[]): Uuid {
	const hex = createHash("sha256").update(parts.join("\u0000"), "utf8").digest("hex")
	const variant = ((Number.parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16)
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}
