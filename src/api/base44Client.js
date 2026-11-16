// TONIGHT: local stand-in. TOMORROW (Base44): this file already exists in the Base44 app and exports the real client
// with the same name, so every `import { base44 } from "@/api/base44Client"` keeps working unchanged.
import { localBase44 } from "@/lib/local/localBase44";
export const base44 = localBase44;
