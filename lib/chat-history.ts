import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { mysqlPool } from "../db/mysql";

export type StoredChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  tools: string[];
  createdAt: number;
};

let tablesReady: Promise<void> | null = null;

export function ensureChatTables() {
  if (!tablesReady) {
    tablesReady = (async () => {
      await mysqlPool.query(`CREATE TABLE IF NOT EXISTS chat_conversations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        title VARCHAR(255) NOT NULL,
        agent VARCHAR(32) NOT NULL DEFAULT 'general',
        country VARCHAR(8) NOT NULL DEFAULT 'cn',
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        PRIMARY KEY (id),
        KEY idx_chat_conversations_user_updated (user_id, updated_at),
        CONSTRAINT fk_chat_conversations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await mysqlPool.query(`CREATE TABLE IF NOT EXISTS chat_messages (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        conversation_id BIGINT UNSIGNED NOT NULL,
        role VARCHAR(16) NOT NULL,
        content LONGTEXT NOT NULL,
        tools_json TEXT,
        created_at BIGINT NOT NULL,
        PRIMARY KEY (id),
        KEY idx_chat_messages_conversation_id (conversation_id, id),
        CONSTRAINT fk_chat_messages_conversation FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    })().catch((error) => { tablesReady = null; throw error; });
  }
  return tablesReady;
}

export async function listConversations(userId: number) {
  await ensureChatTables();
  const [rows] = await mysqlPool.execute<(RowDataPacket & { id:number;title:string;agent:string;country:string;created_at:number;updated_at:number })[]>(
    "SELECT id,title,agent,country,created_at,updated_at FROM chat_conversations WHERE user_id=? ORDER BY updated_at DESC LIMIT 50",
    [userId],
  );
  return rows.map((row) => ({ id:Number(row.id), title:row.title, agent:row.agent, country:row.country, createdAt:Number(row.created_at), updatedAt:Number(row.updated_at) }));
}

export async function createConversation(userId: number, title: string, agent: string, country: string) {
  await ensureChatTables();
  const now = Date.now();
  const [result] = await mysqlPool.execute<ResultSetHeader>(
    "INSERT INTO chat_conversations (user_id,title,agent,country,created_at,updated_at) VALUES (?,?,?,?,?,?)",
    [userId, title.slice(0, 255), agent, country, now, now],
  );
  return { id:Number(result.insertId), title:title.slice(0,255), agent, country, createdAt:now, updatedAt:now };
}

export async function getConversation(userId: number, conversationId: number) {
  await ensureChatTables();
  const [rows] = await mysqlPool.execute<(RowDataPacket & { id:number;title:string;agent:string;country:string;created_at:number;updated_at:number })[]>(
    "SELECT id,title,agent,country,created_at,updated_at FROM chat_conversations WHERE id=? AND user_id=? LIMIT 1",
    [conversationId, userId],
  );
  const row = rows[0];
  return row ? { id:Number(row.id), title:row.title, agent:row.agent, country:row.country, createdAt:Number(row.created_at), updatedAt:Number(row.updated_at) } : null;
}

export async function listMessages(conversationId: number, limit = 100) {
  await ensureChatTables();
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 200);
  const [rows] = await mysqlPool.query<(RowDataPacket & { id:number;role:"user"|"assistant";content:string;tools_json:string|null;created_at:number })[]>(
    `SELECT id,role,content,tools_json,created_at FROM (SELECT id,role,content,tools_json,created_at FROM chat_messages WHERE conversation_id=? ORDER BY id DESC LIMIT ${safeLimit}) recent ORDER BY id ASC`,
    [conversationId],
  );
  return rows.map((row):StoredChatMessage => {
    let tools: string[] = [];
    try { tools = row.tools_json ? JSON.parse(row.tools_json) : []; } catch { tools = []; }
    return { id:Number(row.id), role:row.role, content:row.content, tools:Array.isArray(tools)?tools:[], createdAt:Number(row.created_at) };
  });
}

export async function addMessage(conversationId: number, role: "user"|"assistant", content: string, tools: string[] = []) {
  await ensureChatTables();
  const now = Date.now();
  const [result] = await mysqlPool.execute<ResultSetHeader>(
    "INSERT INTO chat_messages (conversation_id,role,content,tools_json,created_at) VALUES (?,?,?,?,?)",
    [conversationId, role, content, tools.length ? JSON.stringify(tools) : null, now],
  );
  await mysqlPool.execute("UPDATE chat_conversations SET updated_at=? WHERE id=?", [now, conversationId]);
  return { id:Number(result.insertId), role, content, tools, createdAt:now };
}
