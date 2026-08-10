"use client";

import { useEffect, useMemo, useState } from "react";
import { SiteHeader } from "./SiteHeader";

type Review = { id:string; title:string; content:string; rating:number; author:string; date:string; version:string };
type AppData = { id:string; name:string; bundleId:string; developer:string; genres:string[]; primaryGenre:string; description:string; price:number; currency:string; rating:number; ratingCount:number; contentRating:string; iconUrl:string; screenshots:string[]; releaseDate:string; currentVersionReleaseDate:string; version:string; minimumOsVersion:string; fileSizeBytes:number; storeUrl:string };

export function AppDetail({ appId, country }: { appId:string; country:string }) {
  const [app, setApp] = useState<AppData | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");

  useEffect(() => {
    fetch(`/api/v1/apps/${appId}?country=${country}`).then((response) => response.json().then((payload) => ({ response, payload }))).then(({ response, payload }) => {
      if (!response.ok) throw new Error(payload.error?.message || "数据暂时不可用");
      setApp(payload.data.app); setReviews(payload.data.reviews);
    }).catch((cause) => setError(cause.message)).finally(() => setLoading(false));
  }, [appId, country]);

  const keywords = useMemo(() => {
    if (!app) return [];
    const words = app.name.replace(/[:：,&·-]/g, " ").split(/\s+/).filter((word) => word.length > 1);
    return Array.from(new Set([...words, ...app.genres])).slice(0, 10);
  }, [app]);

  async function generateAnalysis() {
    if (!app) return;
    setAnalyzing(true); setAnalysisError("");
    try {
      const response = await fetch("/api/v1/analysis/app", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ app, reviews }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message || "分析暂时不可用");
      setAnalysis(payload.data.content);
    } catch (cause) { setAnalysisError(cause instanceof Error ? cause.message : "分析暂时不可用"); }
    finally { setAnalyzing(false); }
  }

  if (loading) return <main><SiteHeader/><div className="detail-loading">正在读取 App Store 数据…</div></main>;
  if (error || !app) return <main><SiteHeader/><div className="detail-loading error-card">{error || "没有找到这个 App"}</div></main>;
  const ratingGroups = [5,4,3,2,1].map((star) => ({ star, count:reviews.filter((review) => review.rating === star).length }));
  const max = Math.max(...ratingGroups.map((group) => group.count), 1);

  return <main><SiteHeader/><section className="detail-shell">
    <div className="breadcrumb"><a href="/rankings">数据大盘</a><span>›</span><span>{app.name}</span></div>
    <div className="app-hero"><img src={app.iconUrl} alt=""/><div className="app-identity"><div className="detail-label">{country.toUpperCase()} APP STORE</div><h1>{app.name}</h1><p>{app.developer}</p><div className="detail-tags"><span>{app.primaryGenre}</span><span>{app.contentRating}</span><span>版本 {app.version}</span></div></div><div className="hero-score"><strong>{app.rating.toFixed(1)}</strong><span>★★★★★</span><small>{app.ratingCount.toLocaleString()} 个评分</small></div><a className="store-link" href={app.storeUrl} target="_blank" rel="noreferrer">App Store ↗</a></div>
    <div className="detail-grid"><div className="detail-main">
      <section className="detail-card"><div className="card-title"><div><span className="kicker">OVERVIEW</span><h2>产品概览</h2></div><span>更新于 {new Date(app.currentVersionReleaseDate).toLocaleDateString("zh-CN")}</span></div><div className="info-grid"><div><span>价格</span><strong>{app.price === 0 ? "免费" : `${app.price} ${app.currency}`}</strong></div><div><span>最低系统</span><strong>iOS {app.minimumOsVersion}+</strong></div><div><span>文件大小</span><strong>{Math.round(app.fileSizeBytes/1024/1024)} MB</strong></div><div><span>首次发布</span><strong>{new Date(app.releaseDate).toLocaleDateString("zh-CN")}</strong></div></div><p className="description">{app.description}</p></section>
      {app.screenshots.length > 0 && <section className="detail-card"><div className="card-title"><div><span className="kicker">CREATIVE</span><h2>商店截图</h2></div></div><div className="screenshots">{app.screenshots.slice(0,6).map((url) => <img src={url} alt="App Store 截图" key={url}/>)}</div></section>}
      <section className="detail-card"><div className="card-title"><div><span className="kicker">REVIEWS</span><h2>最新评论</h2></div><span>{reviews.length} 条样本</span></div>{reviews.length === 0 ? <div className="empty-card">当前地区暂未返回评论。</div> : <div className="review-list">{reviews.slice(0,8).map((review) => <article key={review.id}><div><strong>{review.title || "用户评论"}</strong><span>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span></div><p>{review.content}</p><small>{review.author} · {review.version && `v${review.version} · `}{new Date(review.date).toLocaleDateString("zh-CN")}</small></article>)}</div>}</section>
    </div><aside>
      <section className="detail-card keyword-card"><span className="kicker">KEYWORDS</span><h2>元数据关键词</h2><p>根据名称与分类提取，用于建立第一批追踪词。</p><div className="keyword-cloud">{keywords.map((word,index) => <span key={word}>{word}<small>{index < 3 ? "核心" : "相关"}</small></span>)}</div><button type="button">追踪这些关键词</button><small className="keyword-note">自然排名与历史变化将在关键词追踪后开始积累。</small></section>
      <section className="detail-card rating-card"><span className="kicker">RATING SAMPLE</span><h2>评论星级</h2>{ratingGroups.map((group) => <div className="rating-bar" key={group.star}><span>{group.star}★</span><i><b style={{ width:`${group.count/max*100}%` }}/></i><small>{group.count}</small></div>)}</section>
      <section className="agent-side"><span>APPBK AGENT · {analysis ? "QWEN3.7" : "READY"}</span><h3>{analysis ? "App 决策分析" : "下一步应该看什么？"}</h3>{analysis ? <div className="analysis-content">{analysis}</div> : <p>结合评分、版本、描述和评论样本，让 Agent 给出有依据的判断。</p>}{analysisError && <div className="agent-error">{analysisError}</div>}<button type="button" disabled={analyzing} onClick={generateAnalysis}>{analyzing ? "正在分析…" : analysis ? "重新生成分析" : "生成 App 分析 ↗"}</button></section>
    </aside></div>
  </section></main>;
}
