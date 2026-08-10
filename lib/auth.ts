import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { ensureDatabase } from "../db/initialize";
import { mysqlPool } from "../db/mysql";

const SESSION_COOKIE = "appbk_session";
const SESSION_DAYS = 30;
const encoder = new TextEncoder();

function toHex(bytes: Uint8Array) { return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""); }
function fromHex(value: string) { return new Uint8Array(value.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) || []); }
function randomHex(length = 32) { const bytes = new Uint8Array(length); crypto.getRandomValues(bytes); return toHex(bytes); }
async function sha256(value: string) { return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))); }
async function derivePassword(password: string, saltHex: string) { const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]); const bits = await crypto.subtle.deriveBits({ name:"PBKDF2", hash:"SHA-256", salt:fromHex(saltHex), iterations:210_000 }, key, 256); return toHex(new Uint8Array(bits)); }
function safeEqual(left: string, right: string) { if (left.length !== right.length) return false; let difference=0; for(let index=0;index<left.length;index+=1) difference|=left.charCodeAt(index)^right.charCodeAt(index); return difference===0; }

export function normalizeEmail(email:string){return email.trim().toLowerCase()}
export function isValidEmail(email:string){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)&&email.length<=254}

export async function registerUser(emailInput:string,password:string){
  await ensureDatabase(); const email=normalizeEmail(emailInput); const salt=randomHex(16); const passwordHash=await derivePassword(password,salt); const now=Date.now();
  try { const [result]=await mysqlPool.execute<ResultSetHeader>("INSERT INTO users (email,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?)",[email,passwordHash,salt,now,now]); return {id:Number(result.insertId),email}; }
  catch(error){ if(error instanceof Error&&/duplicate|unique|constraint/i.test(error.message))throw new Error("该邮箱已经注册"); throw error; }
}

export async function verifyUser(emailInput:string,password:string){
  await ensureDatabase(); const email=normalizeEmail(emailInput); const [rows]=await mysqlPool.execute<(RowDataPacket&{id:number;email:string;password_hash:string;password_salt:string})[]>("SELECT id,email,password_hash,password_salt FROM users WHERE email=? LIMIT 1",[email]); const user=rows[0]; if(!user)return null; const passwordHash=await derivePassword(password,user.password_salt); return safeEqual(passwordHash,user.password_hash)?{id:Number(user.id),email:user.email}:null;
}

export async function createSession(userId:number){await ensureDatabase();const token=randomHex(32);const tokenHash=await sha256(token);const now=Date.now();const expiresAt=now+SESSION_DAYS*24*60*60*1000;await mysqlPool.execute("INSERT INTO sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)",[tokenHash,userId,now,expiresAt]);return{token,expiresAt}}
export async function getUserFromToken(token?:string|null){if(!token)return null;await ensureDatabase();const [rows]=await mysqlPool.execute<(RowDataPacket&{id:number;email:string})[]>("SELECT users.id,users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>? LIMIT 1",[await sha256(token),Date.now()]);return rows[0]?{id:Number(rows[0].id),email:rows[0].email}:null}
export async function deleteSession(token?:string|null){if(!token)return;await ensureDatabase();await mysqlPool.execute("DELETE FROM sessions WHERE token_hash=?",[await sha256(token)])}
export function readSessionCookie(request:Request){const cookies=request.headers.get("cookie")||"";const value=cookies.split(";").map((item)=>item.trim()).find((item)=>item.startsWith(`${SESSION_COOKIE}=`));return value?decodeURIComponent(value.slice(SESSION_COOKIE.length+1)):null}
export function sessionCookie(token:string,expiresAt:number){const secure=process.env.NODE_ENV==="production"?"; Secure":"";return`${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Expires=${new Date(expiresAt).toUTCString()}${secure}`}
export function clearSessionCookie(){const secure=process.env.NODE_ENV==="production"?"; Secure":"";return`${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`}
