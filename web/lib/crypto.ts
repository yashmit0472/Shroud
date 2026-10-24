import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getEncryptionKey(): Buffer {
    const key = process.env.SHROUD_ENCRYPTION_KEY;

    if (!key) {
        throw new Error("SHROUD_ENCRYPTION_KEY is not configured.");
    }

    const buffer = Buffer.from(key, "base64");

    if (buffer.length !== KEY_LENGTH) {
        throw new Error(
            "SHROUD_ENCRYPTION_KEY must decode to exactly 32 bytes."
        );
    }

    return buffer;
}

export function encryptSecret(value: string) {
    const key = getEncryptionKey();

    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
        encryptedValue: Buffer.concat([
            iv,
            authTag,
            encrypted,
        ]).toString("base64"),

        encryptionVersion: 1,
    };
}

export function decryptSecret(encryptedValue: string) {
    const key = getEncryptionKey();

    const data = Buffer.from(encryptedValue, "base64");

    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(
        IV_LENGTH,
        IV_LENGTH + 16
    );
    const encrypted = data.subarray(
        IV_LENGTH + 16
    );

    const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        iv
    );

    decipher.setAuthTag(authTag);

    return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ]).toString("utf8");
}

// Project/key scope prevents correlation between unrelated secrets. HKDF keeps
// fingerprint material separate from the AES key. No plaintext hashes are stored.
export function secretFingerprint(projectId: string, secretKey: string, value: string) {
    const key = crypto.hkdfSync("sha256", getEncryptionKey(), Buffer.from("shroud/fingerprints/v1"), Buffer.from(projectId), 32);
    return crypto.createHmac("sha256", Buffer.from(key)).update(JSON.stringify([secretKey, value])).digest("hex");
}
