import os from "os";
import path from "path";
import fs from "fs";

const CONFIG_DIR = path.join(os.homedir(), ".shroud");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

type ShroudConfig = {
    token?: string;
};

function ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

export function saveToken(token: string) {
    ensureConfigDir();

    const config: ShroudConfig = {
        token,
    };

    fs.writeFileSync(
        CONFIG_FILE,
        JSON.stringify(config, null, 2),
        { encoding: "utf8" },
    );

    if (process.platform !== "win32") {
        fs.chmodSync(CONFIG_FILE, 0o600);
    }
}

export function getToken(): string | null {
    if (!fs.existsSync(CONFIG_FILE)) {
        return null;
    }

    try {
        const config = JSON.parse(
            fs.readFileSync(CONFIG_FILE, "utf8"),
        ) as ShroudConfig;

        return config.token ?? null;
    } catch {
        return null;
    }
}

export function removeToken() {
    if (fs.existsSync(CONFIG_FILE)) {
        fs.rmSync(CONFIG_FILE);
    }
}
