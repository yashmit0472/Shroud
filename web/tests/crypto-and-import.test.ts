import { expect,test,vi } from "vitest";
import { decryptSecret,encryptSecret,secretFingerprint } from "@/lib/crypto";
import { previewEnvImport } from "@/lib/bulk-env";
test("encryption uses fresh nonces and decrypts literal values",()=>{
 vi.stubEnv("SHROUD_ENCRYPTION_KEY",Buffer.alloc(32,7).toString("base64"));
 const value='test-only-value\n"literal"';
 const first=encryptSecret(value),second=encryptSecret(value);
 expect(first.encryptedValue).not.toBe(second.encryptedValue);expect(decryptSecret(first.encryptedValue)).toBe(value);
});
test("keyed fingerprints match across environments and are isolated by project and key",()=>{
 vi.stubEnv("SHROUD_ENCRYPTION_KEY",Buffer.alloc(32,7).toString("base64"));
 const fingerprint=secretFingerprint("project-a","KEY","test-value");
 expect(secretFingerprint("project-a","KEY","test-value")).toBe(fingerprint);
 expect(secretFingerprint("project-a","KEY","different-value")).not.toBe(fingerprint);
 expect(secretFingerprint("project-b","KEY","test-value")).not.toBe(fingerprint);
 expect(secretFingerprint("project-a","OTHER","test-value")).not.toBe(fingerprint);
 expect(fingerprint).not.toContain("test-value");
});
test("imports label creates/updates and preserve multiline and empty values",()=>{
 expect(previewEnvImport('EXISTING="line 1\nline 2"\nNEW=\n',["EXISTING"])).toEqual([{key:"EXISTING",value:"line 1\nline 2",action:"Update"},{key:"NEW",value:"",action:"Create"}]);
});
test("invalid imports report the location without echoing values",()=>{
 expect(()=>previewEnvImport("not a key=test-only-private-value",[])).toThrow(/line 1/);
 try{previewEnvImport("not a key=test-only-private-value",[]);}catch(error){expect(String(error)).not.toContain("test-only-private-value");}
});
