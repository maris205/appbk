"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type AppResult = {
  id: string;
  name: string;
  developer: string;
  iconUrl: string;
  price: number;
  rating: number;
  ratingCount: number;
  genres: string[];
  storeUrl: string;
};

type AuthUser = { id: number; email: string };

const decisions = [
  { tone: "mint", tag: "榜单机会", title: "效率榜出现 3 个快速上升的新 App", detail: "其中 2 个聚焦端侧 AI，评分规模仍较小，值得进一步研究。", meta: "美国 · iPhone · 2 小时前" },
  { tone: "amber", tag: "评论异常", title: "一星评论集中提到订阅恢复失败", detail: "最近 7 天相关反馈较前一周增加，建议优先检查购买恢复流程。", meta: "已追踪 App · 6 小时前" },
  { tone: "blue", tag: "关键词机会", title: "“AI teleprompter”竞争强度仍可接受", detail: "前十名中有 4 款 App 的评分量低于 2,000，存在切入窗口。", meta: "美国 · 今日" },
];

export function SearchWorkspace() {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("cn");
  const [results, setResults] = useState<AppResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState("");

  useEffect(() => {
    fetch("/api/v1/auth/me").then((response) => response.json()).then((payload) => setUser(payload.data || null)).catch(() => undefined).finally(() => setAuthChecked(true));
  }, []);

  async function logout() {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    setUser(null);
  }

  async function onSearch(event: FormEvent) {
    event.preventDefault();
    const keyword = query.trim();
    if (!keyword) return;
    setPendingPrompt(keyword);
    if (!user) setAuthOpen(true);
  }

  if (authChecked && user) return <LoggedInChat user={user} country={country} initialPrompt={pendingPrompt} onCountryChange={setCountry} onLogout={logout}/>;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#" aria-label="appbk 首页">
          <img src="/appbk-logo.png" alt="appbk" />
          <span>appbk</span>
        </a>
        <nav aria-label="主导航">
          <a className="active" href="#today">首页</a>
          <a href="/rankings">数据大盘</a>
          <a href="#agent">Agent</a>
        </nav>
        <div className="top-actions">
          <a className="dashboard-link" href="/rankings"><span>▦</span> 数据大盘</a>
          {user ? <div className="user-chip"><span>{user.email.slice(0, 1).toUpperCase()}</span><strong>{user.email}</strong><button type="button" onClick={logout}>退出</button></div> : <button className="login" type="button" onClick={() => setAuthOpen(true)}>注册 / 登录</button>}
        </div>
      </header>

      <section className="hero" id="today">
        <div className="eyebrow"><span /> APP DECISION AGENT</div>
        <h1>让数据替你观察，<br /><em>让 Agent 帮你决策。</em></h1>
        <p className="lead">连接 App Store 的榜单、评论与关键词，appbk 每天告诉你下一步最值得做什么。</p>
        <form className="searchbox" onSubmit={onSearch}>
          <div className="search-icon" aria-hidden="true">⌕</div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 App 名称、App ID，或直接问一个问题…" aria-label="搜索 App" />
          <select value={country} onChange={(event) => setCountry(event.target.value)} aria-label="国家或地区">
            <option value="cn">中国</option>
            <option value="us">美国</option>
            <option value="jp">日本</option>
          </select>
          <button disabled={loading} type="submit">{loading ? "搜索中" : "开始分析"}<span>↗</span></button>
        </form>
        <div className="prompts"><span>试着问：</span><button onClick={() => setQuery("Notion")}>分析 Notion</button><button onClick={() => setQuery("AI teleprompter")}>研究 AI 提词器</button></div>
      </section>

      {searched && (
        <section className="results" id="apps" aria-live="polite">
          <div className="section-heading"><div><span className="kicker">实时数据</span><h2>App 搜索结果</h2></div><span className="fresh">RapidAPI · {country.toUpperCase()}</span></div>
          {error && <div className="error-card">{error}</div>}
          {!loading && !error && results.length === 0 && <div className="empty-card">没有找到匹配的 App，请换一个名称试试。</div>}
          <div className="app-grid">
            {results.map((app) => (
              <a className="app-card" key={app.id} href={`/apps/${app.id}?country=${country}`}>
                <img src={app.iconUrl} alt="" />
                <div className="app-main"><strong>{app.name}</strong><span>{app.developer}</span><small>{app.genres.slice(0, 2).join(" · ") || "App"}</small></div>
                <div className="app-score"><strong>{app.rating ? app.rating.toFixed(1) : "—"}</strong><span>★ {app.ratingCount.toLocaleString()}</span></div>
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="decision-section" id="agent">
        <div className="section-heading"><div><span className="kicker">TODAY · 08/09</span><h2>今天值得关注的 3 件事</h2></div><button className="ghost" type="button">查看全部 <span>→</span></button></div>
        <div className="decision-grid">
          {decisions.map((item, index) => (
            <article className={`decision ${item.tone}`} key={item.title}>
              <div className="decision-top"><span className="number">0{index + 1}</span><span className="tag">{item.tag}</span></div>
              <h3>{item.title}</h3><p>{item.detail}</p>
              <div className="decision-bottom"><small>{item.meta}</small><button type="button" aria-label={`查看：${item.title}`}>↗</button></div>
            </article>
          ))}
        </div>
      </section>

      <section className="agent-strip">
        <div className="agent-mark">A</div><div><span>APPBK AGENT</span><h2>不只展示数据，还要给出下一步。</h2></div><p>每条判断都附带数据依据、时间范围与置信度。你可以继续追问，未来也可以交给 Codex 或 WorkBuddy 执行。</p><button type="button">和 Agent 对话 <span>↗</span></button>
      </section>

      <footer><div className="brand"><img src="/appbk-logo.png" alt="" /><span>appbk</span></div><p>大模型时代的 App 决策服务</p><span>数据有依据，决策可追问。</span></footer>
      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onSuccess={(account) => { setUser(account); setAuthOpen(false); }} />}
    </main>
  );
}

function AuthDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/v1/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "操作失败");
      onSuccess(payload.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" type="button" onClick={onClose} aria-label="关闭">×</button>
        <div className="auth-brand"><img src="/appbk-logo.png" alt="" /><span>appbk</span></div>
        <h2 id="auth-title">{mode === "login" ? "欢迎回来" : "创建你的账户"}</h2>
        <p>{mode === "login" ? "登录后保存 App、关键词和每日决策。" : "注册只需要邮箱和密码，暂不需要邮箱验证。"}</p>
        <form onSubmit={submit}>
          <label>邮箱<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" required autoFocus /></label>
          <label>密码<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "至少 8 个字符" : "输入密码"} minLength={8} maxLength={128} required /></label>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" disabled={submitting} type="submit">{submitting ? "请稍候…" : mode === "login" ? "登录" : "注册并登录"}</button>
        </form>
        <div className="auth-switch">{mode === "login" ? "还没有账户？" : "已经有账户？"}<button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "立即注册" : "直接登录"}</button></div>
      </section>
    </div>
  );
}

type ChatMessage = { role: "user" | "assistant"; content: string };
type AgentType = "general" | "launch" | "aso" | "apple_ads";
const agents: Record<AgentType, { name:string; short:string; description:string; greeting:string; suggestions:string[] }> = {
  general:{ name:"appbk Agent", short:"A", description:"App 产品与增长决策", greeting:"今天想分析什么？", suggestions:["分析一下中国区效率工具的产品机会","一个新 App 应该怎样验证关键词？","帮我设计一个 App 增长周报框架"] },
  launch:{ name:"App 上架专家", short:"上", description:"审核、元数据与发布检查", greeting:"准备上架哪一款 App？", suggestions:["给我一份 iOS App 上架检查清单","订阅类 App 审核最容易踩哪些坑？","帮我检查隐私政策需要包含什么"] },
  aso:{ name:"ASO 专家", short:"搜", description:"关键词、榜单与评论增长", greeting:"想研究哪个 App 或关键词？", suggestions:["如何为一个新 App 建立第一批关键词？","帮我设计竞品 ASO 分析框架","评分下降时应该先排查什么？"] },
  apple_ads:{ name:"苹果广告专家", short:"广", description:"Apple Ads 结构与投放优化", greeting:"想诊断哪个广告问题？", suggestions:["新 App 的 Apple Ads 账户怎么搭？","Search Match 应该怎么使用？","高消耗低转化关键词怎么排查？"] },
};

function LoggedInChat({ user, country, initialPrompt, onCountryChange, onLogout }: { user:AuthUser; country:string; initialPrompt:string; onCountryChange:(country:string)=>void; onLogout:()=>void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [activeAgent, setActiveAgent] = useState<AgentType>("general");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const initialSent = useRef(false);

  async function sendMessage(contentInput?: string) {
    const content = (contentInput ?? input).trim();
    if (!content || sending) return;
    const nextMessages = [...messages, { role:"user" as const, content }];
    setMessages(nextMessages); setInput(""); setSending(true); setChatError("");
    try {
      const response = await fetch("/api/v1/chat", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ country, agent:activeAgent, messages:nextMessages }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "Agent 暂时不可用");
      setMessages([...nextMessages, payload.data.message]);
    } catch (cause) { setChatError(cause instanceof Error ? cause.message : "Agent 暂时不可用"); }
    finally { setSending(false); }
  }

  useEffect(() => {
    if (initialPrompt && !initialSent.current) { initialSent.current = true; void sendMessage(initialPrompt); }
  }, [initialPrompt]);

  useEffect(() => {
    const savedCountry = window.localStorage.getItem("appbk_default_country");
    if (savedCountry && ["cn","us","jp"].includes(savedCountry)) onCountryChange(savedCountry);
  }, []);

  function changeCountry(value:string) {
    onCountryChange(value);
    window.localStorage.setItem("appbk_default_country", value);
  }

  return <main className="chat-page">
    <header className="topbar app-header"><a className="brand" href="/"><img src="/appbk-logo.png" alt="appbk"/><span>appbk</span></a><nav><a href="/rankings">数据大盘</a><a className="active" href="/">Agent</a></nav><div className="top-actions"><select className="chat-country" value={country} onChange={(event)=>changeCountry(event.target.value)}><option value="cn">中国区</option><option value="us">美国区</option><option value="jp">日本区</option></select></div></header>
    <section className="chat-shell">
      <aside className="chat-sidebar"><button type="button" onClick={()=>{setMessages([]);setChatError("");setActiveAgent("general")}}>＋ 新对话</button><div><span>今天</span><p className="active">App 增长分析</p></div><div className="specialists"><span>专业 Agent</span>{(["launch","aso","apple_ads"] as AgentType[]).map((key)=><button className={activeAgent===key?"active":""} type="button" key={key} onClick={()=>{setActiveAgent(key);setMessages([]);setChatError("")}}><b>{agents[key].short}</b><i><strong>{agents[key].name}</strong><small>{agents[key].description}</small></i><em>›</em></button>)}</div><div className="sidebar-account"><a href="/rankings">▦ 数据大盘</a><button type="button" onClick={()=>setSettingsOpen(true)}><span>{user.email.slice(0,1).toUpperCase()}</span><i><strong>{user.email}</strong><small>账户与设置</small></i><em>···</em></button></div></aside>
      <div className="chat-main"><div className="chat-thread">
        {messages.length===0&&<div className="chat-welcome"><div className="agent-orb">{agents[activeAgent].short}</div><div className="agent-type-label">{agents[activeAgent].name}</div><h1>{agents[activeAgent].greeting}</h1><p>{agents[activeAgent].description}，回答会优先使用该领域的专业工作流。</p><div className="chat-suggestions">{agents[activeAgent].suggestions.map((suggestion)=><button key={suggestion} onClick={()=>sendMessage(suggestion)}>{suggestion}</button>)}</div></div>}
        {messages.map((message,index)=><article className={`chat-message ${message.role}`} key={`${message.role}-${index}`}>{message.role==="assistant"&&<div className="message-avatar">{agents[activeAgent].short}</div>}<div><span>{message.role==="user"?"你":agents[activeAgent].name}</span><p>{message.content}</p></div></article>)}
        {sending&&<article className="chat-message assistant"><div className="message-avatar">{agents[activeAgent].short}</div><div><span>{agents[activeAgent].name}</span><p className="thinking">正在分析<span>···</span></p></div></article>}
        {chatError&&<div className="chat-error">{chatError}<button onClick={()=>sendMessage(messages.at(-1)?.role==="user"?messages.at(-1)?.content:undefined)}>重试</button></div>}
      </div><form className="chat-composer" onSubmit={(event)=>{event.preventDefault();void sendMessage()}}><textarea value={input} onChange={(event)=>setInput(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();void sendMessage()}}} placeholder="给 appbk Agent 发消息…" rows={1}/><button type="submit" disabled={sending||!input.trim()}>↑</button><small>默认分析 {country==="cn"?"中国区":country==="us"?"美国区":"日本区"} · AI 可能出错，重要决策请核验数据</small></form></div>
    </section>
    {settingsOpen&&<div className="auth-overlay" onMouseDown={(event)=>{if(event.target===event.currentTarget)setSettingsOpen(false)}}><section className="settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-title"><button className="auth-close" type="button" onClick={()=>setSettingsOpen(false)} aria-label="关闭">×</button><div className="settings-heading"><span>{user.email.slice(0,1).toUpperCase()}</span><div><h2 id="settings-title">账户设置</h2><p>{user.email}</p></div></div><div className="setting-row"><div><strong>默认市场</strong><small>用于新对话和专业 Agent 分析</small></div><select value={country} onChange={(event)=>changeCountry(event.target.value)}><option value="cn">中国区</option><option value="us">美国区</option><option value="jp">日本区</option></select></div><div className="setting-row"><div><strong>当前对话</strong><small>清除本次浏览器中的聊天内容</small></div><button type="button" onClick={()=>{setMessages([]);setChatError("");setSettingsOpen(false)}}>清空对话</button></div><div className="settings-note">MVP1 暂时只保存市场偏好，聊天记录还没有同步到数据库。</div><button className="settings-logout" type="button" onClick={onLogout}>退出登录</button></section></div>}
  </main>;
}
