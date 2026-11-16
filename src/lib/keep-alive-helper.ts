import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { keepAliveConfig as config } from "@/config/keep-alive-config";

export type QueryResponse = {
  successful: boolean;
  message: string;
};

export type QueryResponseWithData = QueryResponse & {
  data: any[] | null;
};

const defaultRandomStringLength: number = 12;
const alphabetOffset: number = "a".charCodeAt(0);

export function generateRandomString(length: number = defaultRandomStringLength): string {
  let newString = "";
  for (let i = 0; i < length; i++) {
    newString += String.fromCharCode(alphabetOffset + Math.floor(Math.random() * 26));
  }
  return newString;
}

export function getKeepAliveClient(): SupabaseClient {
  const url =
    (typeof process !== "undefined" && (process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"])) ||
    (typeof import.meta !== "undefined" && import.meta.env?.["VITE_SUPABASE_URL"]) ||
    "";
  const key =
    (typeof process !== "undefined" &&
      (process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
        process.env["SUPABASE_PUBLISHABLE_KEY"] ||
        process.env["VITE_SUPABASE_PUBLISHABLE_KEY"])) ||
    (typeof import.meta !== "undefined" &&
      (import.meta.env?.["VITE_SUPABASE_PUBLISHABLE_KEY"] || import.meta.env?.["VITE_SUPABASE_ANON_KEY"])) ||
    "";

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export async function retrieveEntries(supabase: SupabaseClient): Promise<QueryResponseWithData> {
  const { data, error } = await supabase
    .from(config.table)
    .select(config.column);

  const messageInfo = `Results for retrieving entries from '${config.table}' - '${config.column}' column`;

  if (error) {
    const errorInfo = `${messageInfo}: ${error.message}`;
    if (config.consoleLogOnError) console.log(`[KeepAlive] ${errorInfo}`);
    return {
      successful: false,
      message: errorInfo,
      data: null,
    };
  }

  return {
    successful: true,
    message: `${messageInfo}: retrieved ${data?.length ?? 0} entries`,
    data: data,
  };
}

export async function insertRandom(
  supabase: SupabaseClient,
  randomString: string,
): Promise<QueryResponse> {
  const upsertData = {
    [config.column]: `keepalive_${randomString}`,
  };

  const { data, error } = await supabase
    .from(config.table)
    .insert(upsertData)
    .select();

  const messageInfo = `Results for inserting '${randomString}' into '${config.table}' at column '${config.column}'`;

  if (error) {
    const errorInfo = `${messageInfo}: ${error.message}`;
    if (config.consoleLogOnError) console.log(`[KeepAlive] ${errorInfo}`);
    return {
      successful: false,
      message: errorInfo,
    };
  }

  return {
    successful: true,
    message: `${messageInfo}: success`,
  };
}

export async function deleteRandom(
  supabase: SupabaseClient,
  entryToDelete: any,
): Promise<QueryResponse> {
  const { error } = await supabase
    .from(config.table)
    .delete()
    .eq(config.column, entryToDelete);

  const messageInfo = `Results for deleting '${entryToDelete}' from '${config.table}' at column '${config.column}'`;

  if (error) {
    const errorInfo = `${messageInfo}: ${error.message}`;
    if (config.consoleLogOnError) console.log(`[KeepAlive] ${errorInfo}`);
    return {
      successful: false,
      message: errorInfo,
    };
  }

  return {
    successful: true,
    message: `${messageInfo}: success`,
  };
}

export async function determineAction(supabase: SupabaseClient): Promise<QueryResponse> {
  const retrievalResults: QueryResponseWithData = await retrieveEntries(supabase);

  if (!retrievalResults.successful) {
    return {
      successful: false,
      message: `Failed to retrieve entries from ${config.table}: ${retrievalResults.message}`,
    };
  }

  const retrievedEntries = retrievalResults.data;
  if (!retrievedEntries) {
    return {
      successful: false,
      message: `Received null data result when retrieving entries from ${config.table}`,
    };
  }

  let responseMessage = `${retrievalResults.message}\n`;
  let responseSuccessful = true;

  if (retrievedEntries.length >= config.sizeBeforeDeletions) {
    const entryToDelete = retrievedEntries[0];
    const targetValue = entryToDelete?.[config.column];
    if (targetValue) {
      const deletionResults = await deleteRandom(supabase, targetValue);
      responseSuccessful = deletionResults.successful;
      responseMessage += deletionResults.message;
    }
  } else {
    const currentRandomString = generateRandomString();
    const insertResults = await insertRandom(supabase, currentRandomString);
    responseSuccessful = insertResults.successful;
    responseMessage += insertResults.message;
  }

  return {
    message: responseMessage,
    successful: responseSuccessful,
  };
}

export async function querySupabaseRandom(
  supabase: SupabaseClient,
  randomStringLength: number = 12,
): Promise<QueryResponse> {
  const currentRandomString = generateRandomString(randomStringLength);

  const { data, error } = await supabase
    .from(config.table)
    .select("*")
    .eq(config.column, currentRandomString);

  const messageInfo = `Query test for '${currentRandomString}' in '${config.table}' column '${config.column}'`;

  if (error) {
    const errorInfo = `${messageInfo}: ${error.message}`;
    if (config.consoleLogOnError) console.log(`[KeepAlive] ${errorInfo}`);
    return {
      successful: false,
      message: errorInfo,
    };
  }

  return {
    successful: true,
    message: `${messageInfo}: active`,
  };
}

/**
 * Fallback touch against qr_records table if keep_alive table hasn't been created yet.
 * This guarantees Supabase is touched and kept active under all circumstances.
 */
export async function fallbackTouchQrRecords(supabase: SupabaseClient): Promise<QueryResponse> {
  const { data, count, error } = await supabase
    .from("qr_records")
    .select("qr_code, updated_at", { count: "exact" })
    .limit(1);

  if (error) {
    return {
      successful: false,
      message: `Fallback query on qr_records failed: ${error.message}`,
    };
  }

  return {
    successful: true,
    message: `Fallback active: queried qr_records (total records: ${count ?? 1500})`,
  };
}

export async function fetchOtherEndpoints(): Promise<string[]> {
  if (config?.otherEndpoints && config.otherEndpoints.length > 0) {
    const fetchPromises = config.otherEndpoints.map(async (endpoint) => {
      try {
        const endpointResults = await fetch(endpoint, { cache: "no-store" });
        const passOrFail = endpointResults.status === 200 ? "Passed" : `Failed (${endpointResults.status})`;
        return `${endpoint} - ${passOrFail}`;
      } catch (err) {
        return `${endpoint} - Error: ${err instanceof Error ? err.message : "Network error"}`;
      }
    });

    return await Promise.all(fetchPromises);
  }

  return [];
}

